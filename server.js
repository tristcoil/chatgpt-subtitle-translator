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
const openai = createOpenAIClient(process.env.OPENAI_API_KEY, undefined, process.env.OPENAI_BASE_URL, proxyAgent);
const coolerChatGPTAPI = new CooldownContext(Number(process.env.OPENAI_API_RPM ?? 60), 60000, 'ChatGPTAPI');
const coolerOpenAIModerator = new CooldownContext(Number(process.env.OPENAI_API_RPM ?? process.env.OPENAI_API_MODERATOR_RPM ?? 60), 60000, 'OpenAIModerator');

// Core translation helper
async function performTranslation(inputFilePath, outputFilePath, options = {}) {
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
  } = options;

  try { log.setLevel(/** @type {import('loglevel').LogLevelDesc} */ (logLevel)); } catch {}

  const inputContent = fs.readFileSync(inputFilePath, 'utf8');
  const isSrtFile = inputFilePath.toLowerCase().endsWith('.srt');

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
        cooler: coolerChatGPTAPI,
        ...(useModerator && {
          moderationService: {
            openai,
            cooler: coolerOpenAIModerator,
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
        cooler: coolerChatGPTAPI,
        ...(useModerator && {
          moderationService: {
            openai,
            cooler: coolerOpenAIModerator,
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
        cooler: coolerChatGPTAPI,
        ...(useModerator && {
          moderationService: {
            openai,
            cooler: coolerOpenAIModerator,
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
    for await (const output of translator.translateLines(lines)) {
      const srtEntry = srtArrayWorking[output.index - 1];
      srtEntry.text = output.finalTransform;
    }
    const outputSrt = subtitleParser.toSrt(srtArrayWorking);
    fs.writeFileSync(outputFilePath, outputSrt, 'utf8');
  } else {
    const translatedLines = [];
    for await (const output of translator.translateLines(lines)) {
      translatedLines.push(output.transform);
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

const PORT = parseInt(process.env.PORT || '5100', 10);
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Express server listening on http://${HOST}:${PORT}`);
  console.log(`Health: http://${HOST}:${PORT}/health`);
  console.log(`Upload: POST http://${HOST}:${PORT}/api/translate (multipart/form-data)`);
  console.log(`By Path: POST http://${HOST}:${PORT}/api/translate-path (application/json)`);
});
