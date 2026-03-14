@echo off
title Proton HWID Spoofer
echo ===============================================
echo           Proton HWID Spoofer Launcher
echo ===============================================
echo.

:: Check for elevated privileges
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"

if '%errorlevel%' NEQ '0' (
    echo Administrator privileges required!
    echo Requesting administrative privileges...
    echo.
    goto UACPrompt
) else (
    goto GotAdmin
)

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:GotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

echo Running with Administrator privileges...
echo.

:: Check if PowerShell setup is needed
echo [System Check] Verifying PowerShell configuration...
call :CheckPowerShellSetup

if "%setupNeeded%"=="true" (
    echo.
    echo ===============================================
    echo          PowerShell Setup Required
    echo ===============================================
    echo.
    echo Proton requires PowerShell scripts to be enabled
    echo for proper functionality. This is a one-time setup.
    echo.
    echo The following will be configured:
    echo   - PowerShell execution policy
    echo   - File unblocking
    echo   - Script associations
    echo.
    choice /C YN /M "Would you like to configure PowerShell now"
    
    if errorlevel 2 (
        echo.
        echo Setup declined. Proton may not work properly.
        echo You can run 'Setup-Proton.bat' manually later.
        echo.
        pause
        goto LaunchProton
    )
    
    echo.
    echo ===============================================
    echo          Configuring PowerShell...
    echo ===============================================
    call :SetupPowerShell
    
    if "%setupSuccess%"=="true" (
        echo.
        echo ===============================================
        echo            Setup Complete!
        echo ===============================================
        echo.
        echo PowerShell has been configured successfully.
        echo Proton should now run without issues.
        echo.
        pause
    ) else (
        echo.
        echo ===============================================
        echo             Setup Warning
        echo ===============================================
        echo.
        echo Some setup steps may have failed, but Proton
        echo will attempt to run anyway.
        echo.
        pause
    )
) else (
    echo [System Check] PowerShell configuration: OK
)

:LaunchProton
echo.
echo ===============================================
echo        Starting local cloud auth server...
echo ===============================================
echo.
start "" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cloud_auth_server.ps1"
timeout /t 2 /nobreak >nul

echo.
echo ===============================================
echo            Starting Proton UI...
echo ===============================================
echo.
start "" "%~dp0ProtonUI.html"

echo.
echo ===============================================
echo             UI Launched
echo ===============================================
echo.
echo Press any key to exit...
pause > nul
exit /b 0

:: Function to check if PowerShell setup is needed
:CheckPowerShellSetup
set "setupNeeded=false"

:: Check execution policy for current user
for /f "tokens=*" %%i in ('powershell -Command "Get-ExecutionPolicy -Scope CurrentUser" 2^>nul') do (
    if /i not "%%i"=="Unrestricted" if /i not "%%i"=="RemoteSigned" if /i not "%%i"=="Bypass" (
        set "setupNeeded=true"
    )
)

:: Check for blocked files
powershell -Command "$blocked = Get-ChildItem -Path '%~dp0' -Recurse | Where-Object { $_.IsBlocked }; if ($blocked) { exit 1 } else { exit 0 }" >nul 2>&1
if %errorlevel% neq 0 (
    set "setupNeeded=true"
)

:: Test if we can actually run a simple PowerShell script
powershell -Command "Write-Host 'Test' | Out-Null" >nul 2>&1
if %errorlevel% neq 0 (
    set "setupNeeded=true"
)

goto :eof

:: Function to setup PowerShell
:SetupPowerShell
set "setupSuccess=true"

echo [1/4] Configuring PowerShell file associations...
reg add "HKCR\Applications\powershell.exe\shell\open\command" /ve /t REG_SZ /d "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe -NoLogo -ExecutionPolicy unrestricted -File \"%%1\"" /f >nul 2>&1
if %errorlevel% neq 0 set "setupSuccess=false"

echo [2/4] Setting PowerShell execution policy (Current User)...
reg add "HKCU\SOFTWARE\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell" /v "ExecutionPolicy" /t REG_SZ /d "Unrestricted" /f >nul 2>&1
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope CurrentUser -Force" >nul 2>&1
if %errorlevel% neq 0 set "setupSuccess=false"

echo [3/4] Setting PowerShell execution policy (System-wide)...
reg add "HKLM\SOFTWARE\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell" /v "ExecutionPolicy" /t REG_SZ /d "Unrestricted" /f >nul 2>&1
powershell -Command "Set-ExecutionPolicy -ExecutionPolicy Unrestricted -Scope LocalMachine -Force" >nul 2>&1
:: Don't fail setup if system-wide policy fails (might not have permissions)

echo [4/4] Unblocking all files in Proton directory...
powershell -Command "Get-ChildItem -Path '%~dp0' -Recurse | Unblock-File" >nul 2>&1
if %errorlevel% neq 0 set "setupSuccess=false"

goto :eof 
