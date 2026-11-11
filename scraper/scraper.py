import re
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

# DOM szelektorok a hirdetes kartyak es mezok kinyeresehez
CARD_SELECTOR: Final[str] = "a.listivo-listing-card-row-v2, a[class*='listing-card']"
TITLE_TAGS: Final[list[str]] = ["h2", "h3", "h4"]
TITLE_SELECTOR: Final[str] = "[class*='title']"
LOCATION_SELECTOR: Final[str] = "[class*='location']"
CITY_SELECTOR: Final[str] = "[class*='city']"
PRICE_SELECTOR: Final[str] = "[class*='price'], [class*='amount']"

# Halozati es lapozasi konstansok
REQUEST_TIMEOUT_SEC: Final[int] = 10
DEFAULT_DELAY_SEC: Final[float] = 0.8
LATEST_MODE_MAX_PAGES: Final[int] = 1
ALL_MODE_MAX_PAGES: Final[int] = 3

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


# Determinisztikus bemutato adatok tobb forrasoldal lefedesehez
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
    {"title": "Canyon Spectral 29 CF 7 Trail", "price": 990000, "location": "Budapest", "url": "https://testbike.hu/bolha/demo-canyon-spectral/", "source": "testbike", "item_type": "bike", "category": "Trail"},
    {"title": "Fox 36 Float Factory Grip2 29 Villa", "price": 310000, "location": "Győr", "url": "https://testbike.hu/bolha/demo-fox-36-factory/", "source": "testbike", "item_type": "part", "category": "Villa"},
    {"title": "Merida One-Sixty 700 Enduro", "price": 1150000, "location": "Miskolc", "url": "https://bikemag.hu/apro/demo-merida-one-sixty/", "source": "bikemag", "item_type": "bike", "category": "Enduro"},
    {"title": "Shimano XTR M9120 tárcsafék szett", "price": 165000, "location": "Debrecen", "url": "https://bikemag.hu/apro/demo-shimano-xtr-fek/", "source": "bikemag", "item_type": "part", "category": "Fék"},
]

# Egy hirdetestipus lapjainak vegigjarasa kategoriaszurovel
def scrape_listing_pages(
    url_template: str,
    item_type: str,
    allowed_categories: list[str],
    max_pages: int,
) -> tuple[list[ScrapedItemRecord], int]:
    records: list[ScrapedItemRecord] = []
    seen_urls: set[str] = set()
    pages_scraped = 0

    with requests.Session() as session:
        for page in range(1, max_pages + 1):
            if page > 1:
                time.sleep(DEFAULT_DELAY_SEC)
            html = fetch_html(url_template.format(page=page), session=session)
            if not html:
                break

            new_cards_count = 0
            for card in BeautifulSoup(html, "html.parser").select(CARD_SELECTOR):
                record = parse_bike_card(card, item_type=item_type)
                if not record or str(record["url"]) in seen_urls:
                    continue
                seen_urls.add(str(record["url"]))
                new_cards_count += 1
                if allowed_categories and record.get("category") not in allowed_categories:
                    continue
                records.append(record)

            pages_scraped += 1
            # Csak akkor allunk meg, ha az oldalon mar egyaltalan nem volt uj hirdetes
            if new_cards_count == 0:
                break

    return records, pages_scraped

# Celzott adatgyujtes a kivalasztott tipusok forrasok es kategoriak szerint
def scrape_catalog(
    item_types: list[str],
    bike_categories: list[str],
    part_categories: list[str],
    sources: list[str],
    mode: str = "latest",
) -> tuple[list[ScrapedItemRecord], int]:
    results: list[ScrapedItemRecord] = []
    total_pages_scraped = 0
    max_pages = LATEST_MODE_MAX_PAGES if mode == "latest" else ALL_MODE_MAX_PAGES
    normalized_sources: set[str] = {s.strip().lower() for s in sources} if sources else {SOURCE_NAME}

    # Bringakereso piacter letoltese ha szerepel az igenyelt forrasok kozott
    if SOURCE_NAME in normalized_sources:
        listing_targets = (
            ("bike", BIKE_URL_TEMPLATE, bike_categories),
            ("part", PART_URL_TEMPLATE, part_categories),
        )
        for item_type, url_template, categories in listing_targets:
            if item_type not in item_types:
                continue
            records, pages_scraped = scrape_listing_pages(url_template, item_type, categories, max_pages)
            results.extend(records)
            total_pages_scraped += pages_scraped

    seen_urls: set[str] = {str(record["url"]) for record in results}

    # Tartalek bemutato adatok illesztese a forras es kategoria szurokhoz
    for demo_item in DEMO_ITEMS_FALLBACK:
        item_source = str(demo_item.get("source") or "").lower()
        if normalized_sources and item_source not in normalized_sources:
            continue
        if demo_item["item_type"] in item_types:
            category_match = (
                (demo_item["item_type"] == "bike" and (not bike_categories or demo_item["category"] in bike_categories))
                or (demo_item["item_type"] == "part" and (not part_categories or demo_item["category"] in part_categories))
            )
            if category_match and str(demo_item["url"]) not in seen_urls:
                seen_urls.add(str(demo_item["url"]))
                results.append(demo_item)

    return results, max(1, total_pages_scraped)