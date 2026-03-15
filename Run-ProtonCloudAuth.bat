@echo off
setlocal
cd /d "%~dp0Cloud"

if not exist ".venv\Scripts\python.exe" (
	echo Cloud virtual environment was not found.
	echo Expected: %~dp0Cloud\.venv\Scripts\python.exe
	pause
	exit /b 1
)

for /f %%P in ('powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1; if ($conn) { $conn.OwningProcess }"') do set "EXISTING_PID=%%P"

if defined EXISTING_PID (
	echo Proton Cloud API is already running on port 5000. PID: %EXISTING_PID%
	exit /b 0
)

if not exist "instance\protoncloud.db" (
	echo Initializing local database...
	".venv\Scripts\python.exe" init_db.py
)

echo Starting Proton Cloud API on http://127.0.0.1:5000 ...
start "Proton Cloud API" cmd /k "cd /d ""%~dp0Cloud"" && "".venv\Scripts\python.exe"" app.py"
echo Started.
endlocal
