from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime
from enum import Enum
from typing import Final

NULL_NOT_ALLOWED_MESSAGE: Final[str] = "A mező értéke nem lehet null."

# Scraper szinkronizacios modok felsorolasa
class ScrapeMode(str, Enum):
    LATEST = "latest"
    ALL = "all"

# Felhasznaloi bejelentkezeshez szukseges adatok
class LoginRequest(BaseModel):
    username: str
    password: str

# Scrape varazslo mentett szuresi beallitasai
class ScrapePreferencesSchema(BaseModel):
    item_types: list[str] = Field(default_factory=lambda: ["bike"])
    bike_categories: list[str] = Field(
        default_factory=lambda: ["MTB", "Trail", "Enduro", "DH", "E-Bike"]
    )
    part_categories: list[str] = Field(
        default_factory=lambda: ["Villa", "Váz", "Fék", "Váltó", "Kerékszett", "Hajtás"]
    )
    sources: list[str] = Field(default_factory=lambda: ["bringakereso"])

# Felhasznaloi profil valaszmodellje a mentett beallitasokkal
class UserResponse(BaseModel):
    id: int
    username: str
    scrape_preferences: ScrapePreferencesSchema | None = None

    model_config = ConfigDict(from_attributes=True)

# Sikeres bejelentkezeskor visszakuldott JWT valasz
class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

# Felhasznaloi preferenciak frissitesere szolgalo keres
class PreferencesUpdateRequest(BaseModel):
    item_types: list[str]
    bike_categories: list[str]
    part_categories: list[str]
    sources: list[str]

# Csoport alapertelmezett adatai
class GroupBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=150)
    description: str | None = None

# Uj csoport letrehozasa
class GroupCreate(GroupBase):
    pass

# Csoport adatainak modositasa
class GroupUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None

    # Kotelezo oszlop kifejezett null ertekkel nem torolheto
    @field_validator("name")
    @classmethod
    def reject_explicit_null(cls, value: str | None) -> str:
        if value is None:
            raise ValueError(NULL_NOT_ALLOWED_MESSAGE)
        return value

# Csoport valaszmodell az elemek szamaval
class GroupResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    created_at: datetime
    item_count: int = 0

    model_config = ConfigDict(from_attributes=True)

# Hirdetes alapertelmezett adatai
class ItemBase(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str = Field(min_length=1, max_length=255)
    price: int | None = Field(default=None, ge=0)
    location: str | None = None
    url: str = Field(min_length=1, max_length=500)
    source: str = Field(default="bringakereso", max_length=100)
    item_type: str = Field(default="bike", max_length=50)
    category: str | None = None
    notes: str | None = None

# Uj hirdetes letrehozasa akar azonnali csoport hozzerendelessel
class ItemCreate(ItemBase):
    group_id: int | None = None
    group_ids: list[int] = Field(default_factory=list)

# Hirdetes adatainak es felhasznaloi megjegyzesenek modositasa
class ItemUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=255)
    price: int | None = Field(default=None, ge=0)
    location: str | None = None
    url: str | None = Field(default=None, min_length=1, max_length=500)
    source: str | None = Field(default=None, min_length=1, max_length=100)
    item_type: str | None = Field(default=None, min_length=1, max_length=50)
    category: str | None = None
    notes: str | None = None

    # Kotelezo oszlopok kifejezett null ertekkel nem torolhetok
    @field_validator("title", "url", "source", "item_type")
    @classmethod
    def reject_explicit_null(cls, value: str | None) -> str:
        if value is None:
            raise ValueError(NULL_NOT_ALLOWED_MESSAGE)
        return value

# Hirdetes valaszmodell a hozza kapcsolt csoportok azonositoival
class ItemResponse(BaseModel):
    id: int
    title: str
    price: int | None = None
    location: str | None = None
    url: str
    source: str
    item_type: str
    category: str | None = None
    notes: str | None = None
    created_at: datetime
    group_ids: list[int] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

# Lapozott hirdeteslista valaszmodell
class ItemListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[ItemResponse]

# Scrape varazslo inditasi parameterei
class ScrapeTriggerRequest(BaseModel):
    item_types: list[str] = Field(default_factory=lambda: ["bike"])
    bike_categories: list[str] = Field(
        default_factory=lambda: ["MTB", "Trail", "Enduro", "DH", "E-Bike"]
    )
    part_categories: list[str] = Field(
        default_factory=lambda: ["Villa", "Váz", "Fék", "Váltó", "Kerékszett", "Hajtás"]
    )
    sources: list[str] = Field(default_factory=lambda: ["bringakereso"])
    mode: ScrapeMode = ScrapeMode.LATEST

# Scrape futtatas eredmenyenek osszesitese
class ScrapeTriggerResponse(BaseModel):
    mode: str
    pages_scraped: int
    new_added: int
    updated: int
    total_items: int