from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
import json
import math
import os
from pathlib import Path
import sys
from typing import Final

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session, selectinload

from auth import create_access_token, get_current_user, get_password_hash, verify_password
from database import Base, SessionLocal, engine, get_db
from models import Group, Item, User, group_items
from schemas import (
    GroupCreate,
    GroupResponse,
    GroupUpdate,
    ItemCreate,
    ItemListResponse,
    ItemResponse,
    ItemUpdate,
    LoginRequest,
    PreferencesUpdateRequest,
    ScrapeMode,
    ScrapePreferencesSchema,
    ScrapeTriggerRequest,
    ScrapeTriggerResponse,
    TokenResponse,
    UserResponse,
)
from seed import seed_database

# Projekt gyokerkonyvtar hozzaadasa az eleresi uthoz a scraper modul importalasahoz
BASE_DIR: Final[Path] = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from scraper.scraper import BikeRecord, scrape_catalog, sync_bikes

# Konfiguracios konstansok es fajl eleresi utak
DUPLICATE_URL_MESSAGE: Final[str] = "Ezzel az URL-lel már létezik tétel az adatbázisban."
DEFAULT_PAGE_SIZE: Final[int] = 12
MAX_PAGE_SIZE: Final[int] = 100
ALLOWED_ORIGINS: Final[list[str]] = os.getenv("CORS_ORIGINS", "*").split(",")

SCRAPER_DIR: Final[Path] = BASE_DIR / "scraper"
DATA_FILE: Final[Path] = SCRAPER_DIR / "bikes_data.json"
SAMPLE_DATA_FILE: Final[Path] = SCRAPER_DIR / "bikes_data.sample.json"

# Adatbazis inicializalasa kozponti seed fuggvennyel
@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_database()
    yield

