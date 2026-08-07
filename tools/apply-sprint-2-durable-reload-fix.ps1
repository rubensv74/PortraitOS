param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"

$path = Join-Path $RepoRoot "tests\sprint-2-runner.html"
if (-not (Test-Path $path)) {
    throw "No se encuentra tests/sprint-2-runner.html"
}

$content = Get-Content -Path $path -Raw -Encoding UTF8

$anchor = @'
    record("adaptador sourcePhotoIds sincronizado", w.ProfileService.identity.getSection("face").sourcePhotoIds[0] === historicalPhotoId);
    expected.historicalId = historicalId; stage = "final-reload";
'@

$replacement = @'
    record("adaptador sourcePhotoIds sincronizado", w.ProfileService.identity.getSection("face").sourcePhotoIds[0] === historicalPhotoId);

    /*
     * Barrera durable antes de recargar.
     *
     * ProfileStorage coalesce escrituras y puede tener un commit anterior
     * todavía en curso. Recargar inmediatamente después de saveActive() hace
     * que IndexedDB/fallback compitan con el estado más reciente en memoria.
     * El runner debe validar el contrato durable real: guardar el perfil
     * activo y esperar explícitamente a flush() antes de destruir el runtime.
     */
    w.ProfileManager.saveActive();
    await w.ProfileStorage.flush();

    const durableLibrary = w.ProfileStorage.loadLibrary();
    if (durableLibrary?.activeProfileId !== historicalId) {
        throw new Error(
            `persistencia histórica no confirmada antes de reload: active=${durableLibrary?.activeProfileId} expected=${historicalId}`
        );
    }

    expected.historicalId = historicalId; stage = "final-reload";
'@

if ($content.Contains($replacement)) {
    Write-Host "La barrera durable de Sprint 2 ya estaba aplicada." -ForegroundColor Yellow
    exit 0
}

if (-not $content.Contains($anchor)) {
    throw "No se encontró el bloque esperado del escenario histórico Sprint 2."
}

$content = $content.Replace($anchor, $replacement)
Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline

Write-Host "Sprint 2 actualizado: el reload final espera ProfileStorage.flush()." -ForegroundColor Green
Write-Host "No se ha modificado código de producción." -ForegroundColor Cyan
