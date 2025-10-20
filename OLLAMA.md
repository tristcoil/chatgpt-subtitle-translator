# Ollama Integration (Local LLM)

This project can run translations using a local Ollama model via its OpenAI-compatible API.

## Run Ollama in Docker

```bash
# Start Ollama with OpenAI-compatible API on :11434/v1
docker run -d --name ollama \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  --gpus=all \
  ollama/ollama:latest

# Pull a chat-capable model (examples)
# Choose one that fits your GPU/CPU and memory constraints
# llama3.2:3b (Meta), qwen2.5, mistral, phi3, etc.
docker exec -it ollama ollama pull llama3.2:3b
```

GPU flag is optional. Remove `--gpus=all` if you don't have NVIDIA GPUs.

## Start the API server using Ollama

```bash
# .env or inline environment variables
PORT=5100 \
LLM_PROVIDER=ollama \
OLLAMA_OPENAI_BASE_URL=http://127.0.0.1:11434/v1 \
node server.js
```

## Translate

```bash
# Upload and translate via multipart
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@test/data/test_ja_small.srt" \
  -F "to=English" \
  -F "model=llama3.2:3b" \
  -F "provider=ollama"

# Async job
curl -s -X POST http://127.0.0.1:5100/api/translate-async \
  -F "file=@test/data/test_ja_small.srt" \
  -F "to=English" \
  -F "model=llama3.2:3b" \
  -F "provider=ollama" | tee job.json

# Subscribe to progress
JOB_ID=$(jq -r '.jobId' job.json)
curl -N http://127.0.0.1:5100/api/jobs/$JOB_ID/events

# Download when done
curl -O "http://127.0.0.1:5100/api/jobs/$JOB_ID/download"
```

## Notes
- Moderation API is disabled automatically when provider=ollama.
- Structured output modes (array/object) are turned off unless your adapter supports it.
- Ensure the `model` is valid for your Ollama instance (e.g., `llama3.2:3b`, `qwen2.5`, `mistral`, `phi3`).
- For CPU-only systems, use smaller models.
- Costs are reported as 0 for local models; usage token counts may be unavailable.

## Troubleshooting
- If you see 404/501 errors on moderations, set `provider=ollama` so the API disables moderation.
- If streaming or structured output fails, disable `structuredMode` and `stream`.
- Confirm the endpoint: `curl http://127.0.0.1:11434/v1/models` should return a model list.
