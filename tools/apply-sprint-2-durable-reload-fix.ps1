param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"

$path = Join-Path $RepoRoot "tests\sprint-2-runner.html"
if (-not (Test-Path $path)) {
    throw "No se encuentra tests/sprint-2-runner.html"
}

$content = Get-Content -Path $path -Raw -Encoding UTF8

$firstAnchor = @'
        expected = { profileAId: w.ProfileService.getActive().id, linkedPhotoId: primary.id };
        stage = "reload-a"; w.location.reload();
'@

$firstReplacement = @'
        expected = { profileAId: w.ProfileService.getActive().id, linkedPhotoId: primary.id };

        /* Barrera durable del escenario A antes de destruir el runtime. */
        w.ProfileManager.saveActive();
        await w.ProfileStorage.flush();
        const durableA = w.ProfileStorage.loadLibrary();
        if (durableA?.activeProfileId !== expected.profileAId) {
            throw new Error(
                `persistencia A no confirmada antes de reload: active=${durableA?.activeProfileId} expected=${expected.profileAId}`
            );
        }

        stage = "reload-a"; w.location.reload();
'@

$finalAnchor = @'
    record("adaptador sourcePhotoIds sincronizado", w.ProfileService.identity.getSection("face").sourcePhotoIds[0] === historicalPhotoId);
    expected.historicalId = historicalId; stage = "final-reload";
'@

$finalReplacement = @'
    record("adaptador sourcePhotoIds sincronizado", w.ProfileService.identity.getSection("face").sourcePhotoIds[0] === historicalPhotoId);

    /*
     * Barrera durable final.
     * ProfileStorage coalesce escrituras: el runner debe esperar a que la
     * biblioteca confirmada contenga el perfil histórico antes del reload.
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

$changed = $false

if (-not $content.Contains("persistencia A no confirmada antes de reload")) {
    if (-not $content.Contains($firstAnchor)) {
        throw "No se encontró el reload inicial esperado de Sprint 2."
    }
    $content = $content.Replace($firstAnchor, $firstReplacement)
    $changed = $true
}

if (-not $content.Contains("persistencia histórica no confirmada antes de reload")) {
    if (-not $content.Contains($finalAnchor)) {
        throw "No se encontró el reload final esperado de Sprint 2."
    }
    $content = $content.Replace($finalAnchor, $finalReplacement)
    $changed = $true
}

if (-not $changed) {
    Write-Host "Las dos barreras durables de Sprint 2 ya estaban aplicadas." -ForegroundColor Yellow
    exit 0
}

Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline

Write-Host "Sprint 2 actualizado: ambos reloads esperan ProfileStorage.flush()." -ForegroundColor Green
Write-Host "No se ha modificado código de producción." -ForegroundColor Cyan
