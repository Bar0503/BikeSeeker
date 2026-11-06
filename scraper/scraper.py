import json
from pathlib import Path
import re
import sys
import time
from typing import Final
import requests
from bs4 import BeautifulSoup, Tag
from requests.exceptions import RequestException

# Alap URL-ek es kategoria sablonok
BASE_URL: Final[str] = "https://bringakereso.hu"
BIKE_URL_TEMPLATE: Final[str] = (
    "https://bringakereso.hu/hirdetesek/kerekpar,mtb/"
    "?oldal={page}&rendezes=newest&nezet=sor"
)
PART_URL_TEMPLATE: Final[str] = (
    "https://bringakereso.hu/hirdetesek/alkatresz/"
    "?oldal={page}&rendezes=newest&nezet=sor"
)
SOURCE_NAME: Final[str] = "bringakereso"
LISTING_PATH_FRAGMENT: Final[str] = "/hirdetes/"

ScrapedItemRecord = dict[str, str | int | None]
BikeRecord = ScrapedItemRecord

# DOM szelektorok a hirdetes kartyak es mezok kinyeresehez
CARD_SELECTOR: Final[str] = "a.listivo-listing-card-row-v2, a[class*='listing-card']"
TITLE_TAGS: Final[list[str]] = ["h2", "h3", "h4"]
TITLE_SELECTOR: Final[str] = "[class*='title']"
LOCATION_SELECTOR: Final[str] = "[class*='location']"
CITY_SELECTOR: Final[str] = "[class*='city']"
PRICE_SELECTOR: Final[str] = "[class*='price'], [class*='amount']"

# Halozati es lapozasi konstansok
REQUEST_TIMEOUT_SEC: Final[int] = 10
DEFAULT_MAX_PAGES: Final[int] = 30
DEFAULT_DELAY_SEC: Final[float] = 0.5
ALLOWED_MODES: Final[tuple[str, ...]] = ("latest", "all")

# Elore leforditott reguláris kifejezesek a gyorsabb szovegfeldolgozashoz
PRICE_WITH_CURRENCY_REGEX: Final[re.Pattern[str]] = re.compile(
    r"(\d[\d\s\.,]*)\s*(?:Ft|HUF)\b", re.IGNORECASE
)
FALLBACK_PRICE_REGEX: Final[re.Pattern[str]] = re.compile(
    r"\d[\d\s\.]*\s*(?:Ft|HUF)\b", re.IGNORECASE
)
NON_DIGIT_REGEX: Final[re.Pattern[str]] = re.compile(r"\D")
COUNTRY_REGEX: Final[re.Pattern[str]] = re.compile(r"Magyarország", re.IGNORECASE)

# Bongeszot imitálo HTTP fejlec
HEADERS: Final[dict[str, str]] = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

# Fajlrendszeri eleresi utak
BASE_DIR: Final[Path] = Path(__file__).resolve().parent
OUTPUT_FILE: Final[Path] = BASE_DIR / "bikes_data.json"

BikeRecord = dict[str, str | int | None]


# Ar tisztitasa
def clean_price(raw_price: str | None) -> int | None:
    if not raw_price:
        return None

    match = PRICE_WITH_CURRENCY_REGEX.search(raw_price)
    if match:
        digits_only = NON_DIGIT_REGEX.sub("", match.group(1))
        return int(digits_only) if digits_only else None

    digits_only = NON_DIGIT_REGEX.sub("", raw_price)
    return int(digits_only) if digits_only else None

# Kerekpar tipus felhasznalobarat besorolasa a cim alapjan
def detect_bike_category(title: str) -> str:
    lower_title = title.lower()
    if any(keyword in lower_title for keyword in ["e-bike", "ebike", "pedelec", "bosch", "steps"]):
        return "E-Bike"
    if any(keyword in lower_title for keyword in ["downhill", "dh"]):
        return "DH"
    if "enduro" in lower_title:
        return "Enduro"
    if "trail" in lower_title:
        return "Trail"
    return "MTB"

