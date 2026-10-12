"""MOROTTO authorized Avito listing importer.

This worker processes only saved searches with an explicit authorization record.
It stops on access denial, rate limits, CAPTCHA or challenge pages; it does not
rotate identities or attempt to bypass access controls.
"""
from __future__ import annotations

import logging
import os
import random
import re
import sys
import time
from datetime import datetime, timezone
from typing import Any
from urllib.parse import parse_qs, urlencode, urljoin, urlparse, urlunparse

from bs4 import BeautifulSoup
from curl_cffi import requests as curl_requests
from supabase import Client, create_client

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("morotto.scraper")

AVITO_HOSTS = {"avito.ma", "www.avito.ma"}
BRANDS = [
    "Mercedes-Benz", "Mercedes", "Toyota", "Peugeot", "Renault", "BMW",
    "Audi", "Volkswagen", "Dacia", "Citroen", "Ford", "Hyundai", "Kia",
    "Fiat", "Nissan", "Opel", "Skoda", "Seat", "Honda", "Suzuki",
    "Mitsubishi", "Volvo", "Land Rover", "Jeep", "Porsche",
]
FUEL_MAP = {
    "diesel": "Diesel", "gasoil": "Diesel", "essence": "Essence", "petrol": "Essence",
    "hybride": "Hybride", "hybrid": "Hybride", "électrique": "Électrique",
    "electrique": "Électrique", "electric": "Électrique",
}
MAX_PAGES_HARD_LIMIT = 50
MAX_ITEMS_PER_RUN = 1000
MIN_DELAY_SECONDS = 2.0
MAX_DELAY_SECONDS = 5.0


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def safe_error(exc: Exception) -> str:
    message = str(exc).replace("\n", " ")
    secret = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if secret:
        message = message.replace(secret, "[redacted]")
    return message[:1000] or exc.__class__.__name__


def validate_target_url(raw: str) -> str:
    parsed = urlparse(raw.strip())
    if parsed.scheme != "https" or parsed.hostname not in AVITO_HOSTS:
        raise ValueError("Only HTTPS URLs on avito.ma or www.avito.ma are allowed.")
    if parsed.username or parsed.password or parsed.port:
        raise ValueError("Credentials and custom ports are not allowed.")
    if len(raw) > 2048:
        raise ValueError("Target URL is too long.")
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", parsed.query, ""))


def page_url(base_url: str, page: int) -> str:
    parsed = urlparse(base_url)
    query = parse_qs(parsed.query, keep_blank_values=True)
    query["page"] = [str(page)]
    return urlunparse((parsed.scheme, parsed.netloc, parsed.path, "", urlencode(query, doseq=True), ""))


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = re.sub(r"\s+", " ", str(value)).strip()
    return text or None


def parse_number(value: Any) -> int | None:
    if value is None:
        return None
    match = re.search(r"\d[\d\s,.]*", str(value).replace("\u202f", " "))
    if not match:
        return None
    digits = re.sub(r"\D", "", match.group(0))
    try:
        return int(digits) if digits else None
    except ValueError:
        return None


def infer_brand(title: str | None) -> str | None:
    if not title:
        return None
    folded = title.casefold()
    for brand in sorted(BRANDS, key=len, reverse=True):
        if brand.casefold() in folded:
            return brand
    return None


def infer_fuel(text: str) -> str | None:
    folded = text.casefold()
    for needle, fuel in FUEL_MAP.items():
        if needle in folded:
            return fuel
    return None


def listing_id_from_url(url: str) -> str | None:
    path = urlparse(url).path
    match = re.search(r"(?:/|[-_])([0-9]{5,})(?:\.html?|\.htm)?$", path)
    return match.group(1) if match else None


def image_from_card(card: Any) -> str | None:
    img = card.find("img") if hasattr(card, "find") else None
    if not img:
        return None
    src = img.get("src") or img.get("data-src") or img.get("data-original")
    if not src and img.get("srcset"):
        src = str(img.get("srcset")).split(",")[0].strip().split(" ")[0]
    if not src:
        return None
    if src.startswith("//"):
        src = "https:" + src
    return src[:2048] if src.startswith("https://") else None


