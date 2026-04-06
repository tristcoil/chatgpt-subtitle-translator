"""
aukro_tool/app.py — Flask microservice exposing aukro.cz search as REST API.
Used as an HTTP Tool by the n8n AI Agent.

Endpoints:
  POST /search          { "query": "rog ally", "max_price": 15000 }
  GET  /detail/<item_id>
  GET  /health
"""

import json
import os
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError

from flask import Flask, jsonify, request

app = Flask(__name__)

SEARCH_URL = "https://aukro.cz/api/offers/searchItemsCommon"
DETAIL_URL = "https://aukro.cz/api/offers/{item_id}/offerDetail"
LISTING_BASE = "https://aukro.cz"
HEADERS = {"Accept": "application/json", "User-Agent": "Mozilla/5.0"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get(url: str) -> dict:
    req = Request(url, headers=HEADERS)
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def _post(url: str, body: dict) -> dict:
    data = json.dumps(body).encode()
    req = Request(url, data=data, headers={**HEADERS, "Content-Type": "application/json"}, method="POST")
    with urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())


def _time_left(ending_str: str) -> str:
    ending = datetime.fromisoformat(ending_str)
    now = datetime.now(timezone.utc)
    delta = ending.astimezone(timezone.utc) - now
    if delta.total_seconds() < 0:
        return "ended"
    days = delta.days
    hours, rem = divmod(delta.seconds, 3600)
    minutes = rem // 60
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes and not days:
        parts.append(f"{minutes}m")
    return " ".join(parts) if parts else "< 1m"


def _condition(attrs: list) -> str:
    for a in attrs:
        if a.get("attributeName") == "Stav zboží":
            return a.get("attributeValue", "")
    return ""


def _cheapest_shipping(shipping_options: list) -> str:
    best = None
    for s in shipping_options:
        if s.get("freeOfCharge"):
            return "free"
        amt = s.get("firstPackagePrice", {}).get("amount", 0)
        if best is None or amt < best:
            best = amt
    return f"{best:.0f} Kč" if best is not None else "unknown"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.post("/search")
def search():
    body = request.get_json(silent=True) or {}
    query = body.get("query", "").strip()
    max_price = body.get("max_price")
    condition_filter = (body.get("condition") or "").lower()
    size = int(body.get("size", 60))

    if not query:
        return jsonify({"error": "query is required"}), 400

    try:
        data = _post(f"{SEARCH_URL}?page=0&size={size}", {"text": query, "subbrand": "BAZAAR"})
    except URLError as e:
        return jsonify({"error": str(e)}), 502

    listings = []
    for item in data.get("content", []):
        price = item["price"]["amount"]
        if max_price and price > max_price:
            continue
        condition = _condition(item.get("attributes", []))
        if condition_filter and condition_filter not in condition.lower():
            continue

        item_id = item["itemId"]
        seo_url = item.get("seoUrl", "")
        endings = item.get("endingTime", "")
        buy_now = item["buyNowPrice"]["amount"]
        is_auction = item.get("auction", False)

        listings.append({
            "item_id": item_id,
            "title": item.get("itemName", ""),
            "price_czk": price,
            "buy_now_czk": buy_now if buy_now > 0 else None,
            "condition": condition,
            "is_auction": is_auction,
            "time_left": _time_left(endings) if endings else "?",
            "ends_at": endings,
            "seller": item.get("sellerLogin", ""),
            "watchers": item.get("watchersCount", 0),
            "location": item.get("location", ""),
            "url": f"{LISTING_BASE}/{seo_url}-{item_id}",
        })

    return jsonify({
        "query": query,
        "total": len(listings),
        "listings": listings,
    })


@app.get("/detail/<int:item_id>")
def detail(item_id: int):
    try:
        d = _get(DETAIL_URL.format(item_id=item_id))
    except URLError as e:
        return jsonify({"error": str(e)}), 502

    seller = d.get("seller", {})
    seo_url = d.get("seoUrl", "")

    return jsonify({
        "item_id": item_id,
        "title": d.get("name", ""),
        "price_czk": d.get("price", {}).get("amount"),
        "buy_now_czk": d.get("buyNowPrice", {}).get("amount"),
        "condition": _condition(d.get("attributes", [])),
        "is_auction": d.get("itemType") == "AUCTION",
        "ends_at": d.get("endingTime", ""),
        "time_left": _time_left(d["endingTime"]) if d.get("endingTime") else "?",
        "description": (d.get("descriptionStripped") or d.get("shortDescription") or "").strip(),
        "seller_name": seller.get("showName", ""),
        "seller_rating": seller.get("rating", 0),
        "seller_positive_pct": round(seller.get("positiveFeedbackPercentage", 0) * 100, 1),
        "seller_reviews": seller.get("feedbackUniqueUserCount", 0),
        "seller_location": seller.get("location", ""),
        "bidders_count": d.get("biddersCount", 0),
        "watchers_count": d.get("watchingUserCount", 0),
        "views": d.get("displayedCount", 0),
        "cheapest_shipping": _cheapest_shipping(d.get("shippingOptions", [])),
        "attributes": {a["attributeName"]: a["attributeValue"] for a in d.get("attributes", [])},
        "url": f"{LISTING_BASE}/{seo_url}-{item_id}",
    })


