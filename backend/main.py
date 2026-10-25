from enum import Enum
import json
import math
import os
from pathlib import Path
import sys
from typing import Final
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Projekt gyokerkonyvtar hozzaadasa az eleresi uthoz a scraper modul importalasahoz
BASE_DIR: Final[Path] = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from scraper.scraper import BikeRecord, sync_bikes

# Konfiguracios konstansok es fajl eleresi utak
DEFAULT_PAGE_SIZE: Final[int] = 12
MAX_PAGE_SIZE: Final[int] = 100
ALLOWED_ORIGINS: Final[list[str]] = os.getenv("CORS_ORIGINS", "*").split(",")

SCRAPER_DIR: Final[Path] = BASE_DIR / "scraper"
DATA_FILE: Final[Path] = SCRAPER_DIR / "bikes_data.json"
SAMPLE_DATA_FILE: Final[Path] = SCRAPER_DIR / "bikes_data.sample.json"

app = FastAPI(
    title="BikeSeeker API",
    description="API server for scraped bicycle listings",
    version="0.1.0",
)

# CORS middleware beallitasa a frontend kommunikaciohoz
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Rendezesi opciok felsorolasa
class SortOption(str, Enum):
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"


# Scraper szinkronizacios modok felsorolasa
class ScrapeMode(str, Enum):
    LATEST = "latest"
    ALL = "all"


# Pydantic adatmodellek a keresek es valaszok validalasahoz
class Bike(BaseModel):
    title: str
    price: int | None = None
    location: str | None = None
    url: str
    source: str


class BikeListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[Bike]


class ScrapeResponse(BaseModel):
    mode: str
    pages_scraped: int
    new_added: int
    updated: int
    total_bikes: int


# Kerekpar adatok betoltese az eles fajlbol automatikus mintaadat fallbackkel
def load_bikes() -> list[BikeRecord]:
    target_file: Path | None = None

    if DATA_FILE.exists():
        target_file = DATA_FILE
        print(f"[BikeSeeker] Scraper adatok betöltve: {DATA_FILE.name}")
    elif SAMPLE_DATA_FILE.exists():
        target_file = SAMPLE_DATA_FILE
        print(f"[FIGYELEM] Friss adat nem található, mintaadat betöltve: {SAMPLE_DATA_FILE.name}")
    else:
        print("[HIBA] Sem az éles, sem a minta adatfájl nem található!")
        return []

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as err:
        print(f"[HIBA] Hiba a JSON beolvasásakor ({target_file.name}): {err}")
        return []


# Mellekhatas-mentes szures es rendezes a megadott lekerdezesi parameterek alapjan
def filter_and_sort_bikes(
    bikes: list[BikeRecord],
    query: str | None,
    min_price: int | None,
    max_price: int | None,
    location: str | None,
    sort_by: SortOption | None,
) -> list[BikeRecord]:
    results = list(bikes)

    # Szures tobb kulcsszora a cimben (minden szonak szerepelnie kell)
    if query and query.strip():
        words = query.lower().split()
        results = [
            b for b in results
            if all(word in str(b.get("title", "")).lower() for word in words)
        ]

    # Szures minimalis es maximalis ar alapjan
    if min_price is not None:
        results = [
            b for b in results
            if isinstance(b.get("price"), int) and int(b["price"]) >= min_price
        ]

    if max_price is not None:
        results = [
            b for b in results
            if isinstance(b.get("price"), int) and int(b["price"]) <= max_price
        ]

    # Szures helyszinre kis- es nagybetu erzeketlenul
    if location and location.strip():
        loc_lower = location.strip().lower()
        results = [
            b for b in results
            if b.get("location") and loc_lower in str(b["location"]).lower()
        ]

    # Rendezes ar alapjan (a None arak mindig a lista vegere kerulnek)
    if sort_by == SortOption.PRICE_ASC:
        results.sort(key=lambda b: (b.get("price") is None, int(b.get("price") or 0)))
    elif sort_by == SortOption.PRICE_DESC:
        results.sort(key=lambda b: (b.get("price") is None, -int(b.get("price") or 0)))

    return results


# Szerver allapot ellenorzo vegpont
@app.get("/")
def root() -> dict[str, str]:
    return {"message": "BikeSeeker API is running"}


# Kerekpar hirdetesek lekerdezese szuressel, rendezessel es lapozassal
@app.get("/api/bikes", response_model=BikeListResponse)
def get_bikes(
    query: str | None = Query(default=None, description="Keresés a címben (több szó esetén mindnek szerepelnie kell)"),
    min_price: int | None = Query(default=None, ge=0, description="Minimális ár HUF-ban"),
    max_price: int | None = Query(default=None, ge=0, description="Maximális ár HUF-ban"),
    location: str | None = Query(default=None, description="Helyszín szűrése"),
    sort_by: SortOption | None = Query(default=None, description="Rendezési mód"),
    page: int = Query(default=1, ge=1, description="Oldalszám (1-től indul)"),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Találatok száma oldalanként"),
) -> dict[str, int | list[BikeRecord]]:
    # Bemeneti arhatarok ervenyessegenek ellenorzese
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(
            status_code=400,
            detail="A minimum ár nem lehet nagyobb a maximum árnál.",
        )

    raw_bikes = load_bikes()
    filtered_bikes = filter_and_sort_bikes(
        bikes=raw_bikes,
        query=query,
        min_price=min_price,
        max_price=max_price,
        location=location,
        sort_by=sort_by,
    )

    # Osszesitett statisztikak es lapszam szamitasa
    total_count = len(filtered_bikes)
    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1

    # Oldalhatarok kiszamolasa es szeletelese
    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    paginated_items = filtered_bikes[start_index:end_index]

    return {
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": paginated_items,
    }


# Scraper szinkronizacio inditasa a valasztott modban
@app.post("/api/bikes/scrape", response_model=ScrapeResponse)
def trigger_scrape(
    mode: ScrapeMode = Query(default=ScrapeMode.LATEST, description="Szinkronizációs mód: latest vagy all"),
) -> dict[str, str | int]:
    try:
        return sync_bikes(mode=mode.value)
    except (ValueError, OSError) as err:
        raise HTTPException(
            status_code=500,
            detail=f"Hiba történt a hirdetések szinkronizálása során: {err}",
        ) from err