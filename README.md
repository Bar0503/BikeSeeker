# BikeSeeker

Használt kerékpár hirdetéseket aggregáló és kereső webalkalmazás. A rendszer különböző online piacterekről gyűjti össze a hirdetéseket, majd egy REST API-n és egy React alapú webes felületen keresztül teszi azokat kereshetővé és szűrhetővé.

## Főbb funkciók

- **Többszavas keresés:** Keresés a hirdetések címében. Több kulcsszó megadása esetén a találatnak minden szót tartalmaznia kell, a szavak sorrendjétől függetlenül.
- **Árszűrés és rendezés:** Minimum és maximum árhatárok beállítása, valamint növekvő és csökkenő ár szerinti rendezés. A hiányzó (`null`) árral rendelkező hirdetések minden esetben a lista végére kerülnek.
- **Helyszín alapú szűrés:** Település vagy régió szerinti szűrés kis- és nagybetű érzéketlenül.
- **Oldalszámozás:** A találati lista szerveroldali darabolása (alapértelmezetten 12 elem oldalanként).
- **Automatikus mintaadat-betöltés (Fallback):** Amennyiben a scraper által generált éles adatfájl (`bikes_data.json`) nem található, a backend automatikusan a verziókövetett `bikes_data.sample.json` fájlt tölti be.

## Technológiai stack

**Backend**
- Python 3.10+
- FastAPI (REST API végpontok és kérésvalidáció)
- Pydantic (Adatmodellek és típusellenőrzés)
- Uvicorn (ASGI szerver)

**Frontend**
- React 18 + TypeScript
- Vite (Fejlesztői szerver és build eszköz)
- Tailwind CSS v3

## Projekt felépítése

```text
BikeSeeker/
├── backend/
│   └── main.py                   # FastAPI alkalmazás, végpontok és szűrési logika
├── frontend/
│   ├── src/
│   │   ├── components/           # UI komponensek (BikeCard, FilterBar, Pagination)
│   │   ├── services/             # API hívások (bikeService.ts)
│   │   ├── types/                # TypeScript típusdefiníciók (bike.ts)
│   │   ├── App.tsx               # Fő komponens és állapotkezelés
│   │   └── main.tsx              # Alkalmazás belépési pont
│   ├── package.json
│   └── tailwind.config.js
├── scraper/
│   ├── bikes_data.sample.json    # Mintaadatok teszteléshez és bemutatóhoz
│   └── bikes_data.json           # Scrapelt adatok (helyben generált, nem verziókövetett)
├── requirements.txt              # Python függőségek
├── setup.bat                     # Környezet telepítő script (Windows)
└── start.bat                     # Alkalmazás indító script (Windows)
```

## Telepítés és futtatás

### Előfeltételek
- Python 3.10 vagy újabb
- Node.js 18 vagy újabb (npm csomagkezelővel)

### 1. Indítás Windows alatt (Batch scriptekkel)

A gyökérmappában található scriptek elvégzik a virtuális környezet létrehozását, a csomagok telepítését és a szerverek indítását.

1. Klónozd a tárolót:
   ```powershell
   git clone https://github.com/Bar0503/BikeSeeker.git
   cd BikeSeeker
   ```

2. Futtasd a telepítőt (létrehozza a `venv` mappát, telepíti a `pip` és `npm` csomagokat):
   ```powershell
   .\setup.bat
   ```

3. Indítsd el az alkalmazást:
   ```powershell
   .\start.bat
   ```
   A `start.bat` megnyitja a Backend és Frontend folyamatokat (Windows Terminal megléte esetén egy ablakban, külön füleken), majd megnyitja a `http://localhost:5173` címet a böngészőben.

### 2. Manuális indítás

**Backend**
```bash
python -m venv venv

# Aktiválás Windows-on:
.\venv\Scripts\activate
# Aktiválás Linux/macOS-en:
source venv/bin/activate

pip install -r requirements.txt
cd backend
uvicorn main:app --reload
```
A szerver alapértelmezetten a `http://localhost:8000` címen fut.

**Frontend**
```bash
cd frontend
npm install
npm run dev
```
A webes felület a `http://localhost:5173` címen érhető el.

## API végpontok

A szerver futása közben az interaktív Swagger dokumentáció elérhető a `http://localhost:8000/docs` címen.

### `GET /api/bikes`

Visszaadja a szűrt, rendezett és lapozott hirdetések listáját.

| Paraméter | Típus | Alapértelmezett | Leírás |
| ---- | ---- | ---- | ---- |
| `query` | `string` | `None` | Keresőszó vagy szavak a hirdetés címében |
| `min_price` | `int` | `None` | Minimum ár (HUF) |
| `max_price` | `int` | `None` | Maximum ár (HUF) |
| `location` | `string` | `None` | Helyszín szűrése |
| `sort_by` | `string` | `None` | Rendezés: `price_asc` vagy `price_desc` |
| `page` | `int` | `1` | Oldalszám (1-től indul) |
| `page_size` | `int` | `12` | Elemek száma oldalanként (max. 100) |

**Példa válasz (`200 OK`):**
```json
{
  "total": 42,
  "page": 1,
  "page_size": 12,
  "total_pages": 4,
  "items": [
    {
      "title": "Merida Dualtrust 26 M",
      "price": 420000,
      "location": "Budapest",
      "url": "https://example.com/hirdetes/12345",
      "source": "testbike"
    }
  ]
}
```