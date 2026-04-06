# Aukro Deal Finder — n8n AI Agent Workflow Plan

## Goal

Run a daily n8n AI agent that searches aukro.cz for ROG Ally deals, evaluates them intelligently, and sends a summary notification with the best finds highlighted.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                   Docker Compose                    │
│                                                     │
│  ┌──────────────┐    ┌──────────────────────────┐  │
│  │   n8n        │───▶│  aukro-tool (Flask API)  │  │
│  │  :5678       │    │  :5050                   │  │
│  └──────┬───────┘    └──────────────────────────┘  │
│         │                       │                   │
│         │ AI Agent loop         │ calls             │
│         ▼                       ▼                   │
│  ┌──────────────┐    ┌──────────────────────────┐  │
│  │  Ollama LLM  │    │   aukro.cz REST API      │  │
│  │  :11434      │    │   (external)             │  │
│  └──────────────┘    └──────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Components:**

| Component | Role |
|---|---|
| **n8n** | Orchestrator: schedules daily run, runs AI agent, sends notification |
| **aukro-tool** | Lightweight Python/Flask microservice exposing aukro.cz search & detail as JSON REST endpoints |
| **Ollama** | Local LLM (already running) used by n8n AI Agent node to reason about deals |

---

## Workflow Steps (n8n)

```
[Schedule: 8am daily]
        │
        ▼
[AI Agent Node]
   ├── Tool: search_aukro(query, max_price?)
   │         → calls aukro-tool /search
   │         → returns list of listings with price, condition, ends_in
   │
   ├── Tool: get_listing_detail(item_id)
   │         → calls aukro-tool /detail/{item_id}
   │         → returns description, seller rating, bidders, shipping
   │
   └── Agent prompt:
       "You are a deal-finding assistant. Search for ROG Ally devices on
        aukro.cz. Identify the 3 best deals based on: low price, good
        condition (prefer zánovní), reputable seller (>10 reviews, >95%),
        reasonable shipping, and time remaining. For each good deal, explain
        why it's good. Flag any suspiciously cheap listings."
        │
        ▼
[Format output as HTML/Markdown summary]
        │
        ▼
[Send notification]  ← email / Telegram / Slack (configurable)
        │
        ▼
[Save run log to file node]
```

---

## File Structure

```
aukro_analyser/
├── PLAN.md                  ← this file
├── aukro_search.py          ← standalone CLI (existing)
├── aukro_state.json         ← CLI state (existing)
├── aukro_tool/
│   ├── app.py               ← Flask microservice (n8n HTTP tool)
│   └── requirements.txt
├── n8n/
│   └── workflow.json        ← exportable n8n workflow
└── docker-compose.n8n.yml  ← adds n8n + aukro-tool to existing compose
```

---

## aukro-tool API Endpoints

### `POST /search`
```json
Request:  { "query": "rog ally", "max_price": 15000 }
Response: { "listings": [ { "item_id", "title", "price", "buy_now_price",
                             "condition", "is_auction", "ends_in",
                             "time_left", "seller", "location", "url" } ] }
```

### `GET /detail/<item_id>`
```json
Response: { "item_id", "title", "price", "description", "seller_name",
            "seller_rating", "seller_positive_pct", "seller_reviews",
            "bidders_count", "watchers_count", "views", "cheapest_shipping",
            "location", "attributes", "url" }
```

---

## n8n AI Agent Prompt (system)

```
You are an expert deal-finding assistant for the Czech/Slovak auction site aukro.cz.

When asked to find ROG Ally deals:
1. Call search_aukro with query "rog ally"
2. For the top candidates (price < 15000 Kč, condition zánovní or použité),
   call get_listing_detail to get full info
3. Rank the best 3 deals considering:
   - Price (lower is better, but suspiciously low = red flag)
   - Condition: zánovní > použité > rozbaleno
   - Seller reputation: prefer sellers with >5 reviews and >90% positive
   - Time left: auctions ending soon with low bids are best opportunities
   - Extras included (SD card, case, hub add value)
4. Return a clear summary with:
   - 🏆 Best deal + reason
   - 🥈 Runner up
   - 🥉 Third pick
   - ⚠️ Any warnings (new seller, suspiciously cheap, ending very soon)
   - Direct links to each listing
```

---

## Notification Options

Configure ONE of these in n8n (via credential nodes):

- **Email** — n8n SMTP node (Gmail, any provider)
- **Telegram** — n8n Telegram node (bot token + chat_id)
- **Slack** — n8n Slack node

---

## Setup Steps

1. `docker compose -f docker-compose.yml -f docker-compose.n8n.yml up -d`
2. Open n8n at `http://localhost:5678`
3. Import `n8n/workflow.json` via n8n UI (Workflows → Import)
4. Add Ollama credential in n8n (base URL: `http://ollama:11434`)
5. Configure notification credential (email/Telegram/Slack)
6. Activate the workflow
7. Optionally click "Execute" to test immediately

---

## Security Notes

- n8n is only exposed on localhost (127.0.0.1:5678) — not publicly accessible
- aukro-tool is internal to the Docker network, not exposed externally
- No API keys required (aukro.cz API is unauthenticated)
- n8n data persisted in named Docker volume `n8n_data`
