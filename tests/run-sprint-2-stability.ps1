param(
    [int]$Runs = 20
)

$ErrorActionPreference = "Stop"
$runner = Join-Path $PSScriptRoot "run-sprint-2.ps1"

if (-not (Test-Path $runner)) {
    throw "No se encuentra tests/run-sprint-2.ps1"
}

$passed = 0
$failed = 0
$failures = @()

for ($i = 1; $i -le $Runs; $i++) {
    Write-Host ""
    Write-Host "========== SPRINT 2 STABILITY $i/$Runs ==========" -ForegroundColor Cyan

    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $runner
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        $passed += 1
        Write-Host "RUN $i PASS" -ForegroundColor Green
    }
    else {
        $failed += 1
        $failures += $i
        Write-Host "RUN $i FAIL (ExitCode=$exitCode)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "SPRINT_2_STABILITY_SUMMARY=$passed/$Runs" -ForegroundColor Cyan

if ($failed -gt 0) {
    Write-Host "FAILED_RUNS=$($failures -join ',')" -ForegroundColor Red
    throw "SPRINT_2_STABILITY_BLOCKED ($passed/$Runs PASS)"
}

Write-Host "SPRINT_2_STABILITY_READY ($Runs/$Runs PASS)" -ForegroundColor Green
