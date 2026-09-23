@echo off
chcp 65001 >nul
title Tienda Aguara + Vulka
cd /d "%~dp0"

echo.
echo   Iniciando la Tienda Aguara + Vulka...
echo   (No cierres esta ventana mientras uses la tienda)
echo.

rem Levanta un servidor local en el puerto 8777 (Python)
where py >nul 2>nul
if %errorlevel%==0 (
  start "Servidor Tienda Aguara" /min py -X utf8 -m http.server 8777
) else (
  start "Servidor Tienda Aguara" /min python -m http.server 8777
)

rem Espera a que el servidor arranque y abre el navegador
timeout /t 2 >nul
start "" "http://localhost:8777/"

echo   Tienda abierta en el navegador.
echo   Para cerrarla, cerra esta ventana y la del servidor.
echo.
pause >nul
