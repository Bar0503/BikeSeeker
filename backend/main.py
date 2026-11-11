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
from sqlalchemy import ColumnElement, func
from sqlalchemy.orm import Session, selectinload

from auth import create_access_token, get_current_user, verify_password
from database import (
    SEARCH_NORMALIZE_FUNCTION,
    Base,
    SessionLocal,
    engine,
    get_db,
    normalize_search_text,
)
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

from scraper.scraper import scrape_catalog

# Konfiguracios konstansok es fajl eleresi utak
DUPLICATE_URL_MESSAGE: Final[str] = "Ezzel az URL-lel már létezik tétel az adatbázisban."
GROUP_NOT_FOUND_MESSAGE: Final[str] = "A megadott csoport nem található."
ITEM_NOT_FOUND_MESSAGE: Final[str] = "A hirdetés nem található."
DEFAULT_PAGE_SIZE: Final[int] = 12
MAX_PAGE_SIZE: Final[int] = 100
ALLOWED_ORIGINS: Final[list[str]] = os.getenv("CORS_ORIGINS", "*").split(",")

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

# CORS middleware: a token fejlecben utazik, ezert suti alapu hitelesites nem kell
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



# Rendezesi opciok felsorolasa
class SortOption(str, Enum):
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"


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

# Kis- es nagybetu, valamint ekezet fuggetlen reszszoveg szures egy szoveges oszlopra
def contains_normalized(column: ColumnElement[str], term: str) -> ColumnElement[bool]:
    normalized_column = getattr(func, SEARCH_NORMALIZE_FUNCTION)(column)
    return normalized_column.like(f"%{normalize_search_text(term)}%")

# Csoport lekerese a tetelekkel egyutt, hianyzo csoportnal 404-es hibaval
def get_group_or_404(db: Session, group_id: int) -> Group:
    group = (
        db.query(Group)
        .options(selectinload(Group.items))
        .filter(Group.id == group_id)
        .first()
    )
    if not group:
        raise HTTPException(status_code=404, detail=GROUP_NOT_FOUND_MESSAGE)
    return group

# Hirdetes lekerese a csoportjaival egyutt, hianyzo hirdetesnel 404-es hibaval
def get_item_or_404(db: Session, item_id: int) -> Item:
    item = (
        db.query(Item)
        .options(selectinload(Item.groups))
        .filter(Item.id == item_id)
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail=ITEM_NOT_FOUND_MESSAGE)
    return item

# Felhasznaloi profil valasz felepitese a dekodolt beallitasokkal
def build_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.username,
        scrape_preferences=parse_user_preferences(user.scrape_preferences),
    )

# Csoport valasz felepitese a megadott elemszammal
def build_group_response(group: Group, item_count: int) -> GroupResponse:
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        created_at=group.created_at,
        item_count=item_count,
    )

# Hirdetes valasz felepitese a kapcsolt csoportok azonositoival
def build_item_response(item: Item) -> ItemResponse:
    return ItemResponse(
        id=item.id,
        title=item.title,
        price=item.price,
        location=item.location,
        url=item.url,
        source=item.source,
        item_type=item.item_type,
        category=item.category,
        notes=item.notes,
        created_at=item.created_at,
        group_ids=[group.id for group in item.groups],
    )

# Bejelentkezes ellenorzese es JWT Bearer token kiallitasa
@app.post("/api/auth/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Hibás felhasználónév vagy jelszó.",
        )

    token = create_access_token(data={"sub": user.username})
    return TokenResponse(access_token=token, user=build_user_response(user))

# Aktualisan bejelentkezett felhasznalo adatainak lekerese
@app.get("/api/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return build_user_response(current_user)

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

# Csoportok listazasa az elemek szamaval, a szamlalast az adatbazis vegzi
@app.get("/api/groups", response_model=list[GroupResponse])
def get_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GroupResponse]:
    rows = (
        db.query(Group, func.count(group_items.c.item_id))
        .outerjoin(group_items, group_items.c.group_id == Group.id)
        .group_by(Group.id)
        .order_by(Group.created_at.desc())
        .all()
    )
    return [build_group_response(group, item_count) for group, item_count in rows]

