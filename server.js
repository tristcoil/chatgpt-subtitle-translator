// Simple Express API wrapper around the subtitle translation logic
// Usage:
//   node server.js
//   # or override port
//   PORT=5100 node server.js

import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import * as undici from 'undici';
import log from 'loglevel';
import 'dotenv/config';

import {
  DefaultOptions,
  Translator,
  TranslatorStructuredObject,
  TranslatorStructuredArray,
  createOpenAIClient,
  CooldownContext,
  subtitleParser,
} from './src/main.mjs';

const app = express();
app.use(express.json());

// Minimal CORS for frontend (adjust in production)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Simple request logger (no extra deps)
app.use((req, res, next) => {
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] -> ${req.method} ${req.originalUrl}`);
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`[${new Date().toISOString()}] <- ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
});

// Multer for uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Ensure uploads dir exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Configure logging baseline
try { log.setLevel(/** @type {import('loglevel').LogLevelDesc} */ (process.env.LOG_LEVEL || 'info')); } catch {}

// Proxy agent if http(s)_proxy is set
function getProxyAgent() {
  const httpProxyConfig = process.env.http_proxy ?? process.env.HTTP_PROXY;
  const httpsProxyConfig = process.env.https_proxy ?? process.env.HTTPS_PROXY;
  if (httpProxyConfig || httpsProxyConfig) {
    log.debug('[API PROXY] Using proxy from env', { httpProxyConfig, httpsProxyConfig });
    return new undici.EnvHttpProxyAgent();
  }
  return undefined;
}

const proxyAgent = getProxyAgent();

// Provider-aware client factory (OpenAI or Ollama via OpenAI-compatible API)
const DEFAULT_PROVIDER = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
const clientsCache = new Map();

function getLLMClients(provider = DEFAULT_PROVIDER) {
  const key = provider.toLowerCase();
  if (clientsCache.has(key)) return clientsCache.get(key);

  /**
   * Supported providers:
   *  - openai: requires OPENAI_API_KEY, optional OPENAI_BASE_URL
   *  - ollama: uses OLLAMA_OPENAI_BASE_URL (default http://127.0.0.1:11434/v1)
   *            apiKey can be any non-empty string (placeholder used)
   */
  let baseURL;
  let apiKey;
  let moderationEnabled = true;

  if (key === 'ollama') {
    baseURL = process.env.OLLAMA_OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1';
    apiKey = process.env.OLLAMA_OPENAI_API_KEY || 'sk-ollama';
  } else {
    baseURL = process.env.OPENAI_BASE_URL; // optional
    apiKey = process.env.OPENAI_API_KEY;
    moderationEnabled = true;
  }

  const openai = createOpenAIClient(apiKey, undefined, baseURL, proxyAgent);
  const coolerChat = new CooldownContext(Number(process.env.OPENAI_API_RPM ?? 60), 60000, 'ChatGPTAPI');
  const coolerMod = new CooldownContext(Number(process.env.OPENAI_API_RPM ?? process.env.OPENAI_API_MODERATOR_RPM ?? 60), 60000, 'OpenAIModerator');

  const value = { provider: key, openai, coolerChat, coolerMod, moderationEnabled };
  clientsCache.set(key, value);
  return value;
}

