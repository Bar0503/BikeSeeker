from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

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
    name: str = Field(min_length=1, max_length=150)
    description: str | None = None

# Uj csoport letrehozasa
class GroupCreate(GroupBase):
    pass

# Csoport adatainak modositasa
class GroupUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=150)
    description: str | None = None

# Csoport valaszmodell az elemek szamaval
class GroupResponse(BaseModel):
    id: int
    name: str
    description: str | None = None
    created_at: datetime
    items_count: int = 0

    model_config = ConfigDict(from_attributes=True)

# Hirdetes alapertelmezett adatai
class ItemBase(BaseModel):
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

# Hirdetes adatainak es felhasznaloi megjegyzesenek modositasa
class ItemUpdate(BaseModel):
    title: str | None = None
    price: int | None = Field(default=None, ge=0)
    location: str | None = None
    url: str | None = None
    source: str | None = None
    item_type: str | None = None
    category: str | None = None
    notes: str | None = None

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
    mode: str = Field(default="latest")

# Scrape futtatas eredmenyenek osszesitese
class ScrapeTriggerResponse(BaseModel):
    mode: str
    pages_scraped: int
    new_added: int
    updated: int
    total_items: int