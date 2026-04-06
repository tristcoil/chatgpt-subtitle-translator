#!/usr/bin/env python3
"""
aukro_search.py — Search for deals on aukro.cz

Usage:
    python3 aukro_search.py "rog ally"
    python3 aukro_search.py "steam deck" --max-price 10000
    python3 aukro_search.py "rog ally" --condition zánovní
    python3 aukro_search.py "rog ally" --detail

Runs daily and marks listings as [NEW] when they appear for the first time.
State is saved to aukro_state.json next to this script.
"""

import argparse
import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError

SEARCH_URL = "https://aukro.cz/api/offers/searchItemsCommon"
DETAIL_URL = "https://aukro.cz/api/offers/{item_id}/offerDetail"
LISTING_BASE = "https://aukro.cz"
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aukro_state.json")


def load_state() -> dict:
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_state(state: dict) -> None:
    with open(STATE_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)


def search(query: str, page: int = 0, size: int = 60) -> dict:
    payload = json.dumps({"text": query, "subbrand": "BAZAAR"}).encode()
    url = f"{SEARCH_URL}?page={page}&size={size}"
    req = Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Mozilla/5.0",
        },
        method="POST",
    )
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except URLError as e:
        print(f"Error fetching results: {e}", file=sys.stderr)
        sys.exit(1)


def format_time_left(ending_time_str: str) -> str:
    ending = datetime.fromisoformat(ending_time_str)
    now = datetime.now(timezone.utc)
    delta = ending.astimezone(timezone.utc) - now
    if delta.total_seconds() < 0:
        return "ended"
    days = delta.days
    hours, remainder = divmod(delta.seconds, 3600)
    minutes = remainder // 60
    parts = []
    if days:
        parts.append(f"{days}d")
    if hours:
        parts.append(f"{hours}h")
    if minutes and not days:
        parts.append(f"{minutes}m")
    return " ".join(parts) if parts else "< 1m"


def fetch_detail(item_id: int) -> dict | None:
    url = DETAIL_URL.format(item_id=item_id)
    req = Request(url, headers={"Accept": "application/json", "User-Agent": "Mozilla/5.0"})
    try:
        with urlopen(req, timeout=15) as resp:
            return json.loads(resp.read())
    except URLError:
        return None


def fetch_details_parallel(items: list) -> dict[int, dict]:
    results = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {executor.submit(fetch_detail, item["itemId"]): item["itemId"] for item in items}
        for future in as_completed(futures):
            item_id = futures[future]
            detail = future.result()
            if detail:
                results[item_id] = detail
    return results


def get_condition(item: dict) -> str:
    for attr in item.get("attributes", []):
        if attr.get("attributeName") == "Stav zboží":
            return attr.get("attributeValue", "")
    return ""


