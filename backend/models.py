from datetime import datetime, timezone
from pathlib import Path
import sys
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship

# Backend mappa eleresi utjanak rogzitese az egyseges modulimportokhoz
BACKEND_DIR = str(Path(__file__).resolve().parent)
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from database import Base

# Kapcsolotabla a csoportok es hirdetesek kapcsolatanak tarolasara
group_items = Table(
    "group_items",
    Base.metadata,
    Column("group_id", Integer, ForeignKey("groups.id", ondelete="CASCADE"), primary_key=True),
    Column("item_id", Integer, ForeignKey("items.id", ondelete="CASCADE"), primary_key=True),
    Column("added_at", DateTime, default=lambda: datetime.now(timezone.utc), nullable=False),
)

# Felhasznalo entitas az autentikaciohoz es mentett beallitasokhoz
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    scrape_preferences = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

# Csoport entitas hirdetesek egyedi gyujtemenyeinek kezelesehez
class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    items = relationship("Item", secondary=group_items, back_populates="groups")

# Hirdetes vagy alkatresz entitas szureshez es gyujtemenyekhez
class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    price = Column(Integer, nullable=True, index=True)
    location = Column(String(255), nullable=True)
    url = Column(String(500), unique=True, nullable=False, index=True)
    source = Column(String(100), nullable=False, index=True)
    item_type = Column(String(50), nullable=False, index=True)
    category = Column(String(50), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    groups = relationship("Group", secondary=group_items, back_populates="items")