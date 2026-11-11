from datetime import datetime, timezone
from pathlib import Path
import sys
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

# Backend mappa eleresi utjanak rogzitese az egyseges modulimportokhoz
BACKEND_DIR = str(Path(__file__).resolve().parent)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database import Base

# Letrehozasi idobelyeg alapertelmezett erteke
def utc_now() -> datetime:
    return datetime.now(timezone.utc)

# Kapcsolotabla a csoportok es hirdetesek kapcsolatanak tarolasara
group_items = Table(
    "group_items",
    Base.metadata,
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    Column("item_id", Integer, ForeignKey("items.id", ondelete="CASCADE"), primary_key=True),
    Column("added_at", DateTime, default=utc_now, nullable=False),
)

# Felhasznalo entitas az autentikaciohoz es mentett beallitasokhoz
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    scrape_preferences: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

# Csoport entitas hirdetesek egyedi gyujtemenyeinek kezelesehez
class Group(Base):
    __tablename__ = "groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150))
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now)

    items: Mapped[list["Item"]] = relationship(secondary=group_items, back_populates="groups")

# Hirdetes vagy alkatresz entitas szureshez es gyujtemenyekhez
class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    price: Mapped[int | None] = mapped_column(Integer, index=True)
    location: Mapped[str | None] = mapped_column(String(255))
    url: Mapped[str] = mapped_column(String(500), unique=True, index=True)
    source: Mapped[str] = mapped_column(String(100), index=True)
    item_type: Mapped[str] = mapped_column(String(50), index=True)
    category: Mapped[str | None] = mapped_column(String(50), index=True)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utc_now, index=True)

    groups: Mapped[list[Group]] = relationship(secondary=group_items, back_populates="items")
