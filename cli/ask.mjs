#!/usr/bin/env node
import url from 'url'
import * as undici from 'undici'
import { Command, Option } from 'commander'
import log from 'loglevel'
import 'dotenv/config'

import { createOpenAIClient } from '../src/main.mjs'

function getProxyAgent() {
  const httpProxyConfig = process.env.http_proxy ?? process.env.HTTP_PROXY
  const httpsProxyConfig = process.env.https_proxy ?? process.env.HTTPS_PROXY
  if (httpProxyConfig || httpsProxyConfig) {
    log.debug('[CLI HTTP/HTTPS PROXY] Using proxy from ENV', { httpProxyConfig, httpsProxyConfig })
    return new undici.EnvHttpProxyAgent()
  }
  return undefined
}

function getClient(provider) {
  const key = (provider || process.env.LLM_PROVIDER || 'openai').toLowerCase()
  let baseURL, apiKey
  if (key === 'ollama') {
    baseURL = process.env.OLLAMA_OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1'
    apiKey = process.env.OLLAMA_OPENAI_API_KEY || 'sk-ollama'
  } else {
    baseURL = process.env.OPENAI_BASE_URL
    apiKey = process.env.OPENAI_API_KEY
  }
  const proxyAgent = getProxyAgent()
  const openai = createOpenAIClient(apiKey, undefined, baseURL, proxyAgent)
  return { openai, provider: key }
}

function buildProgram(argv) {
  const program = new Command()
    .description('Direct ask tool (bypass translation pipeline)')
    .addOption(new Option('--provider <provider>').choices(['openai', 'ollama']).default(process.env.LLM_PROVIDER || 'openai'))
    .requiredOption('-m, --model <model>', 'Model name (e.g., gpt-4o-mini, qwen3:8b)')
    .option('-s, --system <text>', 'System instruction')
    .option('-p, --prompt <text>', 'User prompt (if omitted, read from stdin)')
    .option('-t, --temperature <n>', 'Temperature', parseFloat)
    .option('--stream', 'Enable streaming output')
    .option('--log-level <level>', 'Log level', 'info')
    .parse(argv)
  return program
}

async function readStdin() {
  return await new Promise((resolve) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => (data += chunk))
    process.stdin.on('end', () => resolve(data))
    if (process.stdin.isTTY) resolve('')
  })
}

async function main(argv) {
  const program = buildProgram(argv)
  const opts = program.opts()
  log.setLevel(opts.logLevel)

  const { openai, provider } = getClient(opts.provider)
  const model = opts.model

  let prompt = opts.prompt
  if (!prompt) {
    const stdin = await readStdin()
    prompt = stdin.trim()
  }
  if (!prompt) {
    console.error('[ask] error: prompt is required (use --prompt or pipe stdin)')
    process.exit(1)
  }

  /** @type {import('openai').OpenAI.Chat.ChatCompletionMessageParam[]} */
  const messages = []
  if (opts.system) messages.push(/** @type {import('openai').OpenAI.Chat.ChatCompletionMessageParam} */({ role: 'system', content: String(opts.system) }))
  messages.push(/** @type {import('openai').OpenAI.Chat.ChatCompletionMessageParam} */({ role: 'user', content: String(prompt) }))

  if (opts.stream) {
    const resp = await openai.chat.completions.create({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...(opts.temperature !== undefined ? { temperature: Number(opts.temperature) } : {}),
    })
    let usage
    for await (const part of resp) {
      const text = part.choices?.[0]?.delta?.content
      if (text) process.stdout.write(text)
      if (part.usage) usage = part.usage
    }
    process.stdout.write('\n')
    if (usage && log.getLevel() <= log.levels.DEBUG) {
      console.error('[ask] usage', usage)
    }
    return
  }

  const completion = await openai.chat.completions.create({
    model,
    messages,
    stream: false,
    ...(opts.temperature !== undefined ? { temperature: Number(opts.temperature) } : {}),
  })
  const text = completion.choices?.[0]?.message?.content ?? ''
  process.stdout.write(text + '\n')
}

if (import.meta.url === url.pathToFileURL(process.argv[1]).href) {
  main(process.argv)
}
