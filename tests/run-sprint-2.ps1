param(
    [int]$Port = 8772,
    [int]$TimeoutSeconds = 100
)

$ErrorActionPreference = "Stop"

$stabilityRunner = Join-Path $PSScriptRoot "run-sprint-2-stability.ps1"
if (-not (Test-Path -LiteralPath $stabilityRunner)) {
    throw "No se encuentra tests/run-sprint-2-stability.ps1"
}

Write-Host "Sprint 2 canonical runner: deterministic HTTP harness" -ForegroundColor Cyan

& powershell.exe -NoProfile -ExecutionPolicy Bypass `
    -File $stabilityRunner `
    -Runs 1 `
    -Port $Port `
    -TimeoutSeconds $TimeoutSeconds

$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    exit $exitCode
}

Write-Host "SPRINT_2_READY" -ForegroundColor Green
exit 0
