import json
from pathlib import Path
import sys
from typing import Final
from sqlalchemy.orm import Session

# Mappak rogzitese a keresesi utvonalhoz
CURRENT_DIR: Final[Path] = Path(__file__).resolve().parent
ROOT_DIR: Final[Path] = CURRENT_DIR.parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from auth import get_password_hash
from database import Base, SessionLocal, engine
from models import Group, Item, User

# Kerekpar kategoria meghatarozasa a hirdetes cime alapjan
def detect_bike_category(title: str) -> str:
    lower_title = title.lower()
    if "trail" in lower_title:
        return "Trail"
    if "e-bike" in lower_title or "ebike" in lower_title:
        return "E-Bike"
    if "enduro" in lower_title:
        return "Enduro"
    if "dh" in lower_title or "downhill" in lower_title:
        return "DH"
    return "MTB"

# Alapertelmezett minta alkatreszek listaja mindket tipus reprezentalasahoz
SAMPLE_PARTS: Final[list[dict[str, str | int | None]]] = [
    {
        "title": "RockShox Pike Select 29 140mm villa",
        "price": 185000,
        "location": "Debrecen, Magyarország",
        "url": "https://bringakereso.hu/hirdetes/sample-part-rockshox-pike/",
        "source": "bringakereso",
        "item_type": "part",
        "category": "Villa",
        "notes": "Kivalo allapot, frissen szervizelt becsuszo.",
    },
    {
        "title": "Shimano Deore XT M8120 4 dugattyus tarcsafek szett",
        "price": 89000,
        "location": "Budapest, Magyarország",
        "url": "https://bringakereso.hu/hirdetes/sample-part-shimano-xt-fek/",
        "source": "bringakereso",
        "item_type": "part",
        "category": "Fék",
        "notes": None,
    },
    {
        "title": "Specialized Stumpjumper EVO carbon vaz L-es",
        "price": 450000,
        "location": "Vac, Magyarország",
        "url": "https://bringakereso.hu/hirdetes/sample-part-specialized-vaz/",
        "source": "bringakereso",
        "item_type": "part",
        "category": "Váz",
        "notes": "karcos becsuszo mentes forgopontok, ujszeru tag.",
    },
    {
        "title": "SRAM GX Eagle 12s hatso valto",
        "price": 38000,
        "location": "Pecs, Magyarország",
        "url": "https://bringakereso.hu/hirdetes/sample-part-sram-gx-valto/",
        "source": "bringakereso",
        "item_type": "part",
        "category": "Váltó",
        "notes": None,
    },
    {
        "title": "DT Swiss E1900 Spline 29 boost kerekszett",
        "price": 120000,
        "location": "Gyor, Magyarország",
        "url": "https://bringakereso.hu/hirdetes/sample-part-dt-swiss-kerek/",
        "source": "bringakereso",
        "item_type": "part",
        "category": "Kerékszett",
        "notes": None,
    },
]

# Tablak letrehozasa es kezdo adatok betoltese
def seed_database(db_session: Session | None = None) -> None:
    print("[BikeSeeker] Adatbázis táblák ellenőrzése és inicializálása...")
    Base.metadata.create_all(bind=engine)

    db = db_session or SessionLocal()
    try:
        # Alapertelmezett admin felhasznalo letrehozasa
        admin_user = db.query(User).filter(User.username == "admin").first()
        if not admin_user:
            default_prefs = json.dumps(
                {
                    "item_types": ["bike"],
                    "bike_categories": ["MTB", "Trail", "Enduro", "DH", "E-Bike"],
                    "part_categories": ["Villa", "Váz", "Fék", "Váltó", "Kerékszett", "Hajtás"],
                    "sources": ["bringakereso"],
                },
                ensure_ascii=False,
            )
            admin_user = User(
                username="admin",
                password_hash=get_password_hash("admin"),
                scrape_preferences=default_prefs,
            )
            db.add(admin_user)
            print("[BikeSeeker] Admin fiók létrehozva (admin / admin).")

        # Alapertelmezett csoportok letrehozasa
        favorites_group = db.query(Group).filter(Group.name == "Kedvencek").first()
        if not favorites_group:
            favorites_group = Group(
                name="Kedvencek",
                description="Kiemelt erdeklodesre szamot tarto kerekparok es alkatreszek gyujtemenye.",
            )
            db.add(favorites_group)

        trail_group = db.query(Group).filter(Group.name == "Trail projekt").first()
        if not trail_group:
            trail_group = Group(
                name="Trail projekt",
                description="Epites alatt levo trail bringahoz kivalasztott vazak es kompatibilis alkatreszek.",
            )
            db.add(trail_group)

        db.commit()

        # Minta hirdetesek betoltese ha a tabla meg ures
        existing_items_count = db.query(Item).count()
        if existing_items_count == 0:
            sample_file = ROOT_DIR / "scraper" / "bikes_data.sample.json"
            created_items: list[Item] = []

            # Minta kerekparok importalasa a json allomanybol
            if sample_file.exists():
                with open(sample_file, "r", encoding="utf-8") as f:
                    bikes_data = json.load(f)

                for entry in bikes_data:
                    title_str = str(entry.get("title", ""))
                    item = Item(
                        title=title_str,
                        price=entry.get("price"),
                        location=entry.get("location"),
                        url=str(entry.get("url")),
                        source=str(entry.get("source", "bringakereso")),
                        item_type="bike",
                        category=detect_bike_category(title_str),
                        notes=None,
                    )
                    db.add(item)
                    created_items.append(item)

            # Minta alkatreszek hozzaadasa
            for part_data in SAMPLE_PARTS:
                part_item = Item(
                    title=str(part_data["title"]),
                    price=part_data["price"] if isinstance(part_data["price"], int) else None,
                    location=str(part_data["location"]),
                    url=str(part_data["url"]),
                    source=str(part_data["source"]),
                    item_type=str(part_data["item_type"]),
                    category=str(part_data["category"]),
                    notes=part_data["notes"] if isinstance(part_data["notes"], str) else None,
                )
                db.add(part_item)
                created_items.append(part_item)

            db.commit()

            # Minta hirdetesek osszerendelese a csoportokkal a kapcsolotablan keresztul
            if favorites_group and len(created_items) >= 4:
                favorites_group.items.append(created_items[0])
                favorites_group.items.append(created_items[1])
                favorites_group.items.append(created_items[-1])

            if trail_group and len(created_items) >= 7:
                trail_bike = next((b for b in created_items if b.category == "Trail"), created_items[6])
                trail_bike.notes = "karcos becsuszo"
                trail_group.items.append(trail_bike)
                trail_group.items.append(created_items[-3])
                trail_group.items.append(created_items[-5])

            db.commit()
            print(f"[BikeSeeker] {len(created_items)} db minta hirdetés és csoport kapcsolatok sikeresen inicializálva.")
        else:
            print("[BikeSeeker] Az adatbázis már tartalmaz adatokat, seedelés kihagyva.")

    finally:
        # Csak a sajat magunk altal nyitott munkamenetet zarjuk le
        if db_session is None:
            db.close()

if __name__ == "__main__":
    seed_database()