app = FastAPI(
    title="BikeSeeker API",
    description="API server for scraped bicycle listings",
    version="0.1.0",
    lifespan=lifespan,
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

# Felhasznaloi preferenciak dekodolasa JSON szovegbol sema objektumma
def parse_user_preferences(prefs_json: str | None) -> ScrapePreferencesSchema:
    if not prefs_json:
        return ScrapePreferencesSchema()
    try:
        parsed = json.loads(prefs_json)
        return ScrapePreferencesSchema(**parsed)
    except (json.JSONDecodeError, TypeError):
        return ScrapePreferencesSchema()

# Reszleges frissites: csak a kliens altal tenylegesen elkuldott mezok irodnak felul
def apply_partial_update(entity: Item | Group, payload: BaseModel) -> None:
    for field_name, value in payload.model_dump(exclude_unset=True).items():
        # Ures szoveg a nullable mezokben hianyzo erteket jelent
        setattr(entity, field_name, None if value == "" else value)

# Bejelentkezes ellenorzese es JWT Bearer token kiallitasa
@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> dict[str, object]:
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if not user or not verify_password(payload.password, str(user.password_hash)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hibás felhasználónév vagy jelszó.",
        )

    token = create_access_token(data={"sub": str(user.username)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "scrape_preferences": parse_user_preferences(user.scrape_preferences),
        },
    }

# Aktualisan bejelentkezett felhasznalo adatainak lekerese
@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> dict[str, object]:
    return {
        "id": current_user.id,
        "username": current_user.username,
        "scrape_preferences": parse_user_preferences(current_user.scrape_preferences),
    }

# Scrape varazslo preferenciainak mentese az adatbazisba
@app.put("/api/auth/preferences", response_model=ScrapePreferencesSchema)
def update_preferences(
    payload: PreferencesUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScrapePreferencesSchema:
    prefs_dict = payload.model_dump()
    current_user.scrape_preferences = json.dumps(prefs_dict, ensure_ascii=False)
    db.commit()
    return payload

# Csoportok listazasa az elemek szamaval
@app.get("/api/groups", response_model=list[GroupResponse])
def get_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict[str, object]]:
    groups = (
        db.query(Group)
        .options(selectinload(Group.items))
        .order_by(Group.created_at.desc())
        .all()
    )
    return [
        {
            "id": g.id,
            "name": g.name,
            "description": g.description,
            "created_at": g.created_at,
            "item_count": len(g.items),
            "items_count": len(g.items),
        }
        for g in groups
    ]

# Uj csoport letrehozasa
@app.post("/api/groups", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    new_group = Group(
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return {
        "id": new_group.id,
        "name": new_group.name,
        "description": new_group.description,
        "created_at": new_group.created_at,
        "items_count": 0,
        "item_count": 0,
    }

# Egyetlen csoport lekerese azonosito alapjan
@app.get("/api/groups/{group_id}", response_model=GroupResponse)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    group = (
        db.query(Group)
        .options(selectinload(Group.items))
        .filter(Group.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="A megadott csoport nem található.")
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "created_at": group.created_at,
        "items_count": len(group.items),
        "item_count": len(group.items),
    }

# Csoport adatainak modositasa
@app.put("/api/groups/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: int,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    group = (
        db.query(Group)
        .options(selectinload(Group.items))
        .filter(Group.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="A megadott csoport nem található.")
    apply_partial_update(group, payload)
    db.commit()
    db.refresh(group)
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "created_at": group.created_at,
        "items_count": len(group.items),
        "item_count": len(group.items),
    }

# Csoport torlese a hirdetesek megorzesével
@app.delete("/api/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="A megadott csoport nem található.")
    db.delete(group)
    db.commit()

# Hirdetes hozzarendelese egy csoporthoz
@app.post("/api/groups/{group_id}/items/{item_id}", response_model=GroupResponse)
def add_item_to_group(
    group_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    group = (
        db.query(Group)
        .options(selectinload(Group.items))
        .filter(Group.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail="A csoport nem található.")
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="A hirdetés nem található.")
    if item not in group.items:
        group.items.append(item)
        db.commit()
        db.refresh(group)
    return {
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "created_at": group.created_at,
        "items_count": len(group.items),
        "item_count": len(group.items),
    }

# Hirdetes eltavolitasa egy csoportbol
@app.delete("/api/groups/{group_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item_from_group(
    group_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="A csoport nem található.")
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="A hirdetés nem található.")
    if item in group.items:
        group.items.remove(item)
        db.commit()

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

# Hirdetesek es alkatreszek lekerdezese osszetett szuressel, lapozassal es Eager Loadinggal
@app.get("/api/items", response_model=ItemListResponse)
def get_items(
    item_type: str | None = Query(default=None, description="Típus szűrés: bike vagy part"),
    category: str | None = Query(default=None, description="Alkategória szűrése"),
    group_id: int | None = Query(default=None, description="Csoport azonosító szerinti szűrés"),
    query: str | None = Query(default=None, description="Keresőszavak a címben"),
    min_price: int | None = Query(default=None, ge=0, description="Minimális ár"),
    max_price: int | None = Query(default=None, ge=0, description="Maximális ár"),
    location: str | None = Query(default=None, description="Település szűrése"),
    source: str | None = Query(default=None, description="Forrásoldal szűrése"),
    sort_by: SortOption | None = Query(default=None, description="Ár szerinti rendezés"),
    page: int = Query(default=1, ge=1, description="Oldalszám"),
    page_size: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Oldalméret"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    if min_price is not None and max_price is not None and min_price > max_price:
        raise HTTPException(status_code=400, detail="A minimum ár nem lehet nagyobb a maximum árnál.")

    sql_query = db.query(Item).options(selectinload(Item.groups))

    # Szures kapcsolodo csoport alapjan
    if group_id is not None:
        sql_query = sql_query.join(Item.groups).filter(Group.id == group_id)

    # Tipus es kategoria szurok alkalmazasa
    if item_type and item_type.strip():
        sql_query = sql_query.filter(Item.item_type == item_type.strip().lower())
    if category and category.strip():
        sql_query = sql_query.filter(Item.category == category.strip())
    if source and source.strip():
        sql_query = sql_query.filter(Item.source == source.strip())

    # Cimszuro alkalmazasa tobb kulcsszora
    if query and query.strip():
        words = query.strip().split()
        for word in words:
            sql_query = sql_query.filter(Item.title.ilike(f"%{word}%"))

    # Ar- es helyszinszurok alkalmazasa
    if min_price is not None:
        sql_query = sql_query.filter(Item.price >= min_price)
    if max_price is not None:
        sql_query = sql_query.filter(Item.price <= max_price)
    if location and location.strip():
        sql_query = sql_query.filter(Item.location.ilike(f"%{location.strip()}%"))

    # Rendezes beallitasa ar szerint ugy hogy a hianyzo arak a lista vegere keruljenek
    if sort_by == SortOption.PRICE_ASC:
        sql_query = sql_query.order_by(Item.price.is_(None), Item.price.asc())
    elif sort_by == SortOption.PRICE_DESC:
        sql_query = sql_query.order_by(Item.price.is_(None), Item.price.desc())
    else:
        sql_query = sql_query.order_by(Item.created_at.desc())

    total_count = sql_query.count()
    total_pages = math.ceil(total_count / page_size) if total_count > 0 else 1
    items = sql_query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": [
            {
                "id": it.id,
                "title": it.title,
                "price": it.price,
                "location": it.location,
                "url": it.url,
                "source": it.source,
                "item_type": it.item_type,
                "category": it.category,
                "notes": it.notes,
                "created_at": it.created_at,
                "group_ids": [g.id for g in it.groups],
            }
            for it in items
        ],
    }

# Uj hirdetes vagy alkatresz manualis letrehozasa tobb csoport tamogatassal
@app.post("/api/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    existing = db.query(Item).filter(Item.url == payload.url.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=DUPLICATE_URL_MESSAGE)

    new_item = Item(
        title=payload.title.strip(),
        price=payload.price,
        location=payload.location.strip() if payload.location else None,
        url=payload.url.strip(),
        source=payload.source.strip(),
        item_type=payload.item_type.strip(),
        category=payload.category.strip() if payload.category else None,
        notes=payload.notes.strip() if payload.notes else None,
    )

    # Csoport tagsagok hozzarendelese (egyedi es tobbes mezo tamogatassal)
    target_group_ids = set(payload.group_ids)
    if payload.group_id is not None:
        target_group_ids.add(payload.group_id)

    if target_group_ids:
        matched_groups = db.query(Group).filter(Group.id.in_(target_group_ids)).all()
        new_item.groups.extend(matched_groups)

    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return {
        "id": new_item.id,
        "title": new_item.title,
        "price": new_item.price,
        "location": new_item.location,
        "url": new_item.url,
        "source": new_item.source,
        "item_type": new_item.item_type,
        "category": new_item.category,
        "notes": new_item.notes,
        "created_at": new_item.created_at,
        "group_ids": [g.id for g in new_item.groups],
    }

# Hirdetes adatainak es egyedi megjegyzesenek modositasa
@app.put("/api/items/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    item = (
        db.query(Item)
        .options(selectinload(Item.groups))
        .filter(Item.id == item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="A hirdetés nem található.")

    # URL utkozes ellenorzese a UNIQUE megszoritas megsertese elott
    if payload.url is not None and payload.url != item.url:
        url_taken = db.query(Item.id).filter(Item.url == payload.url).first()
        if url_taken:
            raise HTTPException(status_code=400, detail=DUPLICATE_URL_MESSAGE)

    apply_partial_update(item, payload)
    db.commit()
    db.refresh(item)
    return {
        "id": item.id,
        "title": item.title,
        "price": item.price,
        "location": item.location,
        "url": item.url,
        "source": item.source,
        "item_type": item.item_type,
        "category": item.category,
        "notes": item.notes,
        "created_at": item.created_at,
        "group_ids": [g.id for g in item.groups],
    }

# Hirdetes vegleges torlese az adatbazisbol
@app.delete("/api/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="A hirdetés nem található.")
    db.delete(item)
    db.commit()

# Scrape varazslo inditasa celzott kategoriakkal es relacios osszefesulessel
@app.post("/api/items/scrape", response_model=ScrapeTriggerResponse)
def trigger_catalog_scrape(
    payload: ScrapeTriggerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, object]:
    scraped_items, pages_scraped = scrape_catalog(
        item_types=payload.item_types,
        bike_categories=payload.bike_categories,
        part_categories=payload.part_categories,
        sources=payload.sources,
        mode=payload.mode.value,
    )

    new_added = 0
    updated = 0

    for raw_item in scraped_items:
        url_str = str(raw_item.get("url") or "")
        if not url_str:
            continue
        existing_item = db.query(Item).filter(Item.url == url_str).first()
        if existing_item:
            changed = False
            if existing_item.price != raw_item.get("price"):
                existing_item.price = raw_item.get("price")
                changed = True
            if existing_item.title != raw_item.get("title"):
                existing_item.title = str(raw_item.get("title") or "")
                changed = True
            if raw_item.get("location") and existing_item.location != raw_item.get("location"):
                existing_item.location = str(raw_item.get("location"))
                changed = True
            if changed:
                updated += 1
        else:
            new_item_entity = Item(
                title=str(raw_item.get("title") or ""),
                price=raw_item.get("price") if isinstance(raw_item.get("price"), int) else None,
                location=str(raw_item.get("location")) if raw_item.get("location") else None,
                url=url_str,
                source=str(raw_item.get("source") or "bringakereso"),
                item_type=str(raw_item.get("item_type") or "bike"),
                category=str(raw_item.get("category")) if raw_item.get("category") else None,
                notes=None,
            )
            db.add(new_item_entity)
            new_added += 1

    db.commit()
    total_in_db = db.query(Item).count()

    return {
        "mode": payload.mode.value,
        "pages_scraped": pages_scraped,
        "new_added": new_added,
        "updated": updated,
        "total_items": total_in_db,
    }

# Scraper szinkronizacio inditasa a valasztott modban
@app.post("/api/bikes/scrape", response_model=ScrapeResponse)
def trigger_scrape(
    mode: ScrapeMode = Query(default=ScrapeMode.LATEST, description="Szinkronizációs mód: latest vagy all"),
    current_user: User = Depends(get_current_user),
) -> dict[str, str | int]:
    try:
        return sync_bikes(mode=mode.value)
    except (ValueError, OSError) as err:
        raise HTTPException(
            status_code=500,
            detail=f"Hiba történt a hirdetések szinkronizálása során: {err}",
        ) from err