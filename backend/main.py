from enum import Enum
import json
import math
from pathlib import Path
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(
    title="BikeSeeker API",
    description="API server for scraped bicycle listings",
    version="0.1.0"
)

#cors beallitas a kesobbi frontend elereshez
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

#adatfajl eleresi utja
DATA_FILE = Path(__file__).resolve().parent.parent / "scraper" / "bikes_data.json"


#rendezesi opciok
class SortOption(str, Enum):
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"


#pydantic modellek
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


def load_bikes() -> list[dict]:
    #json fajl beolvasasa
    if not DATA_FILE.exists():
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


@app.get("/")
def root():
    #alap statusz vegpont
    return {"message": "BikeSeeker API is running"}


@app.get("/api/bikes", response_model=BikeListResponse)
def get_bikes(
    query: str | None = Query(default=None, description="Kereses a cimben (tobb szo eseten mindnek szerepelnie kell)"),
    min_price: int | None = Query(default=None, ge=0, description="Minimalis ar HUF-ban"),
    max_price: int | None = Query(default=None, ge=0, description="Maximalis ar HUF-ban"),
    location: str | None = Query(default=None, description="Helyszin szurese"),
    sort_by: SortOption | None = Query(default=None, description="Rendezesi mod"),
    page: int = Query(default=1, ge=1, description="Oldalszam (1-tol indul)"),
    page_size: int = Query(default=20, ge=1, le=100, description="Talalatok szama oldalankent")
):
    #kerekparok lekerese szurokkel, rendezessel es oldalszamozassal
    bikes = load_bikes()
    if not bikes:
        raise HTTPException(status_code=404, detail="No scraped data found")

    results = bikes

    #szures tobb kulcsszora a cimben
    if query:
        words = query.lower().split()
        results = [
            b for b in results
            if all(word in b["title"].lower() for word in words)
        ]

    #szures minimalis ar alapjan
    if min_price is not None:
        results = [b for b in results if b["price"] is not None and b["price"] >= min_price]

    #szures maximalis ar alapjan
    if max_price is not None:
        results = [b for b in results if b["price"] is not None and b["price"] <= max_price]

    #szures helyszinre
    if location:
        loc_lower = location.lower()
        results = [b for b in results if b["location"] and loc_lower in b["location"].lower()]

    #rendezes ar alapjan (a None arak mindig a lista vegere kerulnek)
    if sort_by == SortOption.PRICE_ASC:
        results.sort(key=lambda b: (b["price"] is None, b["price"] or 0))
    elif sort_by == SortOption.PRICE_DESC:
        results.sort(key=lambda b: (b["price"] is None, -(b["price"] or 0)))

    #osszesitett statisztikak es lapszam szamitas
    total_count = len(results)
    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 0

    #oldalhatarok kiszamolasa es vagas
    start_index = (page - 1) * page_size
    end_index = start_index + page_size
    paginated_items = results[start_index:end_index]

    return {
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": paginated_items
    }