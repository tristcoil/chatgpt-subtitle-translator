# Ollama + llama3.2:3b Quickstart

This guide shows how to run translations using a local Ollama model (llama3.2:3b) with the Express API in this repo.

## 1) Start Ollama in Docker

```bash
# Start Ollama server
docker run -d --name ollama \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  --gpus=all \
  ollama/ollama:latest

# Pull the model
docker exec -it ollama ollama pull llama3.2:3b
```

Notes:
- Remove `--gpus=all` if you don't have NVIDIA GPUs.
- Use smaller models for CPU-only setups.

## 2) Start the API with Ollama provider

```bash
PORT=5100 \
LLM_PROVIDER=ollama \
OLLAMA_OPENAI_BASE_URL=http://127.0.0.1:11434/v1 \
node server.js
```

Health check:
```bash
curl http://127.0.0.1:5100/health
```

## 3) Translate (sync)

```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@test/data/test_ja_small.srt" \
  -F "to=English" \
  -F "model=llama3.2:3b" \
  -F "provider=ollama"
```

The response includes `outputFileName`. Download it via:
```bash
FILENAME=$(curl -s -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@test/data/test_ja_small.srt" \
  -F "to=English" \
  -F "model=llama3.2:3b" \
  -F "provider=ollama" | jq -r '.outputFileName')
curl -O "http://127.0.0.1:5100/api/download/$FILENAME"
```

## 4) Translate (async)

```bash
curl -s -X POST http://127.0.0.1:5100/api/translate-async \
  -F "file=@test/data/test_ja_small.srt" \
  -F "to=English" \
  -F "model=llama3.2:3b" \
  -F "provider=ollama" | tee job.json

JOB_ID=$(jq -r '.jobId' job.json)
```

Subscribe to progress (SSE):
```bash
curl -N http://127.0.0.1:5100/api/jobs/$JOB_ID/events
```

Download when done:
```bash
curl -O "http://127.0.0.1:5100/api/jobs/$JOB_ID/download"
```

## Notes
- Moderation is disabled automatically with Ollama.
- Structured output is disabled by default for Ollama unless your adapter supports it.
- Ensure the model tag exists in the Ollama container: `docker exec -it ollama ollama list`.
