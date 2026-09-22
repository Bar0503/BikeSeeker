import json
from pathlib import Path
import re
import requests
from bs4 import BeautifulSoup
from requests.exceptions import RequestException

TARGET_URL = "https://bringakereso.hu/hirdetesek/kerekpar,mtb/"
BASE_URL = "https://bringakereso.hu"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

#biztos eleresi utvonal a menteshez
BASE_DIR = Path(__file__).resolve().parent
OUTPUT_FILE = BASE_DIR / "bikes_data.json"


def clean_price(raw_price: str | None) -> int | None:
    #ar tisztitasa: ezres elvalasztok (vesszo, pont, szokoz) kezelese
    if not raw_price:
        return None

    #megkeressuk a Ft vagy HUF elotti szamokat vesszovel, ponttal vagy szokozzel
    match = re.search(r"(\d[\d\s\.,]*)\s*(?:Ft|HUF)\b", raw_price, re.IGNORECASE)
    if match:
        digits_only = re.sub(r"\D", "", match.group(1))
        return int(digits_only) if digits_only else None

    #fallback: ha nincs Ft jeloles, de csak szamjegyek szerepelnek
    digits_only = re.sub(r"\D", "", raw_price)
    return int(digits_only) if digits_only else None


def fetch_html(url: str) -> str | None:
    #oldal letoltese hibakezelessel
    try:
        print(f"Lekeres folyamatban: {url} ...")
        response = requests.get(url, headers=HEADERS, timeout=10)
        
        #http error, ha 4xx vagy 5xx
        response.raise_for_status()
        return response.text

    except requests.exceptions.HTTPError as err:
        #statuszkod hibak, pl: 403, 404, 500
        print(f"HTTP Hiba tortent: {err}")
    except requests.exceptions.ConnectionError:
        #nincs net, vagy rossz a domainnev
        print("Halozati hiba: Nem sikerult csatlakozni.")
    except requests.exceptions.Timeout:
        #idotullepes
        print("Idotullepes: A szerver nem valaszolt.")
    except RequestException as err:
        #minden mas requests hiba
        print(f"Varatlan hiba a keres soran: {err}")
    return None


def parse_bike_card(card) -> dict | None:
    #egy kartya adatainak kinyerese
    href = card.get("href", "")
    if not href or "/hirdetes/" not in href:
        return None

    full_url = href if href.startswith("http") else f"{BASE_URL}{href}"

    #cim kereses
    title_tag = card.find(["h2", "h3", "h4"]) or card.select_one("[class*='title']")
    title = title_tag.get_text(strip=True) if title_tag else card.get_text(" ", strip=True)

    #helyszin kereses
    loc_el = (
        card.select_one("[class*='location']")
        or card.select_one("[class*='city']")
        or card.find(string=re.compile(r"Magyarország", re.IGNORECASE))
    )
    location = loc_el.get_text(strip=True) if hasattr(loc_el, "get_text") else (str(loc_el).strip() if loc_el else None)

    #ar kereses: eloszor dedikalt ar osztalybol
    price_tag = card.select_one("[class*='price'], [class*='amount']")
    
    if price_tag:
        raw_price = price_tag.get_text(strip=True)
        price = clean_price(raw_price)
    else:
        #fallback: szigoru regex szamjegyekkel es szohatarral (kizarja a shift szot)
        price_match = card.find(string=re.compile(r"\d[\d\s\.]*\s*(?:Ft|HUF)\b", re.IGNORECASE))
        price = clean_price(price_match) if price_match else None

    #objektum eltarolas
    return {
        "title": title,
        "price": price,
        "location": location,
        "url": full_url,
        "source": "bringakereso"
    }


def scrape_bikes(url: str) -> list[dict]:
    #teljes listaoldal feldolgozasa
    html = fetch_html(url)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    print(f"Oldalcim: {soup.title.string.strip() if soup.title else 'Nincs cim'}")

    #link szures
    cards = soup.select("a.listivo-listing-card-row-v2, a[class*='listing-card']")
    scraped_bikes = []
    seen_urls = set()

    for card in cards:
        bike_data = parse_bike_card(card)
        
        #duplikacio szures menet kozben
        if bike_data and bike_data["url"] not in seen_urls:
            seen_urls.add(bike_data["url"])
            scraped_bikes.append(bike_data)

    return scraped_bikes


def save_to_json(data: list[dict], filepath: Path = OUTPUT_FILE) -> None:
    #mentes JSON fajlba
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"Adatok elmentve ide: {filepath}")


if __name__ == "__main__":
    bikes = scrape_bikes(TARGET_URL)
    print(f"\nSikeresen talaltunk {len(bikes)} egyedi kerekpart.")

    if bikes:
        save_to_json(bikes)

        #elso 3 talalat check:
        print("\n--- Az elso 3 talalat ---")
        for bike in bikes[:3]:
            print(f"\nCim: {bike['title']}")
            print(f"Ar: {bike['price']} HUF")
            print(f"Hely: {bike['location']}")
            print(f"Link: {bike['url']}")