// Core translation helper
async function performTranslation(inputFilePath, outputFilePath, options = {}, onProgress = undefined) {
  const {
    from = undefined,
    to = 'English',
    model = DefaultOptions.createChatCompletionRequest.model,
    temperature = undefined,
    batchSizes = DefaultOptions.batchSizes,
    historyPromptLength = DefaultOptions.historyPromptLength,
    useModerator = true,
    prefixNumber = true,
    lineMatching = true,
    systemInstruction = undefined,
    structuredMode = false,
    logLevel = 'info',
    provider: requestedProvider,
    inputOriginalName,
  } = options;

  try { log.setLevel(/** @type {import('loglevel').LogLevelDesc} */ (logLevel)); } catch {}

  const { provider, openai, coolerChat, coolerMod, moderationEnabled } = getLLMClients(requestedProvider);

  const inputContent = fs.readFileSync(inputFilePath, 'utf8');
  const isSrtFile = (inputOriginalName && inputOriginalName.toLowerCase().endsWith('.srt'))
    || inputFilePath.toLowerCase().endsWith('.srt');

  let lines;
  if (isSrtFile) {
    const srt = subtitleParser.fromSrt(inputContent);
    lines = srt.map((x) => x.text);
  } else {
    lines = inputContent.split('\n');
  }

  const translatorOptions = {
    createChatCompletionRequest: {
      model,
      ...(temperature !== undefined && { temperature }),
    },
    batchSizes,
    historyPromptLength,
    useModerator,
    prefixNumber,
    lineMatching,
    logLevel,
    structuredMode,
  };

  let translator;
  if (structuredMode === 'array') {
    translator = new TranslatorStructuredArray(
      { from, to },
      {
        openai,
        cooler: coolerChat,
        ...(useModerator && moderationEnabled && {
          moderationService: {
            openai,
            cooler: coolerMod,
          },
        }),
      },
      translatorOptions,
    );
  } else if (structuredMode === 'object') {
    translator = new TranslatorStructuredObject(
      { from, to },
      {
        openai,
        cooler: coolerChat,
        ...(useModerator && moderationEnabled && {
          moderationService: {
            openai,
            cooler: coolerMod,
          },
        }),
      },
      translatorOptions,
    );
  } else {
    translator = new Translator(
      { from, to },
      {
        openai,
        cooler: coolerChat,
        ...(useModerator && moderationEnabled && {
          moderationService: {
            openai,
            cooler: coolerMod,
          },
        }),
      },
      translatorOptions,
    );
  }

  if (systemInstruction) {
    translator.systemInstruction = systemInstruction;
  }

  if (isSrtFile) {
    const srtArrayWorking = subtitleParser.fromSrt(inputContent);
    let completed = 0;
    const total = srtArrayWorking.length;
    for await (const output of translator.translateLines(lines)) {
      const srtEntry = srtArrayWorking[output.index - 1];
      srtEntry.text = output.finalTransform;
      completed = output.index;
      onProgress?.({ completed, total });
    }
    const outputSrt = subtitleParser.toSrt(srtArrayWorking);
    fs.writeFileSync(outputFilePath, outputSrt, 'utf8');
  } else {
    const translatedLines = [];
    let completed = 0;
    const total = lines.length;
    for await (const output of translator.translateLines(lines)) {
      translatedLines.push(output.transform);
      completed++;
      onProgress?.({ completed, total });
    }
    fs.writeFileSync(outputFilePath, translatedLines.join('\n'), 'utf8');
  }

  const usage = translator.usage;
  return {
    promptTokensUsed: translator.promptTokensUsed,
    promptTokensWasted: translator.promptTokensWasted,
    cachedTokens: translator.cachedTokens,
    completionTokensUsed: translator.completionTokensUsed,
    completionTokensWasted: translator.completionTokensWasted,
    estimatedCost: usage.usedTokensPricing,
    linesTranslated: isSrtFile ? subtitleParser.fromSrt(inputContent).length : lines.length,
  };
}

// ------------------------------
// Simple in-memory job manager
// ------------------------------
/** @type {Map<string, any>} */
const jobs = new Map();