def _search_one(query: str, top_n: int, max_price, seen_ids: set) -> dict:
    """Fetch search results + details for a single query. Returns dict with top_listings."""
    try:
        data = _post(f"{SEARCH_URL}?page=0&size=60", {"text": query, "subbrand": "BAZAAR"})
    except URLError as e:
        return {"query": query, "total_found": 0, "top_listings": [], "error": str(e)}

    listings = []
    for item in data.get("content", []):
        price = item["price"]["amount"]
        if max_price and price > max_price:
            continue
        condition = _condition(item.get("attributes", []))
        item_id = item["itemId"]
        seo_url = item.get("seoUrl", "")
        endings = item.get("endingTime", "")
        buy_now = item["buyNowPrice"]["amount"]
        is_auction = item.get("auction", False)
        listings.append({
            "item_id": item_id,
            "title": item.get("itemName", ""),
            "price_czk": price,
            "buy_now_czk": buy_now if buy_now > 0 else None,
            "condition": condition,
            "is_auction": is_auction,
            "time_left": _time_left(endings) if endings else "?",
            "ends_at": endings,
            "seller": item.get("sellerLogin", ""),
            "url": f"{LISTING_BASE}/{seo_url}-{item_id}",
        })

    priority = ["zánovní", "použité", "rozbaleno", "nové"]
    def rank(l):
        cond = l.get("condition", "").lower()
        cr = next((i for i, c in enumerate(priority) if c in cond), 99)
        return (cr, l.get("price_czk", 999999))

    top = sorted(listings, key=rank)[:top_n]

    detailed = []
    for listing in top:
        try:
            d = _get(DETAIL_URL.format(item_id=listing["item_id"]))
            seller = d.get("seller", {})
            attrs = {a["attributeName"]: a["attributeValue"] for a in d.get("attributes", [])}
            listing.update({
                "description": (d.get("descriptionStripped") or d.get("shortDescription") or "").strip()[:800],
                "seller_rating": seller.get("rating", 0),
                "seller_positive_pct": round(seller.get("positiveFeedbackPercentage", 0) * 100, 1),
                "seller_reviews": seller.get("feedbackUniqueUserCount", 0),
                "seller_location": seller.get("location", ""),
                "bidders_count": d.get("biddersCount", 0),
                "watchers_count": d.get("watchingUserCount", 0),
                "views": d.get("displayedCount", 0),
                "cheapest_shipping": _cheapest_shipping(d.get("shippingOptions", [])),
                "attributes": attrs,
                "is_new": listing["item_id"] not in seen_ids,
            })
        except Exception:
            listing["is_new"] = listing["item_id"] not in seen_ids
        detailed.append(listing)

    return {
        "query": query,
        "total_found": len(listings),
        "top_listings": detailed,
        "all_ids": [l["item_id"] for l in listings],
    }


@app.post("/search-with-details")
def search_with_details():
    """Search for one or more queries and return top N listings with full details each.

    Accepts:
      { "queries": ["rog ally", "legion go", "msi claw"], "top_n": 8 }
    or legacy single-query form:
      { "query": "rog ally", "top_n": 8 }
    """
    body = request.get_json(silent=True) or {}
    queries_raw = body.get("queries") or ([body.get("query", "rog ally")] if body.get("query") else ["rog ally"])
    queries = [q.strip() for q in queries_raw if q and q.strip()]
    max_price = body.get("max_price")
    top_n = int(body.get("top_n", 8))

    # Load state once, shared across all queries
    state_path = "/reports/aukro_state.json"
    try:
        with open(state_path) as f:
            seen_ids = set(json.load(f).get("seen_ids", []))
    except Exception:
        seen_ids = set()

    results = []
    all_new_ids = set()
    for q in queries:
        r = _search_one(q, top_n, max_price, seen_ids)
        results.append(r)
        all_new_ids.update(r.pop("all_ids", []))

    # Update seen state with all discovered IDs
    new_state = {"seen_ids": list(all_new_ids | seen_ids), "updated_at": datetime.now(timezone.utc).isoformat()}
    try:
        os.makedirs(os.path.dirname(state_path), exist_ok=True)
        with open(state_path, "w") as f:
            json.dump(new_state, f)
    except Exception:
        pass

    # Legacy single-query response shape for backward compat
    if len(results) == 1:
        return jsonify(results[0])

    return jsonify({"results": results})


@app.post("/save-report")
def save_report():
    body = request.get_json(silent=True) or {}
    date = body.get("date", "unknown")
    md_content = body.get("md", "")
    html_content = body.get("html", "")

    reports_dir = "/reports"
    os.makedirs(reports_dir, exist_ok=True)

    md_path = os.path.join(reports_dir, f"aukro-deals-{date}.md")
    html_path = os.path.join(reports_dir, f"aukro-deals-{date}.html")

    with open(md_path, "w", encoding="utf-8") as f:
        f.write(md_content)
    os.chmod(md_path, 0o644)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    os.chmod(html_path, 0o644)

    return jsonify({"saved_md": md_path, "saved_html": html_path})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5050, debug=False)
