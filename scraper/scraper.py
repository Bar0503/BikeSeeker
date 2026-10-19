import json
from pathlib import Path
import re
import sys
import time
import requests
from bs4 import BeautifulSoup, Tag
from requests.exceptions import RequestException

BASE_URL = "https://bringakereso.hu"
PAGE_URL_TEMPLATE = (
    "https://bringakereso.hu/hirdetesek/kerekpar,mtb/"
    "?oldal={page}&rendezes=newest&nezet=sor"
)
SOURCE_NAME = "bringakereso"
CARD_SELECTOR = "a.listivo-listing-card-row-v2, a[class*='listing-card']"

REQUEST_TIMEOUT_SEC = 10
DEFAULT_MAX_PAGES = 30
DEFAULT_DELAY_SEC = 0.5
ALLOWED_MODES = ("latest", "all")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = BASE_DIR / "bikes_data.json"


# ar tisztitasa: ezres elvalasztok kezelese es szamjegyek kinyerese
def clean_price(raw_price: str | None) -> int | None:
    if not raw_price:
        return None

    match = re.search(r"(\d[\d\s\.,]*)\s*(?:Ft|HUF)\b", raw_price, re.IGNORECASE)
    if match:
        digits_only = re.sub(r"\D", "", match.group(1))
        return int(digits_only) if digits_only else None

    digits_only = re.sub(r"\D", "", raw_price)
    return int(digits_only) if digits_only else None


# oldal letoltese hibakezelessel es timeouttal
def fetch_html(url: str, session: requests.Session | None = None) -> str | None:
    client = session or requests
    try:
        print(f"Lekeres folyamatban: {url} ...")
        response = client.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT_SEC)
        response.raise_for_status()
        return response.text
    except requests.exceptions.HTTPError as err:
        print(f"HTTP hiba tortent: {err}")
    except requests.exceptions.ConnectionError:
        print("Halozati hiba: Nem sikerult csatlakozni.")
    except requests.exceptions.Timeout:
        print("Idotullepes: A szerver nem valaszolt.")
    except RequestException as err:
        print(f"Varatlan hiba a keres soran: {err}")
    return None


# egyetlen hirdetes kartya adatainak kinyerese a DOM elembol
def parse_bike_card(card: Tag) -> dict[str, str | int | None] | None:
    raw_href = card.get("href")
    href = raw_href if isinstance(raw_href, str) else ""
    if not href or "/hirdetes/" not in href:
        return None

    full_url = href if href.startswith("http") else f"{BASE_URL}{href}"

    title_tag = card.find(["h2", "h3", "h4"]) or card.select_one("[class*='title']")
    title = title_tag.get_text(strip=True) if title_tag else card.get_text(" ", strip=True)
    if not title:
        return None

    loc_el = (
        card.select_one("[class*='location']")
        or card.select_one("[class*='city']")
        or card.find(string=re.compile(r"Magyarország", re.IGNORECASE))
    )
    location = (
        loc_el.get_text(strip=True)
        if hasattr(loc_el, "get_text")
        else (str(loc_el).strip() if loc_el else None)
    )

    price_tag = card.select_one("[class*='price'], [class*='amount']")
    if price_tag:
        price = clean_price(price_tag.get_text(strip=True))
    else:
        price_match = card.find(string=re.compile(r"\d[\d\s\.]*\s*(?:Ft|HUF)\b", re.IGNORECASE))
        price = clean_price(str(price_match)) if price_match else None

    return {
        "title": title,
        "price": price,
        "location": location,
        "url": full_url,
        "source": SOURCE_NAME,
    }


# oldalak vegiglapozasa a valasztott mod alapjan (latest = 1. oldal, all = osszes oldal)
def scrape_pages(
    mode: str = "latest",
    max_pages: int = DEFAULT_MAX_PAGES,
    delay_sec: float = DEFAULT_DELAY_SEC,
) -> tuple[list[dict[str, str | int | None]], int]:
    scraped_bikes: list[dict[str, str | int | None]] = []
    seen_in_run: set[str] = set()
    pages_scraped = 0
    target_max_page = 1 if mode == "latest" else max_pages

    with requests.Session() as session:
        for page in range(1, target_max_page + 1):
            if page > 1:
                time.sleep(delay_sec)

            url = PAGE_URL_TEMPLATE.format(page=page)
            html = fetch_html(url, session=session)
            if not html:
                break

            soup = BeautifulSoup(html, "html.parser")
            cards = soup.select(CARD_SELECTOR)

            new_on_page = 0
            for card in cards:
                bike_data = parse_bike_card(card)
                if not bike_data:
                    continue

                bike_url = str(bike_data["url"])
                if bike_url not in seen_in_run:
                    seen_in_run.add(bike_url)
                    scraped_bikes.append(bike_data)
                    new_on_page += 1

            pages_scraped += 1
            print(f"[{page}. oldal] +{new_on_page} kerekpar ezen az oldalon (Eddig: {len(scraped_bikes)} db)")

            if new_on_page == 0:
                print("Elertuk az utolso oldalt, nincs tobb uj hirdetes.")
                break

    return scraped_bikes, pages_scraped


def load_existing_bikes(filepath: Path = OUTPUT_FILE) -> list[dict[str, str | int | None]]:
    if not filepath.exists():
        return []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as err:
        print(f"Figyelem: A meglevo JSON nem olvashato ({err}), ures listaval indulunk.")
        return []


def save_to_json(data: list[dict[str, str | int | None]], filepath: Path = OUTPUT_FILE) -> None:
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Adatok elmentve ide: {filepath}")


# lescrapelt hirdetesek osszefesulese a meglevo JSON allomannyal O(n) idoben
def sync_bikes(mode: str = "latest") -> dict[str, str | int]:
    if mode not in ALLOWED_MODES:
        raise ValueError(f"Ervenytelen mod: {mode}. Engedelyezett: {ALLOWED_MODES}")

    existing_bikes = load_existing_bikes()
    existing_by_url = {
        str(bike["url"]): bike for bike in existing_bikes if "url" in bike
    }

    scraped_bikes, pages_scraped = scrape_pages(mode=mode)

    new_bikes: list[dict[str, str | int | None]] = []
    updated_count = 0

    for bike in scraped_bikes:
        url = str(bike["url"])
        if url not in existing_by_url:
            new_bikes.append(bike)
            existing_by_url[url] = bike
            continue

        old_bike = existing_by_url[url]
        if old_bike.get("price") != bike.get("price") or old_bike.get("title") != bike.get("title"):
            old_bike["price"] = bike.get("price")
            old_bike["title"] = bike.get("title")
            old_bike["location"] = bike.get("location")
            updated_count += 1

    merged_bikes = new_bikes + existing_bikes

    if new_bikes or updated_count > 0 or not OUTPUT_FILE.exists():
        save_to_json(merged_bikes)
    else:
        print("Nem tortent valtozas, nem volt szukseg fajlirasra.")

    return {
        "mode": mode,
        "pages_scraped": pages_scraped,
        "new_added": len(new_bikes),
        "updated": updated_count,
        "total_bikes": len(merged_bikes),
    }


if __name__ == "__main__":
    run_mode = "all" if "--all" in sys.argv else "latest"
    result = sync_bikes(mode=run_mode)
    print(
        f"\nSzinkronizacio kesz ({result['mode']})! "
        f"Lekert oldalak: {result['pages_scraped']} | "
        f"Uj: +{result['new_added']} db | "
        f"Frissitve: {result['updated']} db | "
        f"Osszesen: {result['total_bikes']} db."
    )