function createJobId() {
  return `job_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getJob(id) {
  return jobs.get(id);
}

function setJob(id, data) {
  jobs.set(id, { ...(jobs.get(id) || {}), ...data, updatedAt: Date.now() });
}

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'chatgpt-subtitle-translator' });
});

// Upload and translate
app.post('/api/translate', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const inputFilePath = req.file.path;
    const originalName = req.file.originalname;
    const outputFileName = `${path.parse(originalName).name}.out${path.extname(originalName)}`;
    const outputFilePath = path.join('uploads', outputFileName);

    const sm = req.body.structuredMode;
    const normalizedStructuredMode = sm === 'array' ? 'array' : sm === 'object' ? 'object' : false;

    const options = {
      to: req.body.to || 'English',
      from: req.body.from,
      model: req.body.model,
      temperature: req.body.temperature ? parseFloat(req.body.temperature) : undefined,
      batchSizes: req.body.batchSizes ? JSON.parse(req.body.batchSizes) : undefined,
      historyPromptLength: req.body.historyPromptLength ? parseInt(req.body.historyPromptLength) : undefined,
      useModerator: req.body.useModerator !== 'false',
      prefixNumber: req.body.prefixNumber !== 'false',
      lineMatching: req.body.lineMatching !== 'false',
      systemInstruction: req.body.systemInstruction,
      structuredMode: normalizedStructuredMode,
      logLevel: req.body.logLevel || 'info',
      provider: (req.body.provider || DEFAULT_PROVIDER).toLowerCase(),
      inputOriginalName: originalName,
    };

    const stats = await performTranslation(inputFilePath, outputFilePath, options);

    res.json({
      success: true,
      message: 'Translation completed',
      outputFile: outputFilePath,
      outputFileName,
      statistics: stats,
    });

    setTimeout(() => {
      if (fs.existsSync(inputFilePath)) {
        fs.unlinkSync(inputFilePath);
      }
    }, 60000);
  } catch (error) {
    log.error('[API Error]', error);
    res.status(500).json({ error: 'Translation failed', message: error.message });
  }
});

// Async upload and translate (returns jobId immediately)
app.post('/api/translate-async', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const inputFilePath = req.file.path;
    const originalName = req.file.originalname;
    const outputFileName = `${path.parse(originalName).name}.out${path.extname(originalName)}`;
    const outputFilePath = path.join('uploads', outputFileName);

    const sm = req.body.structuredMode;
    const normalizedStructuredMode = sm === 'array' ? 'array' : sm === 'object' ? 'object' : false;

    const options = {
      to: req.body.to || 'English',
      from: req.body.from,
      model: req.body.model,
      temperature: req.body.temperature ? parseFloat(req.body.temperature) : undefined,
      batchSizes: req.body.batchSizes ? JSON.parse(req.body.batchSizes) : undefined,
      historyPromptLength: req.body.historyPromptLength ? parseInt(req.body.historyPromptLength) : undefined,
      useModerator: req.body.useModerator !== 'false',
      prefixNumber: req.body.prefixNumber !== 'false',
      lineMatching: req.body.lineMatching !== 'false',
      systemInstruction: req.body.systemInstruction,
      structuredMode: normalizedStructuredMode,
      logLevel: req.body.logLevel || 'info',
      provider: (req.body.provider || DEFAULT_PROVIDER).toLowerCase(),
      inputOriginalName: originalName,
    };

    const jobId = createJobId();
    /** track SSE clients */
    const clients = new Set();
    setJob(jobId, {
      id: jobId,
      status: 'queued',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      file: originalName,
      inputFilePath,
      outputFilePath,
      outputFileName,
      progress: { completed: 0, total: 0 },
      error: null,
      stats: null,
      clients,
    });

    // Start background processing
    ;(async () => {
      try {
        setJob(jobId, { status: 'processing' });

        // Determine total upfront
        const inputContent = fs.readFileSync(inputFilePath, 'utf8');
        const isSrtFile = inputFilePath.toLowerCase().endsWith('.srt');
        const total = isSrtFile ? subtitleParser.fromSrt(inputContent).length : inputContent.split('\n').length;
        setJob(jobId, { progress: { completed: 0, total } });

        const stats = await performTranslation(inputFilePath, outputFilePath, options, ({ completed, total }) => {
          setJob(jobId, { progress: { completed, total } });
          // Notify SSE subscribers
          const job = getJob(jobId);
          for (const res of job.clients) {
            res.write(`event: progress\n`);
            res.write(`data: ${JSON.stringify({ completed, total })}\n\n`);
          }
        });

        setJob(jobId, { status: 'done', stats });
        const job = getJob(jobId);
        for (const res of job.clients) {
          res.write(`event: done\n`);
          res.write(`data: ${JSON.stringify({ outputFileName, outputFilePath, stats })}\n\n`);
          res.end();
        }
        job.clients.clear();

        // Clean up input file
        setTimeout(() => { try { fs.unlinkSync(inputFilePath); } catch {} }, 60000);
      } catch (err) {
        setJob(jobId, { status: 'error', error: String(err?.message || err) });
        const job = getJob(jobId);
        for (const res of job.clients) {
          res.write(`event: error\n`);
          res.write(`data: ${JSON.stringify({ message: String(err?.message || err) })}\n\n`);
          res.end();
        }
        job.clients.clear();
      }
    })();

    res.json({ success: true, jobId, message: 'Job queued' });
  } catch (error) {
    log.error('[API Error]', error);
    res.status(500).json({ error: 'Translation enqueue failed', message: error.message });
  }
});

// Job status
app.get('/api/jobs/:id', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const { id, status, file, outputFileName, progress, error, stats, createdAt, updatedAt } = job;
  res.json({ id, status, file, outputFileName, progress, error, stats, createdAt, updatedAt });
});

// Job progress via Server-Sent Events (SSE)
app.get('/api/jobs/:id/events', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Register client
  job.clients.add(res);

  // Send initial state
  res.write(`event: status\n`);
  res.write(`data: ${JSON.stringify({ status: job.status, progress: job.progress })}\n\n`);

  req.on('close', () => {
    try { job.clients.delete(res); } catch {}
  });
});

// Job download (alias to existing download)
app.get('/api/jobs/:id/download', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status !== 'done') return res.status(409).json({ error: 'Job not completed' });
  const filePath = job.outputFilePath;
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Output file not found' });
  res.download(filePath, path.basename(filePath));
});

// Direct LLM ask (bypass translation pipeline)
// Body: { provider?, model?, systemInstruction?, prompt, temperature? }
app.post('/api/ask', async (req, res) => {
  try {
    const {
      provider: requestedProvider = DEFAULT_PROVIDER,
      model = DefaultOptions.createChatCompletionRequest.model,
      systemInstruction,
      prompt,
      temperature,
      stream = false,
    } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'prompt is required' });
    }

    const { openai, provider } = getLLMClients(String(requestedProvider).toLowerCase());
    const messages = [];
    if (systemInstruction) messages.push({ role: 'system', content: String(systemInstruction) });
    messages.push({ role: 'user', content: String(prompt) });

    if (stream) {
      // Minimal SSE streaming for parity; optional use
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders?.();
      try {
        const response = await openai.chat.completions.create({
          model,
          messages,
          stream: true,
          stream_options: { include_usage: true },
          ...(temperature !== undefined ? { temperature: Number(temperature) } : {}),
        });

        let usage;
        for await (const part of response) {
          const text = part.choices?.[0]?.delta?.content;
          if (text) {
            res.write(`event: delta\n`);
            res.write(`data: ${JSON.stringify({ delta: text })}\n\n`);
          }
          if (part.usage) usage = part.usage;
        }
        res.write(`event: done\n`);
        res.write(`data: ${JSON.stringify({ provider, model, usage })}\n\n`);
        res.end();
      } catch (err) {
        log.error('[API /api/ask stream error]', err);
        if (!res.headersSent) return res.status(500).json({ error: 'Ask failed', message: String(err?.message || err) });
        try { res.end(); } catch {}
      }
      return;
    }

    const completion = await openai.chat.completions.create({
      model,
      messages,
      stream: false,
      ...(temperature !== undefined ? { temperature: Number(temperature) } : {}),
    });

    const text = completion.choices?.[0]?.message?.content ?? '';
    const usage = completion.usage;
    res.json({ success: true, provider, model, text, usage });
  } catch (error) {
    log.error('[API /api/ask error]', error);
    res.status(500).json({ error: 'Ask failed', message: error.message });
  }
});
// Translate by path
app.post('/api/translate-path', async (req, res) => {
  try {
    const { inputPath, outputPath, ...options } = req.body || {};
    if (!inputPath) {
      return res.status(400).json({ error: 'inputPath is required' });
    }
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: 'Input file not found' });
    }

    const finalOutputPath = outputPath || `${path.parse(inputPath).dir}/${path.parse(inputPath).name}.out${path.extname(inputPath)}`;

    const sm = options.structuredMode;
    const normalizedStructuredMode = sm === 'array' ? 'array' : sm === 'object' ? 'object' : false;

    const translationOptions = {
      to: options.to || 'English',
      from: options.from,
      model: options.model,
      temperature: options.temperature,
      batchSizes: options.batchSizes,
      historyPromptLength: options.historyPromptLength,
      useModerator: options.useModerator !== false,
      prefixNumber: options.prefixNumber !== false,
      lineMatching: options.lineMatching !== false,
      systemInstruction: options.systemInstruction,
      structuredMode: normalizedStructuredMode,
      logLevel: options.logLevel || 'info',
      provider: (options.provider || DEFAULT_PROVIDER).toLowerCase(),
    };

    const stats = await performTranslation(inputPath, finalOutputPath, translationOptions);

    res.json({ success: true, message: 'Translation completed', outputFile: finalOutputPath, statistics: stats });
  } catch (error) {
    log.error('[API Error]', error);
    res.status(500).json({ error: 'Translation failed', message: error.message });
  }
});

// Download result
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join('uploads', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(filePath, filename, (err) => {
    if (err) {
      log.error('[Download Error]', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    }
  });
});

// Japanese word segmentation (wakachi-gaki) via LLM
// Input: { text: string, provider?, model?, temperature?, keepPunctuation? }
// Output: JSON array of strings (words) ONLY
app.post('/api/jp-tokenize', async (req, res) => {
  try {
    const { text, provider: requestedProvider = DEFAULT_PROVIDER, model = 'qwen2.5:7b', temperature, keepPunctuation = false, ollamaOptions } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }

    const { openai, provider } = getLLMClients(String(requestedProvider).toLowerCase());
    const sys = `You are a Japanese tokenizer performing wakachi-gaki (word segmentation).` +
      ` Given ONE Japanese sentence, output ONLY a JSON array of strings representing the words in order.` +
      ` ${keepPunctuation ? 'Include punctuation as separate tokens when present.' : 'Exclude punctuation symbols.'}` +
      ` Do not translate. Do not explain. Do not add keys or code fences. Reply with JSON only.`;

    /** @type {import('openai').OpenAI.Chat.ChatCompletionMessageParam[]} */
    const messages = [
      { role: 'system', content: sys },
      { role: 'user', content: text }
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages,
      stream: false,
      ...(temperature !== undefined ? { temperature: Number(temperature) } : { temperature: 0 }),
      ...(provider === 'ollama' && ollamaOptions && typeof ollamaOptions === 'object' ? { extra_body: { options: ollamaOptions } } : {})
    });

    let raw = completion.choices?.[0]?.message?.content ?? '';
    // Try strict JSON first
    const tryParse = (s) => {
      try { return JSON.parse(s); } catch { return undefined; }
    };
    let parsed = tryParse(raw);
    if (!parsed) {
      // Extract JSON array substring if model added extra text or code fences
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        parsed = tryParse(raw.slice(start, end + 1));
      }
    }
    if (!Array.isArray(parsed)) {
      return res.status(502).json({ error: 'Model did not return a JSON array', provider, model, raw });
    }

    // Ensure array of strings only
    const words = parsed.map((x) => (typeof x === 'string' ? x : String(x))).filter((s) => s.length > 0);
    res.json(words);
  } catch (error) {
    log.error('[API /api/jp-tokenize error]', error);
    res.status(500).json({ error: 'Tokenization failed', message: error.message });
  }
});

// Japanese tokenization with annotations (romanization + translation per word)
// Input: { text: string, provider?, model?, temperature?, keepPunctuation? }
// Output: JSON array of { word: string, romanization: string, translation: string }
app.post('/api/jp-tokenize-annotate', async (req, res) => {
  try {
    const { text, provider: requestedProvider = DEFAULT_PROVIDER, model = 'qwen2.5:7b', temperature, keepPunctuation = false, ollamaOptions } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }

    const { openai, provider } = getLLMClients(String(requestedProvider).toLowerCase());
    const sys = `You are a Japanese tokenizer and annotator.` +
      ` Perform wakachi-gaki (word segmentation) on ONE Japanese sentence and output ONLY a JSON array.` +
      ` Each element must be an object with keys: "word" (surface form), "romanization" (Hepburn romaji), "translation" (concise English gloss).` +
      ` ${keepPunctuation ? 'Include punctuation as separate tokens with romanization empty and translation as the symbol.' : 'Exclude punctuation symbols.'}` +
      ` Do not translate the whole sentence. Do not explain. Do not add keys other than word/romanization/translation. No code fences. Reply with JSON only.`;

    /** @type {import('openai').OpenAI.Chat.ChatCompletionMessageParam[]} */
    const messages = [
      { role: 'system', content: sys },
      { role: 'user', content: text }
    ];

    const completion = await openai.chat.completions.create({
      model,
      messages,
      stream: false,
      ...(temperature !== undefined ? { temperature: Number(temperature) } : { temperature: 0 }),
      ...(provider === 'ollama' && ollamaOptions && typeof ollamaOptions === 'object' ? { extra_body: { options: ollamaOptions } } : {})
    });

    let raw = completion.choices?.[0]?.message?.content ?? '';
    const tryParse = (s) => { try { return JSON.parse(s); } catch { return undefined; } };
    let parsed = tryParse(raw);
    if (!parsed) {
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start !== -1 && end !== -1 && end > start) {
        parsed = tryParse(raw.slice(start, end + 1));
      }
    }
    if (!Array.isArray(parsed)) {
      return res.status(502).json({ error: 'Model did not return a JSON array', provider, model, raw });
    }

    // Normalize objects and enforce fields
    const out = parsed.map((item) => {
      if (item && typeof item === 'object') {
        const word = String(item.word ?? item.term ?? item.surface ?? '').trim();
        const romanization = String(item.romanization ?? item.romaji ?? item.reading ?? '').trim();
        const translation = String(item.translation ?? item.gloss ?? item.meaning ?? '').trim();
        return { word, romanization, translation };
      }
      // If model returned plain strings, coerce
      return { word: String(item), romanization: '', translation: '' };
    }).filter((x) => x.word.length > 0);

    res.json(out);
  } catch (error) {
    log.error('[API /api/jp-tokenize-annotate error]', error);
    res.status(500).json({ error: 'Tokenization annotation failed', message: error.message });
  }
});

const PORT = parseInt(process.env.PORT || '5100', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Express server listening on http://${HOST}:${PORT}`);
  console.log(`Health: http://${HOST}:${PORT}/health`);
  console.log(`Upload: POST http://${HOST}:${PORT}/api/translate (multipart/form-data)`);
  console.log(`By Path: POST http://${HOST}:${PORT}/api/translate-path (application/json)`);
});
