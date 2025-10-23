# Build a minimal production image for the Node backend
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install only production deps
# Use npm ci if lockfile exists, otherwise fallback to npm install
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev; \
    else \
      npm install --omit=dev; \
    fi

# Copy source
COPY . .

# Expose port
EXPOSE 5100

# Environment defaults (can be overridden via compose)
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=5100 \
    LLM_PROVIDER=ollama \
    OLLAMA_OPENAI_BASE_URL=http://ollama:11434/v1 \
    LOG_LEVEL=info

# Start the server
CMD ["node", "server.js"]