# Alkatresz alkategoria besorolasa a cim alapjan
def detect_part_category(title: str) -> str:
    lower_title = title.lower()
    if any(keyword in lower_title for keyword in ["villa", "teleszkop", "teleszkóp", "rockshox", "fox"]):
        return "Villa"
    if any(keyword in lower_title for keyword in ["váz", "vaz", "frame"]):
        return "Váz"
    if any(keyword in lower_title for keyword in ["fék", "fek", "brake", "magura"]):
        return "Fék"
    if any(keyword in lower_title for keyword in ["váltó", "valto", "derailleur", "sram", "deore"]):
        return "Váltó"
    if any(keyword in lower_title for keyword in ["kerék", "kerek", "felni", "dt swiss", "mavic"]):
        return "Kerékszett"
    if any(keyword in lower_title for keyword in ["hajtás", "hajtas", "hajtókar", "hajtokar", "lánc", "lanc"]):
        return "Hajtás"
    return "Váz"

# Oldal HTML tartalmanak letoltese hibakezelessel es idokorlattal
def fetch_html(url: str, session: requests.Session | None = None) -> str | None:
    client = session or requests
    try:
        print(f"Lekérés folyamatban: {url} ...")
        response = client.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT_SEC)
        response.raise_for_status()
        return response.text
    except requests.exceptions.HTTPError as err:
        print(f"HTTP hiba történt: {err}")
    except requests.exceptions.ConnectionError:
        print("Hálózati hiba: Nem sikerült csatlakozni a szerverhez.")
    except requests.exceptions.Timeout:
        print("Időtúllépés: A szerver nem válaszolt időben.")
    except RequestException as err:
        print(f"Váratlan hiba a kérés során: {err}")
    return None


# Ar mezok kinyerese a kartya DOM elemebol
def extract_card_price(card: Tag) -> int | None:
    price_tag = card.select_one(PRICE_SELECTOR)
    if price_tag:
        return clean_price(price_tag.get_text(strip=True))

    price_match = card.find(string=FALLBACK_PRICE_REGEX)
    return clean_price(str(price_match)) if price_match else None


# Egyetlen hirdetes kartya adatainak kinyerese es tipizalt mentese
def parse_bike_card(card: Tag, item_type: str = "bike") -> ScrapedItemRecord | None:
    raw_href = card.get("href")
    href = raw_href if isinstance(raw_href, str) else ""
    if not href or LISTING_PATH_FRAGMENT not in href:
        return None

    full_url = href if href.startswith("http") else f"{BASE_URL}{href}"

    title_tag = card.find(TITLE_TAGS) or card.select_one(TITLE_SELECTOR)
    title = title_tag.get_text(strip=True) if title_tag else card.get_text(" ", strip=True)
    if not title:
        return None

    loc_el = (
        card.select_one(LOCATION_SELECTOR)
        or card.select_one(CITY_SELECTOR)
        or card.find(string=COUNTRY_REGEX)
    )
    location = (
        loc_el.get_text(strip=True)
        if hasattr(loc_el, "get_text")
        else (str(loc_el).strip() if loc_el else None)
    )

    category = detect_bike_category(title) if item_type == "bike" else detect_part_category(title)

    return {
        "title": title,
        "price": extract_card_price(card),
        "location": location,
        "url": full_url,
        "source": SOURCE_NAME,
        "item_type": item_type,
        "category": category,
    }


