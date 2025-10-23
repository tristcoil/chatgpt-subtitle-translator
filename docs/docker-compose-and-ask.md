# Deploy with Docker Compose + Direct Ask API

This guide shows how to run both Ollama and the subtitle translator backend with Docker Compose, reuse your previously-downloaded Ollama models, and call the new direct ask endpoint with curl.

## What’s included

- `docker-compose.yml` — starts two services:
  - `ollama`: Ollama server at http://localhost:11434 using the existing Docker volume `ollama` (models are preserved)
  - `app`: Node backend at http://localhost:5100
- `Dockerfile` — production image for the backend (`subtitle-translator:latest`)
- `.dockerignore` — keeps images small

## Prerequisites

- Docker + Docker Compose
- (Optional) Existing Docker volume named `ollama` that already contains your models

If the `ollama` volume does not exist yet:

```bash
docker volume create ollama
```

## Build and start

```bash
# From the repo root
docker compose build

docker compose up -d
```

Check containers:

```bash
docker ps
```

Tail logs:

```bash
docker compose logs -f app
# and/or
docker compose logs -f ollama
```

## Verify services

Backend health:

```bash
curl http://127.0.0.1:5100/health
```

List Ollama models (should show the ones already in your `ollama` volume):

```bash
docker exec -it ollama ollama list
```

Pull an additional model if needed (example: Qwen3 8B):

```bash
docker exec -it ollama ollama pull qwen3:8b
```

## Call the new direct ask endpoint

Non-streamed (returns JSON with the answer in `text`):

```bash
curl -sS -X POST http://127.0.0.1:5100/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "qwen3:8b",
    "systemInstruction": "You are a helpful translator.",
    "prompt": "Translate: これはテストです。",
    "temperature": 0
  }'
```

Streaming (SSE; prints partial deltas):

```bash
curl -N -sS -X POST http://127.0.0.1:5100/api/ask \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "qwen3:8b",
    "prompt": "Explain what Ollama is in one sentence.",
    "stream": true,
    "temperature": 0
  }'
```

Notes
- `provider` defaults to your backend’s `LLM_PROVIDER` (set to `ollama` in compose). You can omit it if you keep that default.
- `model` can be any Ollama tag you’ve pulled (e.g., `qwen3:4b`, `qwen3:14b`, `llama3.2:3b`).
- `systemInstruction` is optional; `prompt` is required.

## Translate endpoint (for SRT or text)

SRT example (non-stream, returns JSON with output file path):

```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@./test/data/test_ja_small.srt" \
  -F "from=Japanese" \
  -F "to=English" \
  -F "provider=ollama" \
  -F "model=qwen3:8b" \
  -F "temperature=0"
```

Async variant (returns `jobId` immediately):

```bash
curl -s -X POST http://127.0.0.1:5100/api/translate-async \
  -F "file=@./test/data/test_ja_small.srt" \
  -F "from=Japanese" \
  -F "to=English" \
  -F "provider=ollama" \
  -F "model=qwen3:8b" \
  -F "temperature=0" | tee job.json

JOB_ID=$(jq -r '.jobId' job.json)

# Watch progress (Server-Sent Events)
curl -N http://127.0.0.1:5100/api/jobs/$JOB_ID/events

# Download when done
curl -O "http://127.0.0.1:5100/api/jobs/$JOB_ID/download"
```

## How the Ollama volume is reused

Your previous model downloads are in a Docker volume named `ollama`. The compose file mounts that volume into `/root/.ollama` of the `ollama` service:

```yaml
volumes:
  - ollama:/root/.ollama
```

And declares it as an external named volume to ensure Compose uses the existing one instead of creating a new project-scoped volume:

```yaml
volumes:
  ollama:
    external: true
    name: ollama
```

This preserves your previously downloaded models across rebuilds and `docker compose up` runs.

## Optional: GPU notes

If you have an NVIDIA GPU and a recent Docker/Compose that supports device reservations, you can adapt the `ollama` service for GPU acceleration using the Docker docs for GPU in Compose. If that’s not available on your setup, keep using CPU in Compose, or run Ollama separately with:

```bash
docker run -d --name ollama --gpus=all -p 11434:11434 -v ollama:/root/.ollama ollama/ollama:latest
```

In that case, ensure your backend can reach Ollama (adjust `OLLAMA_OPENAI_BASE_URL` if needed).

## Troubleshooting

- "external volume 'ollama' not found":
  - Create it once: `docker volume create ollama`
- Port conflicts (11434 or 5100 already in use):
  - Stop the conflicting service or change the published port in `docker-compose.yml`
- No models available:
  - Pull them: `docker exec -it ollama ollama pull qwen3:8b`
- Backend errors:
  - Check logs: `docker compose logs -f app`
  - Health: `curl http://127.0.0.1:5100/health`