def parse_cards(html: str, page_url_value: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "lxml")
    parsed: list[dict[str, Any]] = []
    cards = soup.select("article, [data-testid*='ad-card'], [data-testid*='listing']")
    seen: set[str] = set()
    for card in cards:
        anchor = card.select_one("a[href*='avito.ma'], a[href^='/']")
        if not anchor:
            continue
        href = clean_text(anchor.get("href"))
        if not href:
            continue
        listing_url = urljoin(page_url_value, href)
        try:
            listing_url = validate_target_url(listing_url)
        except ValueError:
            continue
        item_id = listing_id_from_url(listing_url)
        if not item_id or item_id in seen:
            continue
        title_el = card.select_one("[data-testid*='title'], h2, h3, a[title]")
        title = clean_text(
            (title_el.get("title") if title_el else None)
            or (title_el.get_text(" ", strip=True) if title_el else None)
            or anchor.get("title")
            or anchor.get_text(" ", strip=True)
        )
        if not title or len(title) < 3:
            continue
        card_text = clean_text(card.get_text(" ", strip=True)) or title
        price_el = card.select_one("[data-testid*='price'], [class*='price'], [class*='Price']")
        price_text = clean_text(price_el.get_text(" ", strip=True)) if price_el else None
        if not price_text:
            price_match = re.search(r"([\d\s\u202f,.]+\s*(?:DH|MAD|د\.م\.?))", card_text, re.I)
            price_text = price_match.group(1) if price_match else None
        location_el = card.select_one("[data-testid*='location'], [class*='location'], [class*='Location']")
        city = clean_text(location_el.get_text(" ", strip=True)) if location_el else None
        if not city:
            for known in (
                "Casablanca", "Rabat", "Marrakech", "Tanger", "Agadir", "Fès", "Fes",
                "Meknès", "Meknes", "Oujda", "Kénitra", "Kenitra", "Tétouan",
                "Tetouan", "Safi", "El Jadida", "Béni Mellal",
            ):
                if known.casefold() in card_text.casefold():
                    city = known
                    break
        year_match = re.search(r"\b(19[5-9]\d|20[0-2]\d|2100)\b", card_text)
        price = parse_number(price_text)
        brand = infer_brand(title)
        if not brand or not price or price <= 0 or not city:
            continue
        parsed.append({
            "avito_id": item_id, "title": title[:300], "brand": brand[:80],
            "price": price, "city": city[:120],
            "year": int(year_match.group(1)) if year_match else None,
            "fuel_type": infer_fuel(card_text), "url": listing_url,
            "image_url": image_from_card(card),
        })
        seen.add(item_id)
    return parsed


def make_session():
    # Browser compatibility only; no proxy rotation, CAPTCHA solving, or challenge evasion.
    return curl_requests.Session(impersonate="chrome")


def fetch_page(session: Any, url: str) -> str:
    response = session.get(url, headers={
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,ar-MA;q=0.7,en;q=0.5",
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
        ),
    }, timeout=25, allow_redirects=True)
    status = int(response.status_code)
    if status in (401, 403, 429, 503):
        raise RuntimeError(f"Avito returned HTTP {status}; stopped without retries.")
    if status >= 400:
        raise RuntimeError(f"Avito returned HTTP {status}.")
    html = response.text
    folded = html.casefold()
    if any(marker in folded for marker in ("captcha", "robot check", "vérifiez que vous êtes humain", "verify you are human")):
        raise RuntimeError("Avito returned a challenge page; stopped.")
    return html


def supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not url or not key:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.")
    return create_client(url, key)


