@echo off
chcp 65001 >nul
title Atlas - gerar instalador
cd /d "%~dp0"

echo [1/3] Instalando dependencias (pode demorar alguns minutos)...
call npm install
if errorlevel 1 goto erro

echo.
echo [2/3] Gerando o aplicativo...
call npm run build
if errorlevel 1 goto erro

echo.
echo [3/3] Concluido.
echo O instalador esta em: %cd%\dist
echo Procure o arquivo Atlas-Setup-0.1.0.exe
start "" "%cd%\dist"
pause
exit /b 0

:erro
echo.
echo Algo deu errado. Copie a mensagem acima e envie para ajuda.
pause
exit /b 1