def print_results(items: list, max_price: float | None, condition_filter: str | None, details: dict[int, dict] | None = None, new_ids: set[int] | None = None):
    filtered = items

    if max_price is not None:
        filtered = [i for i in filtered if i["price"]["amount"] <= max_price]

    if condition_filter:
        cf = condition_filter.lower()
        filtered = [i for i in filtered if cf in get_condition(i).lower()]

    if not filtered:
        print("No listings found matching your filters.")
        return

    print(f"\n{'─' * 80}")
    print(f"  {'TITLE':<46} {'PRICE':>9}  {'TYPE':<8}  {'ENDS':<10}  COND")
    print(f"{'─' * 80}")

    for item in filtered:
        title = item["itemName"][:45]
        price = item["price"]["amount"]
        buy_now_price = item["buyNowPrice"]["amount"]
        is_auction = item.get("auction", False)
        ending = item.get("endingTime", "")
        condition = get_condition(item)
        seo_url = item.get("seoUrl", "")
        item_id = item.get("itemId", "")
        url = f"{LISTING_BASE}/{seo_url}-{item_id}"

        listing_type = "auction" if is_auction else "buy now"
        time_left = format_time_left(ending) if ending else "?"
        is_new = new_ids is not None and item_id in new_ids
        new_tag = " 🆕 NEW" if is_new else ""

        price_str = f"{price:,.0f} Kč"
        print(f"  {title:<46} {price_str:>9}  {listing_type:<8}  {time_left:<10}  {condition}{new_tag}")
        if is_auction and buy_now_price > 0:
            print(f"  {'  buy now:':>46} {buy_now_price:>8,.0f} Kč")
        print(f"  {url}")

        if details and item_id in details:
            d = details[item_id]
            seller = d.get("seller", {})
            seller_name = seller.get("showName", "?")
            seller_rating = seller.get("rating", "?")
            seller_pct = seller.get("positiveFeedbackPercentage", 0)
            seller_fb = seller.get("feedbackUniqueUserCount", 0)
            location = d.get("itemLocation", "?")
            bidders = d.get("biddersCount", 0)
            watchers = d.get("watchingUserCount", 0)
            views = d.get("displayedCount", 0)

            cheapest_shipping = None
            for s in d.get("shippingOptions", []):
                amt = s.get("firstPackagePrice", {}).get("amount", 0)
                if s.get("freeOfCharge"):
                    cheapest_shipping = "free"
                    break
                if cheapest_shipping is None or amt < cheapest_shipping:
                    cheapest_shipping = amt

            shipping_str = (
                "free" if cheapest_shipping == "free"
                else f"from {cheapest_shipping:,.0f} Kč" if cheapest_shipping is not None
                else "?"
            )

            print(f"  {'':2}Seller: {seller_name}  ⭐ {seller_rating} ({seller_pct*100:.0f}%, {seller_fb} reviews)  📍 {location}")
            print(f"  {'':2}Bidders: {bidders}  Watchers: {watchers}  Views: {views}  Shipping: {shipping_str}")

            description = (d.get("descriptionStripped") or d.get("shortDescription") or "").strip()
            if description:
                # Wrap to ~76 chars
                words = description.replace("\n", " ").split()
                line, lines = [], []
                for word in words:
                    if sum(len(w) + 1 for w in line) + len(word) > 74:
                        lines.append(" ".join(line))
                        line = [word]
                    else:
                        line.append(word)
                if line:
                    lines.append(" ".join(line))
                for l in lines[:6]:  # max 6 lines of description
                    print(f"  {'':2}{l}")
                if len(lines) > 6:
                    print(f"  {'':2}[…]")

        print()

    total = len(items)
    shown = len(filtered)
    new_shown = sum(1 for i in filtered if new_ids and i["itemId"] in new_ids)
    print(f"{'─' * 80}")
    print(f"  Showing {shown} of {total} total listings", end="")
    if new_shown:
        print(f"  ({new_shown} new)", end="")
    print()
    if total > shown:
        print(f"  ({total - shown} filtered out)")


def main():
    parser = argparse.ArgumentParser(description="Search for deals on aukro.cz")
    parser.add_argument("query", help="Search query, e.g. 'rog ally'")
    parser.add_argument("--max-price", type=float, help="Maximum price in CZK")
    parser.add_argument("--condition", help="Filter by condition (e.g. zánovní, použité, nové)")
    parser.add_argument("--size", type=int, default=60, help="Results per page (default: 60)")
    parser.add_argument("--detail", action="store_true", help="Fetch full details for each listing")
    args = parser.parse_args()

    print(f"Searching aukro.cz for: \"{args.query}\"...")
    data = search(args.query, size=args.size)
    items = data.get("content", [])
    total = data.get("page", {}).get("totalElements", len(items))

    if not items:
        print("No results found.")
        return

    print(f"Found {total} listing(s).")

    # Determine new listings by comparing against saved state
    state = load_state()
    query_key = args.query.lower().strip()
    seen_ids = set(state.get(query_key, {}).get("ids", []))
    current_ids = {item["itemId"] for item in items}
    new_ids = current_ids - seen_ids

    if seen_ids:
        print(f"  {len(new_ids)} new listing(s) since last run.")
    else:
        print("  First run for this query — all listings recorded as baseline.")
        new_ids = set()  # don't mark everything as new on first run

    # Save updated state
    state[query_key] = {
        "ids": list(current_ids),
        "last_run": datetime.now(timezone.utc).isoformat(),
    }
    save_state(state)

    details = None
    if args.detail:
        print(f"Fetching details for {len(items)} listings...")
        details = fetch_details_parallel(items)

    print_results(items, args.max_price, args.condition, details, new_ids)


if __name__ == "__main__":
    main()