# Uj csoport letrehozasa
@app.post("/api/groups", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupResponse:
    new_group = Group(
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return build_group_response(new_group, 0)

# Egyetlen csoport lekerese azonosito alapjan
@app.get("/api/groups/{group_id}", response_model=GroupResponse)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupResponse:
    group = get_group_or_404(db, group_id)
    return build_group_response(group, len(group.items))

# Csoport adatainak modositasa
@app.put("/api/groups/{group_id}", response_model=GroupResponse)
def update_group(
    group_id: int,
    payload: GroupUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupResponse:
    group = get_group_or_404(db, group_id)
    apply_partial_update(group, payload)
    db.commit()
    db.refresh(group)
    return build_group_response(group, len(group.items))

# Csoport torlese a hirdetesek megorzesével
@app.delete("/api/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    group = get_group_or_404(db, group_id)
    db.delete(group)
    db.commit()

# Hirdetes hozzarendelese egy csoporthoz
@app.post("/api/groups/{group_id}/items/{item_id}", response_model=GroupResponse)
def add_item_to_group(
    group_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GroupResponse:
    group = get_group_or_404(db, group_id)
    item = get_item_or_404(db, item_id)
    if item not in group.items:
        group.items.append(item)
        db.commit()
        db.refresh(group)
    return build_group_response(group, len(group.items))

# Hirdetes eltavolitasa egy csoportbol
@app.delete("/api/groups/{group_id}/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item_from_group(
    group_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    group = get_group_or_404(db, group_id)
    item = get_item_or_404(db, item_id)
    if item in group.items:
        group.items.remove(item)
        db.commit()

# Szerver allapot ellenorzo vegpont
@app.get("/")
def root() -> dict[str, str]:
    return {"message": "BikeSeeker API is running"}


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
) -> ItemListResponse:
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
            sql_query = sql_query.filter(contains_normalized(Item.title, word))

    # Ar- es helyszinszurok alkalmazasa
    if min_price is not None:
        sql_query = sql_query.filter(Item.price >= min_price)
    if max_price is not None:
        sql_query = sql_query.filter(Item.price <= max_price)
    if location and location.strip():
        sql_query = sql_query.filter(contains_normalized(Item.location, location.strip()))

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

    return ItemListResponse(
        total=total_count,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
        items=[build_item_response(item) for item in items],
    )

# Uj hirdetes vagy alkatresz manualis letrehozasa tobb csoport tamogatassal
@app.post("/api/items", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ItemResponse:
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
    return build_item_response(new_item)

# Hirdetes adatainak es egyedi megjegyzesenek modositasa
@app.put("/api/items/{item_id}", response_model=ItemResponse)
def update_item(
    item_id: int,
    payload: ItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ItemResponse:
    item = get_item_or_404(db, item_id)

    # URL utkozes ellenorzese a UNIQUE megszoritas megsertese elott
    if payload.url is not None and payload.url != item.url:
        url_taken = db.query(Item.id).filter(Item.url == payload.url).first()
        if url_taken:
            raise HTTPException(status_code=400, detail=DUPLICATE_URL_MESSAGE)

    apply_partial_update(item, payload)
    db.commit()
    db.refresh(item)
    return build_item_response(item)

# Hirdetes vegleges torlese az adatbazisbol
@app.delete("/api/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    item = get_item_or_404(db, item_id)
    db.delete(item)
    db.commit()

# Scrape varazslo inditasa celzott kategoriakkal es relacios osszefesulessel
@app.post("/api/items/scrape", response_model=ScrapeTriggerResponse)
def trigger_catalog_scrape(
    payload: ScrapeTriggerRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScrapeTriggerResponse:
    scraped_items, pages_scraped = scrape_catalog(
        item_types=payload.item_types,
        bike_categories=payload.bike_categories,
        part_categories=payload.part_categories,
        sources=payload.sources,
        mode=payload.mode.value,
    )

    new_added = 0
    updated = 0

    # Mar letezo hirdetesek betoltese egyetlen lekerdezessel URL szerint
    scraped_urls = [str(raw_item.get("url") or "") for raw_item in scraped_items]
    existing_by_url: dict[str, Item] = {
        item.url: item
        for item in db.query(Item).filter(Item.url.in_(scraped_urls)).all()
    }

    for raw_item in scraped_items:
        url_str = str(raw_item.get("url") or "")
        if not url_str:
            continue
        existing_item = existing_by_url.get(url_str)
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
            existing_by_url[url_str] = new_item_entity
            new_added += 1

    db.commit()
    total_in_db = db.query(Item).count()

    return ScrapeTriggerResponse(
        mode=payload.mode.value,
        pages_scraped=pages_scraped,
        new_added=new_added,
        updated=updated,
        total_items=total_in_db,
    )