def event(db: Client, run_id: str | None, search_id: str, level: str, name: str, message: str, details: dict | None = None):
    try:
        db.table("scrape_run_events").insert({
            "run_id": run_id, "search_id": search_id, "level": level,
            "event": name[:120], "message": message[:1200], "details": details or {},
        }).execute()
    except Exception as exc:
        log.warning("Could not write run event: %s", safe_error(exc))


def set_search_status(
    db: Client, search_id: str, status: str, run_id: str | None = None,
    imported_count: int | None = None, seen_count: int | None = None,
    error_message: str | None = None, github_run_id: int | None = None,
):
    db.rpc("morotto_set_scrape_search_status", {
        "p_search_id": search_id, "p_status": status, "p_run_id": run_id,
        "p_imported_count": imported_count, "p_seen_count": seen_count,
        "p_error": error_message, "p_github_run_id": github_run_id,
    }).execute()


def load_searches(db: Client) -> list[dict[str, Any]]:
    requested_id = os.getenv("SCRAPE_SEARCH_ID", "").strip()
    query = (
        db.table("scrape_searches").select("*").eq("enabled", True)
        .not_.is_("authorization_confirmed_at", "null")
    )
    if requested_id:
        query = query.eq("id", requested_id)
    return query.order("created_at").execute().data or []


def create_run(db: Client, search: dict[str, Any]) -> str:
    github_run = os.getenv("GITHUB_RUN_ID") or str(int(time.time()))
    run_id = f"gh-{github_run}-{str(search['id'])[:8]}"[:100]
    now = utc_now()
    db.table("scrape_runs").upsert({
        "run_id": run_id, "search_id": search["id"],
        "requested_by": search.get("authorized_by") or search.get("created_by"),
        "target_url": validate_target_url(search["target_url"]), "status": "running",
        "dataset_count": 0, "imported_count": 0, "skipped_count": 0,
        "error_message": None, "started_at": now, "finished_at": None,
    }, on_conflict="run_id").execute()
    github_id = int(github_run) if str(github_run).isdigit() else None
    set_search_status(db, str(search["id"]), "running", run_id, github_run_id=github_id)
    event(db, run_id, str(search["id"]), "info", "run_started", "Recherche démarrée.", {
        "max_pages": search.get("max_pages", 5), "github_run_id": github_run,
    })
    return run_id


def mark_done(
    db: Client, search: dict[str, Any], run_id: str, status: str,
    seen: int, imported: int, skipped: int, error_message: str | None = None,
):
    now = utc_now()
    db.table("scrape_runs").update({
        "status": status, "dataset_count": seen, "imported_count": imported,
        "skipped_count": skipped, "error_message": error_message, "finished_at": now,
    }).eq("run_id", run_id).execute()
    github_run = os.getenv("GITHUB_RUN_ID", "")
    github_id = int(github_run) if github_run.isdigit() else None
    set_search_status(
        db, str(search["id"]), status, run_id, imported_count=imported,
        seen_count=seen, error_message=error_message, github_run_id=github_id,
    )
    event(db, run_id, str(search["id"]), "error" if status == "failed" else "info",
          "run_finished", error_message or f"Recherche terminée : {status}; {imported} annonce(s) importée(s).",
          {"status": status, "seen": seen, "imported": imported, "skipped": skipped})


def map_to_marketplace(item: dict[str, Any], owner_id: str) -> dict[str, Any] | None:
    year = item.get("year")
    if not year or not 1950 <= int(year) <= 2100:
        return None
    model = re.sub(re.escape(str(item["brand"])), "", item["title"], flags=re.I).strip(" -–|·") or item["title"]
    return {
        "owner_id": owner_id, "category": "Cars", "brand": item["brand"][:60],
        "model": model[:100], "year": int(year), "price_mad": int(item["price"]),
        "fuel": item.get("fuel_type") or "Autre", "mileage_km": 0,
        "listing_type": "Occasion", "city": item["city"][:120],
        "image_url": item.get("image_url"),
        "description": f"Import autorisé depuis Avito.ma. Titre source : {item['title']}"[:5000],
        "status": "pending", "source": "authorized_import",
        "source_reference": str(item["avito_id"])[:300], "source_url": item["url"],
        "source_authorized": True,
    }


