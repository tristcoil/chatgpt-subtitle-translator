# Japanese Tokenization API (wakachi-gaki)

This document describes the direct Japanese word segmentation endpoint that uses your selected LLM (default: `qwen2.5:7b` on Ollama) to split a single Japanese sentence into individual words and return ONLY a JSON array.

- Endpoint: `POST /api/jp-tokenize`
- Default provider: `ollama`
- Default model: `qwen2.5:7b`
- Output: JSON array of strings

## Contract

Request (application/json):

```json
{
  "text": "今日は雨だけど、午後には晴れるかもしれないね。",
  "provider": "ollama",            // optional, defaults to env LLM_PROVIDER
  "model": "qwen2.5:7b",           // optional, defaults to qwen2.5:7b
  "temperature": 0,                  // optional, default 0
  "keepPunctuation": false           // optional: false (exclude punctuation) | true (include punctuation as tokens)
}
```

Successful response:

```json
["今日","は","雨","だけど","午後","に","は","晴れる","かも","しれない","ね"]
```

---

## Tokenization with annotations (romanization + translation)

- Endpoint: `POST /api/jp-tokenize-annotate`
- Output: JSON array of objects with keys: `word`, `romanization` (Hepburn), `translation` (concise English)

### Contract

Request (application/json):

```json
{
  "text": "今日は雨だけど、午後には晴れるかもしれないね。",
  "provider": "ollama",            // optional
  "model": "qwen2.5:7b",           // optional, default qwen2.5:7b
  "temperature": 0,                  // optional, default 0
  "keepPunctuation": false           // optional: include/exclude punctuation
}
```

Response example:

```json
[
  { "word": "今日", "romanization": "kyou", "translation": "today" },
  { "word": "は", "romanization": "wa", "translation": "topic" },
  { "word": "雨", "romanization": "ame", "translation": "rain" },
  { "word": "だけど", "romanization": "dakedo", "translation": "but" },
  { "word": "午後", "romanization": "gogo", "translation": "afternoon" },
  { "word": "に", "romanization": "ni", "translation": "in/at" },
  { "word": "は", "romanization": "wa", "translation": "topic" },
  { "word": "晴れる", "romanization": "hareru", "translation": "clear up" },
  { "word": "かも", "romanization": "kamo", "translation": "might" },
  { "word": "しれない", "romanization": "shirenai", "translation": "not sure" },
  { "word": "ね", "romanization": "ne", "translation": "right/you know" }
]
```

### Example calls

Exclude punctuation:

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize-annotate \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:7b",
    "text":"今日は雨だけど、午後には晴れるかもしれないね。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }'
```

Include punctuation (punctuation items may have empty romanization and translation as the symbol):

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize-annotate \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:7b",
    "text":"新型スマホのカメラ性能がすごく良くて、びっくりした！",
    "keepPunctuation": true,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }'
```

### Notes

- The server enforces JSON-only output and attempts to extract a JSON array if the model adds extra text or code fences.
- Field normalization: if the model uses variants like `romaji`/`reading` or `gloss`/`meaning`, the server maps them to `romanization` and `translation`.
- For deterministic output, keep `temperature: 0`.

Error responses:
- 400: Missing/invalid `text`
- 502: Model reply could not be parsed into a JSON array (returns raw model output to help diagnose)
- 500: Unexpected server error

## Usage Examples

### Performance: more CPU threads (Ollama)

When using the Ollama provider, you can pass native options (like num_thread) through the field ollamaOptions. Our server uses the OpenAI-compatible API with stream disabled by default, so responses are single JSON payloads.

Tokenize only (/api/jp-tokenize) with 8 threads:

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:7b",
    "text":"短いテキストで速度テスト。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }' | jq '.'
```

Tokenize + annotations (/api/jp-tokenize-annotate) with 8 threads:

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize-annotate \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:7b",
    "text":"短いテキストで速度テスト。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }' | jq '.'
```

### 1) Basic (exclude punctuation)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:7b",
    "text":"今日は雨だけど、午後には晴れるかもしれないね。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }'
```

#### With qwen2.5:14b (exclude punctuation)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize-annotate \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:14b",
    "text":"来週のプレゼンに向けて、資料を準備しています。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }'
```

#### With qwen2.5:14b (keep punctuation)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize-annotate \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:14b",
    "text":"彼は『絶対に諦めない！』と言った。",
    "keepPunctuation": true,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }'
```

### Notes
Example response:
```json
["今日","は","雨","だけど","午後","に","は","晴れる","かも","しれない","ね"]
```

### 2) Keep punctuation as tokens

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:7b",
    "text":"新型スマホのカメラ性能がすごく良くて、びっくりした！",
    "keepPunctuation": true,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }'
```

