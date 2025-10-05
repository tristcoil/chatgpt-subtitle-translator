# Express API Server Documentation

This document describes the Express API server wrapper for the ChatGPT Subtitle Translator.

## Installation

First, install the required dependencies:

```bash
npm install express multer
```

## Setup

1. Configure your environment variables in `.env`:
   ```bash
   OPENAI_API_KEY=your_api_key_here
   OPENAI_API_RPM=500
   PORT=3000
   HOST=0.0.0.0
   ```

2. Start the server:
   ```bash
   node server.mjs
   # or
   npm start
   ```

The server will start on `http://0.0.0.0:3000` (or the configured PORT/HOST).

## API Endpoints

### Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "service": "chatgpt-subtitle-translator"
}
```

**Example:**
```bash
curl http://localhost:3000/health
```

---

### Translate File (Upload)

**POST** `/api/translate`

Upload and translate an SRT or text file.

**Content-Type:** `multipart/form-data`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `file` | File | Yes | - | SRT or text file to translate |
| `to` | String | No | "English" | Target language |
| `from` | String | No | - | Source language (optional) |
| `model` | String | No | "gpt-4o-mini" | OpenAI model to use |
| `temperature` | Number | No | - | Sampling temperature (0-2) |
| `batchSizes` | JSON Array | No | [10, 100] | Batch sizes for translation |
| `historyPromptLength` | Number | No | 10 | Length of prompt history |
| `useModerator` | Boolean | No | true | Use OpenAI moderation |
| `prefixNumber` | Boolean | No | true | Prefix lines with numbers |
| `lineMatching` | Boolean | No | true | Enforce line matching |
| `systemInstruction` | String | No | - | Custom system instruction |
| `structuredMode` | String | No | false | "array" or "object" for structured output |
| `logLevel` | String | No | "info" | Log level (trace, debug, info, warn, error, silent) |

**Response:**
```json
{
  "success": true,
  "message": "Translation completed",
  "outputFile": "uploads/filename.out.srt",
  "outputFileName": "filename.out.srt",
  "statistics": {
    "promptTokensUsed": 1234,
    "promptTokensWasted": 0,
    "cachedTokens": 500,
    "completionTokensUsed": 567,
    "completionTokensWasted": 0,
    "estimatedCost": 0.015,
    "linesTranslated": 100
  }
}
```

**Example (Basic):**
```bash
curl -X POST http://localhost:3000/api/translate \
  -F "file=@subtitle.srt" \
  -F "to=Spanish"
```

**Example (Advanced):**
```bash
curl -X POST http://localhost:3000/api/translate \
  -F "file=@subtitle.srt" \
  -F "to=French" \
  -F "from=English" \
  -F "model=gpt-4o-mini" \
  -F "temperature=0.3" \
  -F "structuredMode=array" \
  -F "logLevel=debug"
```

**Example (Node.js with fetch):**
```javascript
const formData = new FormData();
formData.append('file', fs.createReadStream('subtitle.srt'));
formData.append('to', 'Spanish');
formData.append('temperature', '0.3');

const response = await fetch('http://localhost:3000/api/translate', {
  method: 'POST',
  body: formData
});

const result = await response.json();
console.log(result);
```

**Example (Python):**
```python
import requests

files = {'file': open('subtitle.srt', 'rb')}
data = {
    'to': 'Spanish',
    'temperature': '0.3',
    'model': 'gpt-4o-mini'
}

response = requests.post('http://localhost:3000/api/translate', files=files, data=data)
print(response.json())
```

---

### Translate File (By Path)

**POST** `/api/translate-path`

Translate a file that already exists on the server.

**Content-Type:** `application/json`

**Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `inputPath` | String | Yes | - | Path to input file on server |
| `outputPath` | String | No | auto-generated | Path for output file |
| `to` | String | No | "English" | Target language |
| `from` | String | No | - | Source language (optional) |
| `model` | String | No | "gpt-4o-mini" | OpenAI model to use |
| `temperature` | Number | No | - | Sampling temperature (0-2) |
| `batchSizes` | Array | No | [10, 100] | Batch sizes for translation |
| `historyPromptLength` | Number | No | 10 | Length of prompt history |
| `useModerator` | Boolean | No | true | Use OpenAI moderation |
| `prefixNumber` | Boolean | No | true | Prefix lines with numbers |
| `lineMatching` | Boolean | No | true | Enforce line matching |
| `systemInstruction` | String | No | - | Custom system instruction |
| `structuredMode` | String | No | false | "array" or "object" for structured output |
| `logLevel` | String | No | "info" | Log level |

**Response:**
```json
{
  "success": true,
  "message": "Translation completed",
  "outputFile": "/path/to/output.srt",
  "statistics": {
    "promptTokensUsed": 1234,
    "promptTokensWasted": 0,
    "cachedTokens": 500,
    "completionTokensUsed": 567,
    "completionTokensWasted": 0,
    "estimatedCost": 0.015,
    "linesTranslated": 100
  }
}
```

**Example:**
```bash
curl -X POST http://localhost:3000/api/translate-path \
  -H "Content-Type: application/json" \
  -d '{
    "inputPath": "/path/to/subtitle.srt",
    "outputPath": "/path/to/output.srt",
    "to": "Spanish",
    "temperature": 0.3
  }'
