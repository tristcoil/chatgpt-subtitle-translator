# Ollama Model Recommendations for Japanese→English Translation

This guide covers the best Ollama models for subtitle/song translation on a 16GB RAM Linux system.

## System Requirements

- **RAM**: 16GB recommended
- **OS**: Linux (tested)
- **Ollama**: Running in Docker with OpenAI-compatible API
- **Use case**: Japanese→English subtitle/song translation

## Top Model Recommendations

### 1. qwen2.5:14b (Best Quality for 16GB) ⭐ RECOMMENDED

**Why Choose This:**
- Specifically trained on multilingual data including CJK (Chinese, Japanese, Korean)
- Excellent at context, idioms, and natural English phrasing
- Fits comfortably in 16GB RAM with room to spare

**Specs:**
- Parameters: 14 billion
- RAM usage: ~9-10GB
- Speed: Medium
- Quality: Excellent
- Japanese support: ⭐⭐⭐⭐⭐

**Pull command:**
```bash
docker exec -it ollama ollama pull qwen2.5:14b
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=qwen2.5:14b" \
  -F "provider=ollama" \
  -F "temperature=0" \
  -F 'systemInstruction=Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.'
```

---

### 2. qwen2.5:7b (Balanced Speed/Quality)

**Why Choose This:**
- Smaller sibling of 14b, still very capable
- Faster inference, lower memory footprint
- Good for quick iterations and batch processing

**Specs:**
- Parameters: 7 billion
- RAM usage: ~5-6GB
- Speed: Fast
- Quality: Very Good
- Japanese support: ⭐⭐⭐⭐

**Pull command:**
```bash
docker exec -it ollama ollama pull qwen2.5:7b
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=qwen2.5:7b" \
  -F "provider=ollama" \
  -F "temperature=0" \
  -F 'systemInstruction=Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.'
```

---

### 3. gemma2:9b (Google's Multilingual Model)

**Why Choose This:**
- Google's Gemma 2 with strong multilingual capabilities
- Produces clean, fluent English output
- Excellent instruction following

**Specs:**
- Parameters: 9 billion
- RAM usage: ~6-7GB
- Speed: Medium
- Quality: Very Good
- Japanese support: ⭐⭐⭐⭐

**Pull command:**
```bash
docker exec -it ollama ollama pull gemma2:9b
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=gemma2:9b" \
  -F "provider=ollama" \
  -F "temperature=0" \
  -F 'systemInstruction=Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.'
```

---

### 4. command-r:35b (Maximum Quality - Quantized)

**Why Choose This:**
- Cohere's Command-R with excellent instruction following
- Best naturalness and context understanding
- Q4 quantization makes it fit in 16GB

**Specs:**
- Parameters: 35 billion (quantized)
- RAM usage: ~14-15GB
- Speed: Slow
- Quality: Excellent
- Japanese support: ⭐⭐⭐⭐⭐

**Pull command:**
```bash
docker exec -it ollama ollama pull command-r:35b-q4_K_M
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=command-r:35b-q4_K_M" \
  -F "provider=ollama" \
  -F "temperature=0" \
  -F 'systemInstruction=Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.'
```

---

### 5. aya:35b (Specialized Multilingual - Quantized)

**Why Choose This:**
- Purpose-built for multilingual translation
- Covers 100+ languages including Japanese
- Designed specifically for translation tasks

**Specs:**
- Parameters: 35 billion (quantized)
- RAM usage: ~14GB
- Speed: Slow
- Quality: Excellent
- Japanese support: ⭐⭐⭐⭐⭐

**Pull command:**
```bash
docker exec -it ollama ollama pull aya:35b-q4_K_M
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=aya:35b-q4_K_M" \
  -F "provider=ollama" \
  -F "temperature=0" \
  -F 'systemInstruction=Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.'
```

---

### 6. llama3.2:3b (Baseline - Fast but Basic)

**Why Choose This:**
- Very fast, minimal RAM usage
- Good for testing and development
- Not recommended for production quality translations