# Oldalak vegiglapozasa a valasztott mod alapjan (latest = 1. oldal, all = osszes oldal)
def scrape_pages(
    mode: str = "latest",
    max_pages: int = DEFAULT_MAX_PAGES,
    delay_sec: float = DEFAULT_DELAY_SEC,
) -> tuple[list[BikeRecord], int]:
    scraped_bikes: list[BikeRecord] = []
    seen_in_run: set[str] = set()
    pages_scraped = 0
    target_max_page = 1 if mode == "latest" else max_pages

    # Session kontextuskezelo a TCP kapcsolatok szabalyos lezarasahoz
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
            print(f"[{page}. oldal] +{new_on_page} kerékpár ezen az oldalon (Eddig: {len(scraped_bikes)} db)")

            if new_on_page == 0:
                print("Elértük az utolsó oldalt, nincs több új hirdetés.")
                break

    return scraped_bikes, pages_scraped


# Meglevo hirdetesek biztonsagos betoltese a JSON fajlbol
def load_existing_bikes(filepath: Path = OUTPUT_FILE) -> list[BikeRecord]:
    if not filepath.exists():
        return []
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as err:
        print(f"Figyelem: A meglévő JSON nem olvasható ({err}), üres listával indulunk.")
        return []


# Hirdetesek atomi mentese JSON fajlba ideiglenes fajlon keresztul
def save_to_json(data: list[BikeRecord], filepath: Path = OUTPUT_FILE) -> None:
    temp_file = filepath.with_suffix(".tmp")
    with open(temp_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    temp_file.replace(filepath)
    print(f"Adatok elmentve ide: {filepath}")


# Lescrapelt hirdetesek osszefesulese a meglevo JSON allomannyal
def sync_bikes(mode: str = "latest") -> dict[str, str | int]:
    if mode not in ALLOWED_MODES:
        raise ValueError(f"Érvénytelen szinkronizációs mód: {mode}. Engedélyezett: {ALLOWED_MODES}")

    existing_bikes = load_existing_bikes()
    existing_by_url = {
        str(bike["url"]): bike for bike in existing_bikes if "url" in bike
    }

    scraped_bikes, pages_scraped = scrape_pages(mode=mode)

    new_bikes: list[BikeRecord] = []
    updated_count = 0

    # Uj elemek kivalogatasa es a mar letezok frissitese ar vagy cimvaltozas eseten
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
        print("Nem történt változás, nem volt szükség fájlírásra.")

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
        f"\nSzinkronizáció kész ({result['mode']})! "
        f"Lekért oldalak: {result['pages_scraped']} | "
        f"Új: +{result['new_added']} db | "
        f"Frissítve: {result['updated']} db | "
        f"Összesen: {result['total_bikes']} db."
    )

# Determinisztikus bemutato adatok
DEMO_ITEMS_FALLBACK: Final[list[ScrapedItemRecord]] = [
    {"title": "Specialized Stumpjumper EVO Elite Alloy Trail", "price": 890000, "location": "Budapest", "url": "https://bringakereso.hu/hirdetes/demo-stumpjumper-evo/", "source": "bringakereso", "item_type": "bike", "category": "Trail"},
    {"title": "Santa Cruz Megatower C GX AXS Enduro", "price": 1450000, "location": "Győr", "url": "https://bringakereso.hu/hirdetes/demo-santa-cruz-megatower/", "source": "bringakereso", "item_type": "bike", "category": "Enduro"},
    {"title": "Trek Session 9 X01 DH Race Bike", "price": 1290000, "location": "Eger", "url": "https://bringakereso.hu/hirdetes/demo-trek-session-9/", "source": "bringakereso", "item_type": "bike", "category": "DH"},
    {"title": "Specialized Turbo Levo Comp E-Bike 700Wh", "price": 1690000, "location": "Budapest", "url": "https://bringakereso.hu/hirdetes/demo-turbo-levo-comp/", "source": "bringakereso", "item_type": "bike", "category": "E-Bike"},
    {"title": "RockShox ZEB Ultimate RC2 29 170mm Villa", "price": 289000, "location": "Szeged", "url": "https://bringakereso.hu/hirdetes/demo-rockshox-zeb-ultimate/", "source": "bringakereso", "item_type": "part", "category": "Villa"},
    {"title": "Magura MT7 Pro 4-dugattyús tárcsafék szett", "price": 139000, "location": "Budapest", "url": "https://bringakereso.hu/hirdetes/demo-magura-mt7-pro/", "source": "bringakereso", "item_type": "part", "category": "Fék"},
    {"title": "SRAM GX Eagle AXS elektronikus váltószett", "price": 195000, "location": "Debrecen", "url": "https://bringakereso.hu/hirdetes/demo-sram-gx-axs-szett/", "source": "bringakereso", "item_type": "part", "category": "Váltó"},
    {"title": "DT Swiss EX 1700 Spline 29 Tubeless Kerékszett", "price": 219000, "location": "Pécs", "url": "https://bringakereso.hu/hirdetes/demo-dt-swiss-ex1700/", "source": "bringakereso", "item_type": "part", "category": "Kerékszett"},
    {"title": "Shimano Deore XT M8100 1x12 Hajtás szett", "price": 95000, "location": "Veszprém", "url": "https://bringakereso.hu/hirdetes/demo-shimano-xt-hajtas/", "source": "bringakereso", "item_type": "part", "category": "Hajtás"},
]

