# Qwen3 Models for Japanese→English Translation

Qwen3 is the latest generation (2025) of Qwen models with significantly improved reasoning, multilingual capabilities, and natural language generation. This guide covers the best Qwen3 models for subtitle/song translation on a 16GB RAM system.



run daemon as 
```
coil@coil-VM:chatgpt-subtitle-translator$ docker run -it --name ollama   -p 11434:11434   -v ollama:/root/.ollama  ollama/ollama:latest
```








## Why Qwen3 Over Qwen2.5

- ✅ **Latest generation** - Released 2025, state-of-the-art architecture
- ✅ **Superior reasoning** - Better logical thinking and context understanding
- ✅ **Enhanced multilingual** - Improved performance on 100+ languages including Japanese
- ✅ **More natural output** - Better human preference alignment for creative writing
- ✅ **Longer context windows** - 40K-256K tokens (vs typical 32K in older models)
- ✅ **Better instruction following** - More reliable at following system prompts

## Recommended Models for 16GB RAM

### 1. qwen3:14b ⭐ RECOMMENDED

**Best overall choice for 16GB systems**

**Specs:**
- Parameters: 14 billion
- Download size: 9.3 GB
- RAM usage: ~10-11 GB
- Context window: 40K tokens
- Speed: Medium
- Quality: Excellent

**Pull command:**
```bash
docker exec -it ollama ollama pull qwen3:14b
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=qwen3:14b" \
  -F "provider=ollama" \
  -F "temperature=0" \
  -F 'systemInstruction=Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.'
```

---

### 2. qwen3:8b (Balanced Speed/Quality)

**Faster alternative with excellent quality**

**Specs:**
- Parameters: 8 billion
- Download size: 5.2 GB
- RAM usage: ~6-7 GB
- Context window: 40K tokens
- Speed: Fast
- Quality: Very Good

**Pull command:**
```bash
docker exec -it ollama ollama pull qwen3:8b
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=qwen3:8b" \
  -F "provider=ollama" \
  -F "temperature=0" \
  -F 'systemInstruction=Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.'
```

---

### 3. qwen3:4b (Surprisingly Powerful)

**Rivals qwen2.5:72b performance in a tiny package**

**Specs:**
- Parameters: 4 billion
- Download size: 2.5 GB
- RAM usage: ~3-4 GB
- Context window: **256K tokens** (massive!)
- Speed: Very Fast
- Quality: Very Good (punches above its weight)

**Pull command:**
```bash
docker exec -it ollama ollama pull qwen3:4b
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=qwen3:4b" \
  -F "provider=ollama" \
  -F "temperature=0" \
  -F 'systemInstruction=Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.'
```

---

### 4. qwen3:30b (Maximum Quality)

**Best quality that fits in 16GB RAM**

**Specs:**
- Parameters: 30 billion
- Download size: 19 GB
- RAM usage: ~13-14 GB (uses most of your 16GB)
- Context window: **256K tokens**
- Speed: Slow
- Quality: Excellent (near GPT-4 level)

**Pull command:**
```bash
docker exec -it ollama ollama pull qwen3:30b
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=qwen3:30b" \
  -F "provider=ollama" \
  -F "temperature=0" \
  -F 'systemInstruction=Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.'
```

---

### 5. qwen3:1.7b (Ultra-Fast Testing)

**Blazing fast for quick iterations**

**Specs:**
- Parameters: 1.7 billion
- Download size: 1.4 GB
- RAM usage: ~2 GB
- Context window: 40K tokens
- Speed: Extremely Fast
- Quality: Fair (good for testing pipelines)

**Pull command:**
```bash
docker exec -it ollama ollama pull qwen3:1.7b
```

**Test with bansanka.srt:**
```bash
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "to=English" \
  -F "from=Japanese" \
  -F "model=qwen3:1.7b" \
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

| Model | Size | Download | RAM | Context | Speed | Quality | Best For |
|-------|------|----------|-----|---------|-------|---------|----------|
| **qwen3:14b** ⭐ | 14B | 9.3 GB | ~11 GB | 40K | Medium | Excellent | General use |
| qwen3:8b | 8B | 5.2 GB | ~7 GB | 40K | Fast | Very Good | Speed priority |
| qwen3:4b | 4B | 2.5 GB | ~4 GB | 256K | Very Fast | Very Good | Budget/speed |
| qwen3:30b | 30B | 19 GB | ~14 GB | 256K | Slow | Excellent | Max quality |
| qwen3:1.7b | 1.7B | 1.4 GB | ~2 GB | 40K | Ultra Fast | Fair | Quick tests |

## All Available Qwen3 Models

For reference, here's the complete lineup:

```bash
# Small models
docker exec -it ollama ollama pull qwen3:0.6b    # 523 MB
docker exec -it ollama ollama pull qwen3:1.7b    # 1.4 GB

# Medium models (recommended range)
docker exec -it ollama ollama pull qwen3:4b      # 2.5 GB
docker exec -it ollama ollama pull qwen3:8b      # 5.2 GB
docker exec -it ollama ollama pull qwen3:14b     # 9.3 GB

# Large models (requires more RAM or careful management)
docker exec -it ollama ollama pull qwen3:30b     # 19 GB
docker exec -it ollama ollama pull qwen3:32b     # 20 GB

# Ultra-large (not recommended for 16GB systems)
docker exec -it ollama ollama pull qwen3:235b    # 142 GB (!) - needs 96GB+ RAM
```

## Download Strategy for Testing

### Recommended Starting Set (26 GB total)
```bash
# Best overall
docker exec -it ollama ollama pull qwen3:14b

# Fast alternative
docker exec -it ollama ollama pull qwen3:8b

