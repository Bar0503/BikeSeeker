# BikeSeeker

Használt kerékpár hirdetéseket aggregáló, szinkronizáló és kereső full-stack webalkalmazás. A rendszer online piacterekről gyűjti össze a kerékpárhirdetéseket, majd egy FastAPI alapú REST API-n és egy modern, sötét témájú React + TypeScript felületen keresztül teszi azokat valós időben kereshetővé, szűrhetővé és frissíthetővé.

---

## Főbb funkciók

### Keresés, szűrés és megjelenítés
- **Többszavas címszűrés:** A keresőmezőben megadott összes kulcsszónak szerepelnie kell a hirdetés címében, a szavak sorrendjétől és a kis-/nagybetűktől függetlenül.
- **Ártartomány-szűrés és intelligens rendezés:** Minimum és maximum árhatárok megadása szerveroldali validációval, valamint növekvő (`price_asc`) és csökkenő (`price_desc`) ár szerinti rendezés. A hiányzó (`null`) árú hirdetések mindkét rendezési iránynál garantáltan a találati lista végére kerülnek.
- **Helyszín alapú szűrés:** Település vagy régió szerinti részszavas, kis- és nagybetű-érzéketlen keresés.
- **Szerveroldali lapozás:** A találatok darabolása alapértelmezetten 12 elemre oldalanként (maximum 100 elem/oldal).
- **Elavult kérések megszakítása (`AbortController`):** Gyors gépelés vagy szűrőváltás esetén a frontend automatikusan megszakítja a még függőben lévő korábbi HTTP kéréseket, megelőzve a versenyhelyzeteket (race conditions).

### Adatgyűjtés és hibatűrés
- **Kétlépcsős Scraper szinkronizáció (`latest` és `all` mód):**
  - **Gyors frissítés (`latest`):** Csak a legfrissebb (1. oldalas) hirdetéseket tölti le, majd $O(n)$ időben összefésüli a meglévő adatállománnyal (az új hirdetések a lista elejére kerülnek, a meglévők ára/címe változás esetén frissül).
  - **Teljes szinkronizáció (`all`):** Végiglapozza a forrásoldal összes elérhető oldalát a teljes MTB kínálat letöltéséhez, kíméletes kérésközti késleltetéssel és duplikáció-szűréssel.
- **Atomi fájlmentés:** A scraper ideiglenes (`.tmp`) fájlon keresztül végzi az írást, így a JSON adatfájl váratlan leállás vagy párhuzamos olvasás közben sem sérülhet meg.
- **Automatikus mintaadat-betöltés (Offline Fallback):** Ha az éles `scraper/bikes_data.json` fájl még nem létezik, a backend automatikusan a verziókövetett `scraper/bikes_data.sample.json` állományt tölti be, így az alkalmazás internetkapcsolat vagy előzetes scrapelés nélkül is azonnal bemutatható.

---

## Technológiai stack

| Réteg | Technológiák | Szerep |
| :--- | :--- | :--- |
| **Backend** | Python 3.10+, FastAPI, Pydantic, Uvicorn | REST API végpontok, bemenet-validáció, szűrési/rendezési üzleti logika |
| **Scraper** | Requests, BeautifulSoup4, Regex | Többoldalas HTML feldolgozás, ártisztítás, inkrementális adatösszefésülés |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS v3 | Reszponzív felhasználói felület, állapotkezelés, API kommunikáció |
| **DevOps / Scriptek** | Windows Batch (`setup.bat`, `start.bat`), Git | Automatizált virtuális környezet építés és többablakos szerverindítás |

---

## Projekt felépítése