**Specs:**
- Parameters: 3 billion
- RAM usage: ~3GB
- Speed: Very Fast
- Quality: Fair
- Japanese support: ⭐⭐⭐

**Pull command:**
```bash
docker exec -it ollama ollama pull llama3.2:3b
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=llama3.2:3b" \
  -F "provider=ollama" \
  -F "temperature=0" \
  -F 'systemInstruction=Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.'
```

---

## Quick Comparison Table

| Model | Size | RAM | Speed | Quality | Japanese Support | Best For |
|-------|------|-----|-------|---------|------------------|----------|
| **qwen2.5:14b** ⭐ | 14B | ~10GB | Medium | Excellent | ⭐⭐⭐⭐⭐ | General use |
| qwen2.5:7b | 7B | ~6GB | Fast | Very Good | ⭐⭐⭐⭐ | Speed priority |
| gemma2:9b | 9B | ~7GB | Medium | Very Good | ⭐⭐⭐⭐ | Clean output |
| command-r:35b-q4 | 35B | ~14GB | Slow | Excellent | ⭐⭐⭐⭐⭐ | Max quality |
| aya:35b-q4 | 35B | ~14GB | Slow | Excellent | ⭐⭐⭐⭐⭐ | Translation focus |
| llama3.2:3b | 3B | ~3GB | Very Fast | Fair | ⭐⭐⭐ | Testing only |

## Testing Workflow

### 1. Pull Multiple Models

```bash
# Recommended set for testing
docker exec -it ollama ollama pull qwen2.5:14b
docker exec -it ollama ollama pull qwen2.5:7b
docker exec -it ollama ollama pull gemma2:9b

# Check what you have
docker exec -it ollama ollama list
```

### 2. Start the Server

```bash
PORT=5100 \
LLM_PROVIDER=ollama \
OLLAMA_OPENAI_BASE_URL=http://127.0.0.1:11434/v1 \
node server.js
```

### 3. Test Each Model

Run the curl commands above for each model and compare the outputs.

### 4. Compare Results

```bash
# Example: Compare two outputs
diff uploads/raon_bansanka.out.srt.qwen14b uploads/raon_bansanka.out.srt.qwen7b
```

## System Instruction Tips

### For Songs/Lyrics
```
Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.
```

### For Dialogue/Subtitles
```
Translate Japanese to English conversationally.
Preserve natural speaking patterns and casual language where appropriate.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.
```

### For Formal/Technical Content
```
Translate Japanese to English accurately and formally.
Maintain technical terminology and precise meaning.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.
```

## Performance Tuning

### Temperature Settings
- **0**: Deterministic, consistent (recommended for subtitles)
- **0.3**: Slight creativity (good for songs with poetic language)
- **0.7**: More creative (use sparingly, can deviate from meaning)

### Batch Processing Tips
- Default batch sizes: `[10, 100]` work well for most models
- For larger models (35B), consider smaller batches to avoid timeouts
- Monitor RAM usage: `docker stats ollama`

## Troubleshooting

### Model Won't Load (OOM Error)
- Try a smaller model (qwen2.5:7b instead of 14b)
- Use quantized versions (Q4 or Q5)
- Close other applications to free RAM

### Slow Inference
- Switch to smaller model (7b or 9b)
- Reduce batch sizes in request
- Ensure Docker has enough CPU allocation

### Poor Translation Quality
- Try qwen2.5:14b or command-r:35b-q4
- Adjust system instruction for context
- Set temperature to 0 for consistency
- Ensure `from=Japanese` is specified

## Resources

- Ollama Models: https://ollama.com/search
- Model cards on HuggingFace for detailed specs
- This project's docs: `docs/ollama-llama3.2-quickstart.md`

## Recommendation Summary

**Start with**: `qwen2.5:14b` - Best balance of quality, speed, and RAM usage for 16GB systems.

**If you need speed**: `qwen2.5:7b` - Still good quality, much faster.

**If you want maximum quality**: `command-r:35b-q4_K_M` or `aya:35b-q4_K_M` - Best results but slower.

All commands are ready to copy-paste for testing!