Example response:
```json
["新型","スマホ","の","カメラ","性能","が","すごく","良くて","、","びっくり","した","！"]
```

### 3) Another sentence (exclude punctuation)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:7b",
    "text":"明日は東京で友達と映画を見に行く予定です。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }'
```

Possible response:
```json
["明日","は","東京","で","友達","と","映画","を","見","に","行く","予定","です"]
```

### 4) Advanced, grammar-heavy examples (pretty-printed with jq)

Requires jq installed to pretty-print the response:

```bash
sudo apt-get update && sudo apt-get install -y jq
```

Tokenize only (/api/jp-tokenize)

- qwen2.5:7b, exclude punctuation (te-/ta-forms, conditionals, passive, potential)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "qwen2.5:7b",
    "text": "もし明日までに資料が完成していれば、担当者に見直してもらったうえで提出できるはずだと思っています。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }' | jq '.'
```

- qwen2.5:7b, keep punctuation (causative-passive, と conditional, 〜てしまった)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "qwen2.5:7b",
    "text": "先生に頼まれて発表の順番を変更させられたんだけど、想像していたより緊張してしまって、うまく話せなかった。",
    "keepPunctuation": true,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }' | jq '.'
```

- qwen2.5:14b, exclude punctuation (〜ように, 受身, 条件形 〜ば, 謙譲表現混在)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "qwen2.5:14b",
    "text": "締め切りに間に合うように早めに仕上げておけば、上司に確認していただいた後で修正が求められても落ち着いて対応できると思います。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }' | jq '.'
```

- qwen2.5:14b, keep punctuation (引用・強調記号, 条件節, 可能形, 逆接)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "qwen2.5:14b",
    "text": "彼は『資料を読むだけでは理解できない』と言っていたが、実際に手を動かせば意外と早く身につくはずだ。",
    "keepPunctuation": true,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }' | jq '.'
```

Tokenize + annotations (/api/jp-tokenize-annotate)

- qwen2.5:7b, exclude punctuation (丁寧形混在、複合述語、推量)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize-annotate \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "qwen2.5:7b",
    "text": "予定していた会議が延期になったので、参加者に連絡を回しておいていただけますか。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }' | jq '.'
```

- qwen2.5:7b, keep punctuation (条件節, 〜てみる, 逆接, 連体修飾)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize-annotate \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "qwen2.5:7b",
    "text": "時間に余裕があれば、この方法を試してみてください。ただし、想定外の挙動が起きた場合はすぐに報告してください。",
    "keepPunctuation": true,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }' | jq '.'
```

- qwen2.5:14b, exclude punctuation (受身, 〜さえ, 条件 〜なら, 可能)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize-annotate \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "qwen2.5:14b",
    "text": "最新のガイドラインに従わなければならないという点さえ押さえていれば、細かい形式は後から調整できるはずです。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }' | jq '.'
```

- qwen2.5:14b, keep punctuation (引用・反語的表現, 条件 〜たら, 補助動詞)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize-annotate \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "ollama",
    "model": "qwen2.5:14b",
    "text": "「そんなことが本当にできるの？」と疑われたら、実演して見せればいいだけだよ。",
    "keepPunctuation": true,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }' | jq '.'
```

### 4) Using qwen2.5:14b (exclude punctuation)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:14b",
    "text":"来週のプレゼンに向けて、資料を準備しています。",
    "keepPunctuation": false,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }'
```

### 5) Using qwen2.5:14b (keep punctuation)

```bash
curl -sS -X POST http://127.0.0.1:5100/api/jp-tokenize \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"ollama",
    "model":"qwen2.5:14b",
    "text":"彼は『絶対に諦めない！』と言った。",
    "keepPunctuation": true,
    "temperature": 0,
    "ollamaOptions": { "num_thread": 8 }
  }'
```

## Notes and Tips

- Default model is `qwen2.5:7b`, which you already have pulled under Ollama. You can switch to another pulled model via the `model` field (e.g., `qwen3:4b`).
- The endpoint forces the model to output JSON-only. If the model still adds extra text or code fences, the server will attempt to extract a JSON array. If it fails, you’ll get a 502 with the raw output.
- `temperature: 0` is recommended for deterministic segmentation.
- The endpoint performs wakachi-gaki (word segmentation); it does not translate.

## Troubleshooting

- 502 with `raw` in response: the model didn’t comply with JSON-only. Try again with `temperature: 0`, or a different model. You can also re-run with `keepPunctuation` flipped to see if it helps the model follow the instruction.
- Ensure the model is pulled in the `ollama` container:
  ```bash
  docker exec -it ollama ollama list
  ```
- Compose setup: see `docs/docker-compose-and-ask.md` for building and running both services and reusing the existing `ollama` volume.