```text
BikeSeeker/
├── backend/
│   ├── main.py                   # FastAPI alkalmazas, vegpontok es szuresi logika
│   └── requirements.txt          # Backend specifikus Python fuggosegek
├── frontend/
│   ├── public/                   # Statikus fajlok es ikonok
│   ├── src/
│   │   ├── assets/               # Kepek es illusztraciok
│   │   ├── components/
│   │   │   ├── BikeCard.tsx      # Egyetlen kerekpar hirdetes kartya komponense
│   │   │   ├── FilterBar.tsx     # Kereso- es szuropanel komponens
│   │   │   └── Pagination.tsx    # Oldallapozo navigacios komponens
│   │   ├── services/
│   │   │   └── bikeService.ts    # HTTP kliens a backend API hivasokhoz
│   │   ├── types/
│   │   │   └── bike.ts           # TypeScript interfeszek es tipusdefiniciok
│   │   ├── App.tsx               # Fokomponens, allapotkezeles es szinkronizacio
│   │   ├── index.css             # Tailwind CSS alapstilusok
│   │   └── main.tsx              # React belepesi pont
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── vite.config.ts
├── scraper/
│   ├── scraper.py                # Tobboldalas MTB scraper es szinkronizalo modul
│   ├── bikes_data.sample.json    # Verziokovetett mintaadatok bemutatohoz (fallback)
│   ├── bikes_data.json           # Scrapelt eles adatok (lokalisan generalt)
│   └── requirements.txt          # Scraper specifikus Python fuggosegek
├── requirements.txt              # Teljes projekt Python fuggosegei
├── setup.bat                     # Kornyezet telepito script (Windows)
├── start.bat                     # Alkalmazas indito script (Windows)
└── README.md                     # Projekt dokumentacio
```

---

## Telepítés és futtatás

### Előfeltételek
- **Python:** 3.10 vagy újabb verzió (telepítéskor az `Add Python to PATH` opció legyen bepipálva)
- **Node.js:** 18.x vagy újabb verzió (a hozzá tartozó `npm` csomagkezelővel)
- **Git:** A tároló klónozásához

### 1. Gyorsindítás Windows alatt (Automatizált scriptekkel)

A gyökérmappában található batch scriptek egyetlen paranccsal felépítik a teljes fejlesztői és futtatói környezetet.

1. Klónozd a tárolót és lépj be a mappába:
   ```powershell
   git clone https://github.com/Bar0503/BikeSeeker.git
   cd BikeSeeker
   ```

2. Futtasd a telepítő scriptet (létrehozza a `venv` virtuális környezetet, telepíti a Python és az `npm` csomagokat):
   ```powershell
   .\setup.bat
   ```

3. Indítsd el a teljes alkalmazást:
   ```powershell
   .\start.bat
   ```
   A `start.bat` elindítja a FastAPI backendet (`http://localhost:8000`) és a Vite frontendet (`http://localhost:5173`) külön Windows Terminal füleken, majd automatikusan megnyitja a webalkalmazást a böngészőben.

### 2. Gyorsindítás macOS és Linux alatt (Shell scriptekkel)

A gyökérmappában található `.sh` scriptek automatizálják a `venv` felépítését, a csomagok telepítését, valamint a Backend és Frontend folyamatok párhuzamos indítását és tiszta leállítását (`Ctrl+C`).

1. Adj futtatási jogosultságot a scripteknek, majd futtasd a telepítőt:
   ```bash
   chmod +x setup.sh start.sh
   ./setup.sh

---

### 3. Manuális indítás (Windows, Linux, macOS)

Ha külön terminálokban vagy nem Windows rendszeren szeretnéd futtatni a komponenseket:

#### Backend indítása
```bash
# Virtualis kornyezet letrehozasa a gyokermappaban
python -m venv venv

# Aktivalas Windows (PowerShell) alatt:
.\venv\Scripts\Activate.ps1

# Aktivalas Linux / macOS alatt:
source venv/bin/activate

# Fuggosegek telepitese es a FastAPI szerver inditasa
pip install -r requirements.txt
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

#### Frontend indítása (új terminálablakban)
```bash
cd frontend
npm install
npm run dev
```
A frontend felület a `http://localhost:5173` címen érhető el.

---

## Scraper használata parancssorból (CLI)

