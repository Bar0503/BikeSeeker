import os
import sqlite3
from typing import Final, Generator
import unicodedata
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.pool import ConnectionPoolEntry

# Adatbazis kapcsolat konfiguracioja kornyezeti valtozo alapjan sqlite fallbackkel
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./bikeseeker.db")
IS_SQLITE: Final[bool] = DATABASE_URL.startswith("sqlite")
SEARCH_NORMALIZE_FUNCTION: Final[str] = "search_normalize"

connect_args = {"check_same_thread": False} if IS_SQLITE else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Kisbetusites es ekezetek eltavolitasa, hogy a 'GYŐR', 'győr' es 'gyor' egyezzen
def normalize_search_text(text: str | None) -> str | None:
    if text is None:
        return None
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(char for char in decomposed if not unicodedata.combining(char))

# Az SQLite beepitett lower() fuggvenye csak ASCII betuket ismer, ezert Python fuggvenyt regisztralunk
def register_search_function(
    dbapi_connection: sqlite3.Connection,
    connection_record: ConnectionPoolEntry,
) -> None:
    dbapi_connection.create_function(
        SEARCH_NORMALIZE_FUNCTION, 1, normalize_search_text, deterministic=True
    )

if IS_SQLITE:
    event.listen(engine, "connect", register_search_function)

# Adatbazis munkamenet letrehozasa es biztonsagos lezarasa keresenkent
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
