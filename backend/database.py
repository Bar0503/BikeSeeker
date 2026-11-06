import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

# Adatbazis kapcsolat konfiguracioja kornyezeti valtozo alapjan sqlite fallbackkel
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./bikeseeker.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Adatbazis munkamenet letrehozasa es biztonsagos lezarasa keresenkent
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()