A hirdetések frissítése a webes felület fejlécében található **Legfrissebbek** és **Összes MTB lekérése** gombok mellett közvetlenül terminálból is futtatható (aktivált `venv` mellett):

```bash
# Gyors szinkronizacio: csak az 1. oldal (legfrissebb hirdetesek) lekerese es osszefesulese
python scraper/scraper.py

# Teljes szinkronizacio: az osszes elerheto MTB oldal vegiglapozasa
python scraper/scraper.py --all
```

---

## REST API Dokumentáció

A backend futása közben az interaktív Swagger UI felület elérhető a `http://localhost:8000/docs` címen, az OpenAPI specifikáció pedig a `http://localhost:8000/openapi.json` útvonalon.

### 1. `GET /`
Egyszerű állapotellenőrző (healthcheck) végpont.

- **Sikeres válasz (`200 OK`):**
  ```json
  {
    "message": "BikeSeeker API is running"
  }
  ```

### 2. `GET /api/bikes`
Visszaadja a szűrt, rendezett és lapozott kerékpárhirdetéseket.

#### Lekérdezési paraméterek (Query Parameters)

| Paraméter | Típus | Kötelező | Alapértelmezett | Leírás |
| :--- | :--- | :--- | :--- | :--- |
| `query` | `string` | Nem | `None` | Keresőszavak a címben (szóközzel elválasztva, mindegyiknek szerepelnie kell) |
| `min_price` | `int` | Nem | `None` | Minimum ár forintban (`>= 0`) |
| `max_price` | `int` | Nem | `None` | Maximum ár forintban (`>= 0`, nem lehet kisebb a `min_price` értékénél) |
| `location` | `string` | Nem | `None` | Település vagy régió szűrése |
| `sort_by` | `string` | Nem | `None` | Ár szerinti rendezés: `price_asc` (növekvő) vagy `price_desc` (csökkenő) |
| `page` | `int` | Nem | `1` | Lekért oldalszám (`>= 1`) |
| `page_size` | `int` | Nem | `12` | Elemek száma oldalanként (`1` és `100` között) |

- **Sikeres válasz (`200 OK`):**
  ```json
  {
    "total": 189,
    "page": 1,
    "page_size": 12,
    "total_pages": 16,
    "items": [
      {
        "title": "Trek Marlin 7 Gen 3 29 MTB",
        "price": 285000,
        "location": "Budapest",
        "url": "https://bringakereso.hu/hirdetes/trek-marlin-7-gen-3/",
        "source": "bringakereso"
      }
    ]
  }
  ```
- **Hibaválasz (`400 Bad Request` – érvénytelen ártartomány esetén):**
  ```json
  {
    "detail": "A minimum ár nem lehet nagyobb a maximum árnál."
  }
  ```

### 3. `POST /api/bikes/scrape`
Elindítja a forrásoldal scrapelését a megadott módban, majd atomi fájlírással frissíti a `scraper/bikes_data.json` állományt.

#### Lekérdezési paraméterek (Query Parameters)

| Paraméter | Típus | Kötelező | Alapértelmezett | Leírás |
| :--- | :--- | :--- | :--- | :--- |
| `mode` | `string` | Nem | `latest` | `latest` (csak az 1. oldal) vagy `all` (összes elérhető oldal) |

- **Sikeres válasz (`200 OK`):**
  ```json
  {
    "mode": "latest",
    "pages_scraped": 1,
    "new_added": 3,
    "updated": 1,
    "total_bikes": 192
  }
  ```

---

## Környezeti változók (Opcionális)

Az alkalmazás alapértelmezett fejlesztői beállításokkal konfiguráció nélkül is azonnal indul, de produkciós vagy egyedi környezetben az alábbi változókkal felülbírálható:

- **Backend (`CORS_ORIGINS`):** Engedélyezett frontend origin címek vesszővel elválasztva (alapértelmezett: `*`).
- **Frontend (`VITE_API_BASE_URL`):** A backend API alap URL-je (alapértelmezett: `http://127.0.0.1:8000/api`).