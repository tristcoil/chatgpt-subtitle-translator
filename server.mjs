#!/usr/bin/env node
import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';
import * as undici from 'undici';
import log from 'loglevel';

import {
    DefaultOptions,
    Translator,
    TranslatorStructuredObject,
    TranslatorStructuredArray,
    createOpenAIClient,
    CooldownContext,
    subtitleParser,
} from "./src/main.mjs";

import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup Express
const app = express();
app.use(express.json());

// Setup multer for file uploads
const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Create uploads directory if it doesn't exist
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Setup OpenAI client and cooldown contexts
function getProxyAgent() {
    const httpProxyConfig = process.env.http_proxy ?? process.env.HTTP_PROXY;
    const httpsProxyConfig = process.env.https_proxy ?? process.env.HTTPS_PROXY;

    if (httpProxyConfig || httpsProxyConfig) {
        log.debug("[API HTTP/HTTPS PROXY]", "Using HTTP/HTTPS Proxy from ENV Detected", { httpProxyConfig, httpsProxyConfig });
        const proxyAgent = new undici.EnvHttpProxyAgent();
        return proxyAgent;
    }

    return undefined;
}

const proxyAgent = getProxyAgent();
const openai = createOpenAIClient(process.env.OPENAI_API_KEY, undefined, process.env.OPENAI_BASE_URL, proxyAgent);
const coolerChatGPTAPI = new CooldownContext(Number(process.env.OPENAI_API_RPM ?? 60), 60000, "ChatGPTAPI");
const coolerOpenAIModerator = new CooldownContext(Number(process.env.OPENAI_API_RPM ?? process.env.OPENAI_API_MODERATOR_RPM ?? 60), 60000, "OpenAIModerator");

/**
 * Helper function to perform translation
 * @param {string} inputFilePath - Path to input file
 * @param {string} outputFilePath - Path to output file
 * @param {object} options - Translation options
 */
async function performTranslation(inputFilePath, outputFilePath, options = {}) {
    const {
        from = undefined,
        to = "English",
        model = DefaultOptions.createChatCompletionRequest.model,
        temperature = undefined,
        batchSizes = DefaultOptions.batchSizes,
        historyPromptLength = DefaultOptions.historyPromptLength,
        useModerator = true,
        prefixNumber = true,
        lineMatching = true,
        systemInstruction = undefined,
        structuredMode = false,
        logLevel = "info"
    } = options;

    // Set log level
    log.setLevel(logLevel);

    // Read input file
    const inputContent = fs.readFileSync(inputFilePath, 'utf8');
    const isSrtFile = inputFilePath.toLowerCase().endsWith('.srt');

    let lines;
    if (isSrtFile) {
        const srt = subtitleParser.fromSrt(inputContent);
        lines = srt.map(x => x.text);
    } else {
        lines = inputContent.split('\n');
    }

    // Create translator options
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

    // Create translator instance
    let translator;
    if (structuredMode === "array") {
        translator = new TranslatorStructuredArray(
            { from, to },
            {
                openai,
                cooler: coolerChatGPTAPI,
                ...(useModerator && {
                    moderationService: {
                        openai,
                        cooler: coolerOpenAIModerator
                    }
                })
            },
            translatorOptions
        );
    } else if (structuredMode === "object") {
        translator = new TranslatorStructuredObject(
            { from, to },
            {
                openai,
                cooler: coolerChatGPTAPI,
                ...(useModerator && {
                    moderationService: {
                        openai,
                        cooler: coolerOpenAIModerator
                    }
                })
            },
            translatorOptions
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
                        cooler: coolerOpenAIModerator
                    }
                })
            },
            translatorOptions
        );
    }

    // Override system instruction if provided
    if (systemInstruction) {
        translator.systemInstruction = systemInstruction;
    }

    // Perform translation
    if (isSrtFile) {
        const srt = subtitleParser.fromSrt(inputContent);
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

    // Return statistics
    const usage = translator.usage;
    return {
        promptTokensUsed: translator.promptTokensUsed,
        promptTokensWasted: translator.promptTokensWasted,
        cachedTokens: translator.cachedTokens,
        completionTokensUsed: translator.completionTokensUsed,
        completionTokensWasted: translator.completionTokensWasted,
        estimatedCost: usage.usedTokensPricing,
        linesTranslated: lines.length
    };
}

