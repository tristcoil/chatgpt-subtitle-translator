#!/usr/bin/env bash
# setup.sh — Start the Aukro Deal Finder n8n stack
# Run from the repo root: bash aukro_analyser/setup.sh

set -e
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "=== Aukro Deal Finder Setup ==="
echo ""

# 1. Build and start containers
echo "► Starting n8n + aukro-tool containers..."
docker compose -f docker-compose.n8n.yml up -d --build

echo ""
echo "► Waiting for n8n to be ready..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:5678/healthz > /dev/null 2>&1; then
    echo "  n8n is up!"
    break
  fi
  echo "  Waiting... ($i/30)"
  sleep 3
done

echo ""
echo "► Waiting for aukro-tool to be ready..."
for i in $(seq 1 20); do
  if curl -sf http://localhost:5050/health > /dev/null 2>&1; then
    echo "  aukro-tool is up!"
    break
  fi
  echo "  Waiting... ($i/20)"
  sleep 2
done

echo ""
echo "=== Setup Complete ==="
echo ""
echo "  n8n UI:         http://localhost:5678"
echo "  aukro-tool API: internal only (http://aukro-tool:5050 inside Docker)"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:5678 and complete n8n setup (create admin account)"
echo "  2. Go to Workflows → Import → upload aukro_analyser/n8n/workflow.json"
echo "  3. Open the workflow, set the Ollama credential:"
echo "     Settings → Credentials → New → Ollama → Base URL: http://ollama:11434"
echo "     (or if Ollama runs outside Docker: http://host.docker.internal:11434)"
echo "  4. Optionally add a notification node (Telegram/Email/Slack)"
echo "  5. Click 'Activate' to enable daily 8am runs"
echo "  6. Click 'Execute workflow' to test right now"
echo ""
echo "To stop: docker compose -f docker-compose.n8n.yml down"
echo "To view n8n logs: docker logs -f n8n"
echo "To view aukro-tool logs: docker logs -f aukro-tool"
