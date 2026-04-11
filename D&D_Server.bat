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

:: Iniciar el servidor Node.js en segundo plano
start /B node server.js

:: Esperar unos segundos para que el servidor inicie correctamente
timeout /t 2 /nobreak >nul

:: Abrir el navegador predeterminado con la URL local
start http://localhost:3000

:: Mantener la ventana del servidor abierta
echo Servidor ejecutándose...
echo Presiona cualquier tecla para detener el servidor y cerrar...
pause >nul

:: Cerrar el servidor Node.js al finalizar
taskkill /F /IM node.exe >nul 2>&1
taskkill /F /IM msedge.exe >nul 2>&1

exit