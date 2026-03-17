@echo off
chcp 65001 >nul
title D&D Server
cls

:: Obtener IP local
for /f "tokens=2 delims=:" %%i in ('ipconfig ^| findstr "IPv4"') do set "ip=%%i"
set "ip=%ip: =%"

echo.
echo  Servidor disponible en:
echo    - http://localhost:3000
echo    - http://%ip%:3000
echo.
echo.
echo ====================================
echo.

start microsoft-edge:http://localhost:3000

node server.js

taskkill /F /IM msedge.exe >nul 2>&1

exit