def run_search(db: Client, search: dict[str, Any], dry_run: bool, fallback_owner_id: str) -> bool:
    search_id = str(search["id"])
    run_id: str | None = None
    found: dict[str, dict[str, Any]] = {}
    # Only use an owner assigned by the admin for this search; a global fallback is optional.
    owner_id = str(search.get("authorized_by") or search.get("created_by") or fallback_owner_id or "").strip()
    try:
        target = validate_target_url(str(search["target_url"]))
        pages = min(MAX_PAGES_HARD_LIMIT, max(1, int(search.get("max_pages") or 5)))
        if not dry_run and not owner_id:
            raise RuntimeError("No approved listing owner is assigned to this search.")
        run_id = create_run(db, search)
        session = make_session()
        try:
            for page_num in range(1, pages + 1):
                if page_num > 1:
                    time.sleep(random.uniform(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS))
                current_url = page_url(target, page_num)
                event(db, run_id, search_id, "info", "page_requested",
                      f"Lecture de la page {page_num}/{pages}.", {"page": page_num})
                page_items = parse_cards(fetch_page(session, current_url), current_url)
                before = len(found)
                for item in page_items:
                    found[item["avito_id"]] = item
                event(db, run_id, search_id, "info", "page_parsed",
                      f"Page {page_num} analysée : {len(page_items)} annonce(s) admissible(s).",
                      {"page": page_num, "found": len(page_items)})
                if len(found) >= MAX_ITEMS_PER_RUN or (page_num > 1 and len(found) == before):
                    break
        finally:
            try:
                session.close()
            except Exception:
                pass

        items, imported, skipped = list(found.values())[:MAX_ITEMS_PER_RUN], 0, 0
        if not dry_run:
            rows = [row for item in items if (row := map_to_marketplace(item, owner_id))]
            skipped = len(items) - len(rows)
            if rows:
                result = db.table("listings").upsert(
                    rows, on_conflict="source,source_reference", ignore_duplicates=False,
                ).execute()
                imported = len(result.data or rows)
        mark_done(db, search, run_id, "completed", len(items), imported, skipped)
        log.info("Search %s completed; found=%d imported=%d dry_run=%s", search_id, len(items), imported, dry_run)
        return True
    except Exception as exc:
        message = safe_error(exc)
        log.error("Search %s failed: %s", search_id, message)
        if run_id:
            try:
                mark_done(db, search, run_id, "failed", len(found), 0, 0, message)
            except Exception as write_exc:
                log.error("Could not mark run failed: %s", safe_error(write_exc))
        else:
            try:
                set_search_status(db, search_id, "failed", error_message=message)
            except Exception:
                pass
        return False


def main() -> int:
    if os.getenv("AVITO_IMPORT_AUTHORIZED", "").lower() != "true":
        log.error("AVITO_IMPORT_AUTHORIZED must be 'true' before remote collection.")
        return 2
    dry_run = os.getenv("SCRAPE_DRY_RUN", "false").lower() in {"1", "true", "yes"}
    fallback_owner_id = os.getenv("AUTHORIZED_IMPORT_OWNER_ID", "").strip()
    if not dry_run and not fallback_owner_id:
        log.info("Owner UUID will be taken from each saved search's authorization record.")

    try:
        db = supabase_client()
        searches = load_searches(db)
    except Exception as exc:
        log.error("Could not load saved searches: %s", safe_error(exc))
        return 2
    if not searches:
        log.info("No enabled, authorized saved searches found. Nothing to do.")
        return 0

    log.info("Processing %d saved search(es); dry_run=%s", len(searches), dry_run)
    failures = 0
    for index, search in enumerate(searches):
        if index:
            time.sleep(random.uniform(MIN_DELAY_SECONDS, MAX_DELAY_SECONDS))
        if not run_search(db, search, dry_run, fallback_owner_id):
            failures += 1
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
