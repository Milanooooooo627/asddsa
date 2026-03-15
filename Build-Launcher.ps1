param(
    [string]$Name = 'launcher'
)

$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$CloudDir = Join-Path $Root 'Cloud'
$WebUiDir = Join-Path $Root 'WebUI'
$PythonExe = Join-Path $CloudDir '.venv\Scripts\python.exe'
$PyInstallerExe = Join-Path $CloudDir '.venv\Scripts\pyinstaller.exe'
$BuildRoot = Join-Path $Root 'LauncherBuild'
$DistPath = Join-Path $BuildRoot 'dist'
$WorkPath = Join-Path $BuildRoot 'build'
$SpecPath = Join-Path $BuildRoot 'spec'

if (-not (Test-Path $PythonExe)) {
    throw "Python environment not found at $PythonExe"
}

Push-Location $Root
try {
    $env:PATH = 'C:/Program Files/nodejs;' + $env:PATH
    npm.cmd --prefix $WebUiDir run build

    if (-not (Test-Path $PyInstallerExe)) {
        & $PythonExe -m pip install pyinstaller
    }

    if (Test-Path $BuildRoot) {
        Remove-Item $BuildRoot -Recurse -Force
    }

    $pyInstallerArgs = @(
        '--noconfirm'
        '--clean'
        '--windowed'
        '--onefile'
        '--name', $Name
        '--distpath', $DistPath
        '--workpath', $WorkPath
        '--specpath', $SpecPath
        '--add-data', "$Root\WebUI\dist;WebUI/dist"
        "$CloudDir\desktop_launcher.py"
    )

    & $PyInstallerExe @pyInstallerArgs

    Write-Host "Launcher built at: $(Join-Path $DistPath ($Name + '.exe'))"
}
finally {
    Pop-Location
}