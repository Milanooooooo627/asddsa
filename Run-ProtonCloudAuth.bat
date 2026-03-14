@echo off
cd /d "%~dp0"
set "ps1=%~dp0cloud_auth_server.ps1"
echo Starting Proton cloud auth server...
start "Proton Cloud Auth" powershell -NoProfile -ExecutionPolicy Bypass -File "%ps1%"
echo Started.
pause