// API Routes

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'chatgpt-subtitle-translator' });
});

/**
 * Translate file endpoint with file upload
 * POST /api/translate
 * Body: multipart/form-data
 *   - file: SRT or text file to translate
 *   - to: target language (default: "English")
 *   - from: source language (optional)
 *   - model: OpenAI model to use (optional)
 *   - temperature: sampling temperature (optional)
 *   - structuredMode: "array" or "object" for structured output (optional)
 */
app.post('/api/translate', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const inputFilePath = req.file.path;
        const originalName = req.file.originalname;
        const outputFileName = `${path.parse(originalName).name}.out${path.extname(originalName)}`;
        const outputFilePath = path.join('uploads', outputFileName);

        // Extract options from request body
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
            structuredMode: req.body.structuredMode || false,
            logLevel: req.body.logLevel || 'info'
        };

        // Perform translation
        const stats = await performTranslation(inputFilePath, outputFilePath, options);

        // Return response with file path
        res.json({
            success: true,
            message: 'Translation completed',
            outputFile: outputFilePath,
            outputFileName: outputFileName,
            statistics: stats
        });

        // Clean up input file after a delay (to allow download if needed)
        setTimeout(() => {
            if (fs.existsSync(inputFilePath)) {
                fs.unlinkSync(inputFilePath);
            }
        }, 60000); // Clean up after 1 minute

    } catch (error) {
        log.error('[API Error]', error);
        res.status(500).json({ 
            error: 'Translation failed', 
            message: error.message 
        });
    }
});

/**
 * Translate file by path endpoint (for server-side files)
 * POST /api/translate-path
 * Body: JSON
 *   - inputPath: path to input file
 *   - outputPath: path to output file (optional, will be auto-generated if not provided)
 *   - to: target language (default: "English")
 *   - from: source language (optional)
 *   - model: OpenAI model to use (optional)
 *   - temperature: sampling temperature (optional)
 *   - structuredMode: "array" or "object" for structured output (optional)
 */
app.post('/api/translate-path', async (req, res) => {
    try {
        const { inputPath, outputPath, ...options } = req.body;

        if (!inputPath) {
            return res.status(400).json({ error: 'inputPath is required' });
        }

        if (!fs.existsSync(inputPath)) {
            return res.status(404).json({ error: 'Input file not found' });
        }

        // Generate output path if not provided
        const finalOutputPath = outputPath || 
            `${path.parse(inputPath).dir}/${path.parse(inputPath).name}.out${path.extname(inputPath)}`;

        // Set defaults
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
            structuredMode: options.structuredMode || false,
            logLevel: options.logLevel || 'info'
        };

        // Perform translation
        const stats = await performTranslation(inputPath, finalOutputPath, translationOptions);

        res.json({
            success: true,
            message: 'Translation completed',
            outputFile: finalOutputPath,
            statistics: stats
        });

    } catch (error) {
        log.error('[API Error]', error);
        res.status(500).json({ 
            error: 'Translation failed', 
            message: error.message 
        });
    }
});

/**
 * Download translated file
 * GET /api/download/:filename
 */
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join('uploads', filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    res.download(filePath, filename, (err) => {
        if (err) {
            log.error('[Download Error]', err);
            res.status(500).json({ error: 'Download failed' });
        }
    });
});

// Start server
const PORT = parseInt(process.env.PORT || '3000');
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    log.info(`ChatGPT Subtitle Translator API Server running on http://${HOST}:${PORT}`);
    log.info(`Health check: http://${HOST}:${PORT}/health`);
    log.info(`Upload endpoint: http://${HOST}:${PORT}/api/translate`);
    log.info(`Path endpoint: http://${HOST}:${PORT}/api/translate-path`);
});

export default app;
