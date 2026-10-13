@echo off
title BikeSeeker - Indito
echo ===================================================
echo   [BikeSeeker] Rendszer inditasa tabos nezetben...
echo ===================================================
echo.

:: Ellenorzes, hogy lefutott-e mar a setup
if not exist "venv" (
    echo [FIGYELEM] A virtualis kornyezet meg nem letezik!
    echo Eloszor futtasd le a 'setup.bat' fajlt!
    pause
    exit /b
)

:: Windows Terminal (wt.exe) ellenorzese
where wt >nul 2>&1
if %errorlevel% neq 0 goto fallback

echo Windows Terminal megnyitasa fulekkel...
start "" wt --title "Backend" -d "%~dp0." cmd /k "call .\venv\Scripts\activate.bat && cd backend && uvicorn main:app --reload" ; new-tab --title "Frontend" -d "%~dp0frontend" cmd /k "npm run dev"
goto open_browser

:fallback
echo [INFO] Windows Terminal nem talalhato, hagyomanyos ablakok inditasa...
start "BikeSeeker Backend" cmd /k "title BikeSeeker Backend && call .\venv\Scripts\activate.bat && cd backend && uvicorn main:app --reload"
start "BikeSeeker Frontend" cmd /k "title BikeSeeker Frontend && cd frontend && npm run dev"

:open_browser
echo.
echo Varakozas a szerverekre - 3 mp...
timeout /t 3 /nobreak >nul

echo Bongeszo megnyitasa: http://localhost:5173
start http://localhost:5173

exit /b