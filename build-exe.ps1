[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
$configPath = Join-Path $projectRoot 'wails.json'
$config = Get-Content -Raw -LiteralPath $configPath | ConvertFrom-Json
$version = $config.info.productVersion

if ($version -notmatch '^\d+\.\d+\.\d+$') {
    throw "Wersja w wails.json musi mieć format X.Y.Z (aktualnie: '$version')."
}

if (-not (Get-Command wails -ErrorAction SilentlyContinue)) {
    throw 'Polecenie wails nie jest dostępne w PATH.'
}

$outputName = "jetstream-workbench-v$version.exe"

Push-Location $projectRoot
try {
    & wails build `
        -clean `
        -o $outputName `
        -ldflags "-X main.appVersion=$version"

    if ($LASTEXITCODE -ne 0) {
        throw "Build nie powiódł się (kod wyjścia: $LASTEXITCODE)."
    }
}
finally {
    Pop-Location
}

$outputPath = Join-Path $projectRoot "build\bin\$outputName"
if (-not (Test-Path -LiteralPath $outputPath)) {
    throw "Nie znaleziono zbudowanego pliku: $outputPath"
}

Write-Host "Gotowy plik: $outputPath"
