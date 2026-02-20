@echo off
REM TAV Egitim Sistemi - Basit Build Scripti
REM Bu script, Next standalone + electron-packager ile .exe olusturur

echo ========================================
echo TAV Egitim Sistemi - Basit Build
echo ========================================
echo.

REM Proje kokune git
cd ..

echo [1/5] Next.js build aliniyor...
call npm run build
if errorlevel 1 (
    echo.
    echo [HATA] Next.js build basarisiz!
    pause
    exit /b 1
)

REM Electron klasorune gec
cd electron-app

REM Node.js modullerini kontrol et
if not exist "node_modules\electron-packager" (
    echo [2/5] electron-packager yukleniyor...
    call npm install --save-dev electron-packager
)

echo [3/5] Next standalone dosyalari kopyalaniyor...
if exist ".next" rmdir /s /q ".next"
if exist "public" rmdir /s /q "public"
xcopy /e /i /q "..\.next\standalone\*" ".next\standalone\" >nul
xcopy /e /i /q "..\.next\static\*" ".next\static\" >nul
if exist "..\public" xcopy /e /i /q "..\public\*" "public\" >nul
REM Standalone server.js, static/public dosyalarini kendi kokunden arar
if not exist ".next\standalone\.next\static" mkdir ".next\standalone\.next\static"
xcopy /e /i /q "..\.next\static\*" ".next\standalone\.next\static\" >nul
if exist "..\public" xcopy /e /i /q "..\public\*" ".next\standalone\public\" >nul
if exist "..\.env" copy /y "..\.env" ".env" >nul
if exist "..\local.db" copy /y "..\local.db" "local.db" >nul

echo [4/5] Build baslatiliyor...
echo.

npx electron-packager . TAV-Egitim-Sistemi --platform=win32 --arch=x64 --out=../dist --overwrite

if errorlevel 1 (
    echo.
    echo [HATA] Build basarisiz!
    pause
    exit /b 1
)

echo [5/5] Gecici dosyalar temizleniyor...
if exist ".next" rmdir /s /q ".next"
if exist "public" rmdir /s /q "public"
if exist ".env" del /f /q ".env" >nul 2>&1
if exist "local.db" del /f /q "local.db" >nul 2>&1

echo.
echo ========================================
echo Build tamamlandi!
echo ========================================
echo.
echo Cikti: dist\TAV-Egitim-Sistemi-win32-x64\
pause