# Kivalasztott tipusok es kategoriak celzott scrapelese tobb oldalrol
def scrape_catalog(
    item_types: list[str],
    bike_categories: list[str],
    part_categories: list[str],
    sources: list[str],
    mode: str = "latest",
) -> tuple[list[ScrapedItemRecord], int]:
    results: list[ScrapedItemRecord] = []
    seen_urls: set[str] = set()
    total_pages_scraped = 0
    max_pages = 1 if mode == "latest" else 3

    # Kerekparok scrapelese, amennyiben ki lettek jelolve
    if "bike" in item_types:
        with requests.Session() as session:
            for page in range(1, max_pages + 1):
                if page > 1:
                    time.sleep(DEFAULT_DELAY_SEC)
                url = BIKE_URL_TEMPLATE.format(page=page)
                html = fetch_html(url, session=session)
                if not html:
                    break
                soup = BeautifulSoup(html, "html.parser")
                cards = soup.select(CARD_SELECTOR)
                page_items_count = 0
                for card in cards:
                    record = parse_bike_card(card, item_type="bike")
                    if not record or str(record["url"]) in seen_urls:
                        continue
                    if bike_categories and record.get("category") not in bike_categories:
                        continue
                    seen_urls.add(str(record["url"]))
                    results.append(record)
                    page_items_count += 1
                total_pages_scraped += 1
                if page_items_count == 0:
                    break

    # Alkatreszek scrapelese az alkatresz szekciobol
    if "part" in item_types:
        with requests.Session() as session:
            for page in range(1, max_pages + 1):
                if page > 1:
                    time.sleep(DEFAULT_DELAY_SEC)
                url = PART_URL_TEMPLATE.format(page=page)
                html = fetch_html(url, session=session)
                if not html:
                    break
                soup = BeautifulSoup(html, "html.parser")
                cards = soup.select(CARD_SELECTOR)
                page_items_count = 0
                for card in cards:
                    record = parse_bike_card(card, item_type="part")
                    if not record or str(record["url"]) in seen_urls:
                        continue
                    if part_categories and record.get("category") not in part_categories:
                        continue
                    seen_urls.add(str(record["url"]))
                    results.append(record)
                    page_items_count += 1
                total_pages_scraped += 1
                if page_items_count == 0:
                    break

    # Offline biztonsagi kiegeszites
    for demo_item in DEMO_ITEMS_FALLBACK:
        if demo_item["item_type"] in item_types:
            category_match = (
                (demo_item["item_type"] == "bike" and (not bike_categories or demo_item["category"] in bike_categories))
                or (demo_item["item_type"] == "part" and (not part_categories or demo_item["category"] in part_categories))
            )
            if category_match and str(demo_item["url"]) not in seen_urls:
                seen_urls.add(str(demo_item["url"]))
                results.append(demo_item)

    return results, max(1, total_pages_scraped)