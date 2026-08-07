param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"

$cssPath = Join-Path $RepoRoot "app\css\app.css"
$wizardPath = Join-Path $RepoRoot "app\js\wizard.js"

if (-not (Test-Path $cssPath)) { throw "No se encuentra app/css/app.css" }
if (-not (Test-Path $wizardPath)) { throw "No se encuentra app/js/wizard.js" }

$css = Get-Content -Path $cssPath -Raw -Encoding UTF8
$wizard = Get-Content -Path $wizardPath -Raw -Encoding UTF8

# ------------------------------------------------------------
# 1) Modal layer: aplicar una sobreescritura CSS mínima y estable.
#    Evitamos depender del formato/espaciado del bloque existente.
# ------------------------------------------------------------
$modalPatchMarker = "/* RC1 AC-01 modal stacking fix */"
$modalPatch = @'

/* RC1 AC-01 modal stacking fix */
.modal-root {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: var(--space-6);
}

.modal-root[hidden] {
    display: none !important;
}

.modal-root .modal-backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
}

.modal-root .modal {
    position: relative;
    z-index: 1;
}
'@

if ($css.Contains($modalPatchMarker)) {
    Write-Host "Modal layer AC-01 ya corregida." -ForegroundColor Yellow
}
else {
    $css = $css.TrimEnd() + "`r`n" + $modalPatch + "`r`n"
    [System.IO.File]::WriteAllText($cssPath, $css, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Modal layer corregida: el diálogo queda por encima del backdrop." -ForegroundColor Green
}

# ------------------------------------------------------------
# 2) Wizard photos contract: parchear solo los dos accesos obsoletos.
#    Contrato real del servicio: total / primaryId.
# ------------------------------------------------------------
$oldCount = "Number(summary.count || 0) < 1"
$newCount = "Number(summary?.total ?? summary?.count ?? 0) < 1"
$oldPrimary = "!summary.primaryPhotoId"
$newPrimary = "!(summary?.primaryId || summary?.primaryPhotoId)"

if ($wizard.Contains($newCount) -and $wizard.Contains($newPrimary)) {
    Write-Host "Wizard photos contract AC-01 ya corregido." -ForegroundColor Yellow
}
else {
    if (-not $wizard.Contains($oldCount)) {
        throw "No se encontró el acceso summary.count esperado en validatePhotosStep()."
    }
    if (-not $wizard.Contains($oldPrimary)) {
        throw "No se encontró el acceso summary.primaryPhotoId esperado en validatePhotosStep()."
    }

    $wizard = $wizard.Replace($oldCount, $newCount)
    $wizard = $wizard.Replace($oldPrimary, $newPrimary)

    [System.IO.File]::WriteAllText($wizardPath, $wizard, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Wizard corregido: usa total/primaryId del contrato real de fotografías." -ForegroundColor Green
}

Write-Host "AC-01 patch aplicado. No se ha modificado storage ni el modelo de fotografías." -ForegroundColor Cyan
