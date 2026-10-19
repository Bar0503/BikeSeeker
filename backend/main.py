from enum import Enum
import json
import math
from pathlib import Path
import sys
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# projekt gyokonyvtar hozzaadasa az eleresi uthoz a scraper importalasahoz
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from scraper.scraper import sync_bikes

app = FastAPI(
    title="BikeSeeker API",
    description="API server for scraped bicycle listings",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SCRAPER_DIR = BASE_DIR / "scraper"
DATA_FILE = SCRAPER_DIR / "bikes_data.json"
SAMPLE_DATA_FILE = SCRAPER_DIR / "bikes_data.sample.json"


class SortOption(str, Enum):
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"


class ScrapeMode(str, Enum):
    LATEST = "latest"
    ALL = "all"


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


# kerekpar adatok betoltese automatikus sample fallbackkel
def load_bikes() -> list[dict]:
    target_file = None

    if DATA_FILE.exists():
        target_file = DATA_FILE
        print(f"[BikeSeeker] Scraper adatok betoltve: {DATA_FILE.name}")
    elif SAMPLE_DATA_FILE.exists():
        target_file = SAMPLE_DATA_FILE
        print(f"[FIGYELEM] Friss adat nem talalhato, sample betoltve: {SAMPLE_DATA_FILE.name}")
    else:
        print("[HIBA] Sem az eles, sem a minta adatfajl nem talalhato!")
        return []

    try:
        with open(target_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except (json.JSONDecodeError, OSError) as err:
        print(f"[HIBA] Hiba a JSON beolvasasakor ({target_file.name}): {err}")
        return []


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "BikeSeeker API is running"}


@app.get("/api/bikes", response_model=BikeListResponse)
def get_bikes(
    query: str | None = Query(default=None, description="Kereses a cimben (tobb szo eseten mindnek szerepelnie kell)"),
    min_price: int | None = Query(default=None, ge=0, description="Minimalis ar HUF-ban"),
    max_price: int | None = Query(default=None, ge=0, description="Maximalis ar HUF-ban"),
    location: str | None = Query(default=None, description="Helyszin szurese"),
    sort_by: SortOption | None = Query(default=None, description="Rendezesi mod"),
    page: int = Query(default=1, ge=1, description="Oldalszam (1-tol indul)"),
    page_size: int = Query(default=12, ge=1, le=100, description="Talalatok szama oldalankent"),
) -> dict:
    results = load_bikes()

    # szures tobb kulcsszora a cimben
    if query:
        words = query.lower().split()
        results = [
            b for b in results
            if all(word in b.get("title", "").lower() for word in words)
        ]

    # szures minimalis es maximalis ar alapjan
    if min_price is not None:
        results = [b for b in results if b.get("price") is not None and b["price"] >= min_price]

    if max_price is not None:
        results = [b for b in results if b.get("price") is not None and b["price"] <= max_price]

    # szures helyszinre
    if location:
        loc_lower = location.lower()
        results = [b for b in results if b.get("location") and loc_lower in b["location"].lower()]

    # rendezes ar alapjan (a None arak mindig a lista vegere kerulnek)
    if sort_by == SortOption.PRICE_ASC:
        results.sort(key=lambda b: (b.get("price") is None, b.get("price") or 0))
    elif sort_by == SortOption.PRICE_DESC:
        results.sort(key=lambda b: (b.get("price") is None, -(b.get("price") or 0)))

    total_count = len(results)
    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1

    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    paginated_items = results[start_index:end_index]

    return {
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": paginated_items,
    }


@app.post("/api/bikes/scrape", response_model=ScrapeResponse)
def trigger_scrape(
    mode: ScrapeMode = Query(default=ScrapeMode.LATEST, description="Szinkronizacios mod: latest vagy all"),
) -> dict[str, str | int]:
    try:
        return sync_bikes(mode=mode.value)
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Hiba a scrapeles soran: {err}") from err