# Surprising quality/speed
docker exec -it ollama ollama pull qwen3:4b

# For maximum quality (if you have time/disk space)
docker exec -it ollama ollama pull qwen3:30b
```

### Quick Test Set (18 GB total)
```bash
# Start with these three
docker exec -it ollama ollama pull qwen3:14b
docker exec -it ollama ollama pull qwen3:8b
docker exec -it ollama ollama pull qwen3:4b
```

### Minimal Test (9.3 GB)
```bash
# Just the recommended one
docker exec -it ollama ollama pull qwen3:14b
```

## Testing Workflow

### 1. Download Models
```bash
# Download your chosen models
docker exec -it ollama ollama pull qwen3:14b
docker exec -it ollama ollama pull qwen3:8b

# Verify
docker exec -it ollama ollama list
```

### 2. Start Server
```bash
PORT=5100 \
LLM_PROVIDER=ollama \
OLLAMA_OPENAI_BASE_URL=http://127.0.0.1:11434/v1 \
node server.js
```

### 3. Test Each Model
Run the curl commands above for each model and save outputs:

```bash
# Test qwen3:14b
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "model=qwen3:14b" \
  -F "provider=ollama" \
  -F "temperature=0" \
  [...] > output_qwen3_14b.srt

# Test qwen3:8b
curl -X POST http://127.0.0.1:5100/api/translate \
  -F "file=@songs/raon_bansanka.srt" \
  -F "model=qwen3:8b" \
  -F "provider=ollama" \
  -F "temperature=0" \
  [...] > output_qwen3_8b.srt
```

### 4. Compare Results
```bash
# Side-by-side comparison
diff output_qwen3_14b.srt output_qwen3_8b.srt

# Or manually review the files
```

## Key Features of Qwen3

### Enhanced Reasoning
- Better at understanding context and nuance
- Improved logical consistency in translations
- Better handling of idioms and cultural expressions

### Superior Multilingual Performance
- Trained on 100+ languages with balanced quality
- Excellent Japanese understanding
- Natural English generation

### Better Instruction Following
- More reliable at adhering to system prompts
- Less likely to add unwanted commentary
- Preserves formatting better

### Mixture of Experts (MoE) Architecture
- qwen3:30b uses MoE (activates 3B params per token)
- More efficient than dense models
- Better quality per compute used

## System Instruction Tips for Qwen3

### For Songs/Lyrics (Recommended)
```
Translate Japanese to English naturally and idiomatically.
This is a song translation - preserve emotion, tone, and cultural context where possible.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.
```

### For Literal Translation
```
Translate Japanese to English literally and accurately.
Maintain the exact meaning without creative interpretation.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.
```

### For Casual/Colloquial Content
```
Translate Japanese to English in a natural, conversational style.
Use casual language where appropriate.
Output ONLY the translation for each input line.
Do not explain, do not comment, do not add numbering.
Preserve the number of lines and their order.
```

## Performance Optimization

### Temperature Settings
- **0**: Deterministic, consistent (recommended for subtitles)
- **0.1-0.3**: Slight variation, still reliable
- **0.5-0.7**: More creative (use for poetry/songs if needed)

### Batch Size Tuning
For Qwen3 models, the default `batchSizes=[10,100]` works well:
- qwen3:4b, 8b: Can handle larger batches (up to 100 lines)
- qwen3:14b: Works well with default
- qwen3:30b: Consider smaller batches (50-75) if you see slowdowns

### Memory Management
```bash
# Monitor Docker resource usage
docker stats ollama

# If you hit OOM, try smaller model or restart Docker
docker restart ollama
```

## Troubleshooting

### Model Won't Load
```bash
# Check available disk space
df -h

# Check Ollama container status
docker ps

# Restart container if needed
docker restart ollama
```

### Slow Inference
- Switch to smaller model (qwen3:8b or 4b)
- Reduce batch sizes in translation options
- Ensure no other heavy processes running
- Check `docker stats ollama` for resource limits

### Poor Translation Quality
- qwen3:4b and above should be good; if not:
  - Try qwen3:14b or 30b
  - Adjust system instruction for more context
  - Set temperature to 0 for consistency
  - Ensure `from=Japanese` is specified

### Out of Memory (OOM)
- Use smaller model
- Restart Docker: `docker restart ollama`
- Close other applications
- Consider qwen3:8b or 4b instead of 30b

## Comparing Qwen3 vs Qwen2.5

| Feature | Qwen2.5 | Qwen3 |
|---------|---------|-------|
| Release | 2024 | 2025 |
| Architecture | Dense | Dense + MoE |
| Context Window | 32K typical | 40K-256K |
| Reasoning | Good | Excellent |
| Multilingual | Good | Superior |
| Instruction Following | Good | Better |
| Natural Output | Good | More Natural |
| **Recommendation** | Still solid | Preferred |

## Final Recommendations

### For Most Users
**Start with qwen3:14b** - Best balance of quality, speed, and RAM usage.

### For Speed Priority
**Use qwen3:8b** - Fast and still high quality.

### For Budget Systems
**Try qwen3:4b** - Surprisingly good, very fast, huge context window.

### For Maximum Quality
**Use qwen3:30b** - Best quality that fits in 16GB (barely).

### For Testing/Development
**Use qwen3:1.7b** - Ultra-fast iterations while developing your pipeline.

## Resources

- Official Qwen3 announcement: [Qwen Blog](https://qwenlm.github.io/)
- Ollama Qwen3 page: https://ollama.com/library/qwen3
- Model benchmarks: Check HuggingFace model cards
- This project's quickstart: `docs/ollama-llama3.2-quickstart.md`

---

**All commands are ready to copy-paste for immediate testing!**
