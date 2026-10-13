@echo off
title BikeSeeker - Telepito
echo ===================================================
echo   [BikeSeeker] Automata kornyezet felepitese...
echo ===================================================
echo.

:: 1. Python ellenorzese
echo [1/4] Python ellenorzese...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [HIBA] A Python nincs telepitve vagy nincs hozzaadva a PATH-hoz!
    echo Toltsd le innen: https://www.python.org/
    pause
    exit /b
)

:: 2. Node.js ellenorzese
echo [2/4] Node.js ellenorzese...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [HIBA] A Node.js nincs telepitve!
    echo Toltsd le innen: https://nodejs.org/
    pause
    exit /b
)

:: 3. Python virtualis kornyezet es csomagok
echo [3/4] Python virtualis kornyezet letrehozasa es csomagok telepitese...
if not exist "venv" (
    python -m venv venv
)
call .\venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt

:: 4. Frontend fuggosegek telepitese
echo [4/4] Frontend (React + Tailwind) csomagok telepitese...
cd frontend
call npm install
cd ..

echo.
echo ===================================================
echo   SIKER! A kornyezet keszen all a futtatasra!
echo   Inditashoz kattints duplan a 'start.bat' fajlra.
echo ===================================================
echo.
pause