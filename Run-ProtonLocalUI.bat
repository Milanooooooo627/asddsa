@echo off
setlocal
cd /d "%~dp0"

start "Proton Cloud Auth" "%~dp0Run-ProtonCloudAuth.bat"
timeout /t 3 /nobreak >nul
start "Proton UI" "%~dp0Launch-ProtonUI.bat"

endlocal