```

**Example (Node.js):**
```javascript
const response = await fetch('http://localhost:3000/api/translate-path', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    inputPath: '/path/to/subtitle.srt',
    to: 'Spanish',
    model: 'gpt-4o-mini',
    temperature: 0.3
  })
});

const result = await response.json();
console.log(result);
```

---

### Download Translated File

**GET** `/api/download/:filename`

Download a translated file from the uploads directory.

**Parameters:**
- `filename` - Name of the file to download (from the `outputFileName` in the translate response)

**Example:**
```bash
curl -O http://localhost:3000/api/download/subtitle.out.srt
```

**Example (Browser):**
```
http://localhost:3000/api/download/subtitle.out.srt
```

---

## Error Responses

All endpoints return appropriate HTTP status codes and error messages:

**400 Bad Request:**
```json
{
  "error": "No file uploaded"
}
```

**404 Not Found:**
```json
{
  "error": "File not found"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Translation failed",
  "message": "Error details here"
}
```

---

## Translation Options Explained

### Model Selection
- `gpt-4o-mini` (default): Fast and cost-effective
- `gpt-4o`: More capable, higher cost
- `gpt-4-turbo`: Balance of speed and capability

### Temperature
- `0`: Deterministic output (recommended for translation)
- `0.3`: Slightly more creative while maintaining consistency
- `1.0`: Default, more creative but less consistent

### Structured Mode
- `false` (default): Standard translation
- `array`: More concise, structured array format
- `object`: Structured object format

### Batch Sizes
Array of increasing batch sizes, e.g., `[10, 100]`
- Larger batches = better context, more efficient
- Smaller batches = fallback when needed
- System automatically adjusts based on token limits

---

## Complete Usage Example

Here's a complete workflow:

```bash
# 1. Upload and translate
curl -X POST http://localhost:3000/api/translate \
  -F "file=@movie_subtitle.srt" \
  -F "to=Spanish" \
  -F "from=English" \
  -F "temperature=0.3" \
  -F "model=gpt-4o-mini" \
  > response.json

# 2. Extract the output filename
OUTPUT_FILE=$(cat response.json | jq -r '.outputFileName')

# 3. Download the translated file
curl -O "http://localhost:3000/api/download/$OUTPUT_FILE"
```

---

## Server Configuration

The server respects the following environment variables:

- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `OPENAI_API_RPM`: Rate limit in requests per minute (default: 60)
- `OPENAI_BASE_URL`: Custom OpenAI API base URL (optional)
- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: 0.0.0.0)
- `http_proxy` / `HTTP_PROXY`: HTTP proxy configuration (optional)
- `https_proxy` / `HTTPS_PROXY`: HTTPS proxy configuration (optional)

---

## File Management

- Uploaded files are stored in the `uploads/` directory
- Input files are automatically cleaned up after 1 minute
- Output files remain available for download
- Maximum file size: 10MB

---

## Integration Examples

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server.mjs"]
```

```bash
docker build -t subtitle-translator .
docker run -p 3000:3000 --env-file .env subtitle-translator
```

### systemd Service

Create `/etc/systemd/system/subtitle-translator.service`:

```ini
[Unit]
Description=ChatGPT Subtitle Translator API
After=network.target

[Service]
Type=simple
User=nodejs
WorkingDirectory=/opt/subtitle-translator
ExecStart=/usr/bin/node server.mjs
Restart=on-failure
Environment="NODE_ENV=production"
EnvironmentFile=/opt/subtitle-translator/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable subtitle-translator
sudo systemctl start subtitle-translator
```

---

## Performance Tips

1. **Use structured mode** for better token efficiency:
   ```bash
   -F "structuredMode=array"
   ```

2. **Set low temperature** for consistent translations:
   ```bash
   -F "temperature=0.3"
   ```

3. **Adjust batch sizes** based on your content:
   ```bash
   -F "batchSizes=[20,100]"
   ```

4. **Configure rate limits** appropriately:
   ```bash
   OPENAI_API_RPM=500
   ```

---

## Troubleshooting

### "No file uploaded" error
- Ensure you're using `multipart/form-data` content type
- Check that the form field name is `file`

### Translation takes too long
- Increase `OPENAI_API_RPM` if you have higher rate limits
- Use `gpt-4o-mini` for faster processing
- Consider smaller batch sizes for very large files

### "File not found" error
- Check that the input path exists and is accessible
- Verify file permissions

### High token usage
- Enable structured mode: `structuredMode=array`
- Reduce `historyPromptLength` if context is not critical
- Use appropriate batch sizes

---

## Security Considerations

⚠️ **Important Security Notes:**

1. **API Key Protection**: Never expose your API key. Use environment variables.
2. **File Upload Limits**: The server enforces a 10MB file size limit.
3. **Path Traversal**: The `/api/translate-path` endpoint should only be used in trusted environments.
4. **Production Deployment**: 
   - Use a reverse proxy (nginx/Apache) in front of Express
   - Implement authentication/authorization
   - Enable HTTPS
   - Set up rate limiting
   - Monitor usage and costs

---

## Cost Estimation

The API returns token usage statistics. Example costs (approximate):

- **gpt-4o-mini**: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **gpt-4o**: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens

For a typical 2-hour movie subtitle (~1000 lines):
- Input: ~10K tokens
- Output: ~10K tokens
- Cost with gpt-4o-mini: ~$0.01 - $0.02

Monitor the `estimatedCost` field in API responses to track expenses.
