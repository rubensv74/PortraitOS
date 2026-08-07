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

$modalOld = @'
.modal-backdrop {

    position: fixed;

    inset: 0;

    z-index: 900;

    display: flex;

    align-items: center;

    justify-content: center;

    padding: var(--space-6);

    background: rgba(15, 23, 42, .58);

    backdrop-filter: blur(5px);

}

.modal {

    width: min(620px, 100%);
'@

$modalNew = @'
.modal-root {

    position: fixed;

    inset: 0;

    z-index: 900;

    display: grid;

    place-items: center;

    padding: var(--space-6);

}

.modal-root[hidden] {

    display: none !important;

}

.modal-backdrop {

    position: absolute;

    inset: 0;

    z-index: 0;

    background: rgba(15, 23, 42, .58);

    backdrop-filter: blur(5px);

}

.modal {

    position: relative;

    z-index: 1;

    width: min(620px, 100%);
'@

if ($css.Contains($modalNew)) {
    Write-Host "Modal layer AC-01 ya corregida." -ForegroundColor Yellow
}
elseif ($css.Contains($modalOld)) {
    $css = $css.Replace($modalOld, $modalNew)
    [System.IO.File]::WriteAllText($cssPath, $css, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Modal layer corregida: el diálogo queda por encima del backdrop." -ForegroundColor Green
}
else {
    throw "No se encontró el bloque modal esperado en app/css/app.css"
}

$wizardOld = @'
    function validatePhotosStep() {
        const summary =
            ProfileService.photos
                .summary();

        const errors = [];

        if (
            Number(summary.count || 0) < 1
        ) {
            errors.push(
                createFinding(
                    "PHOTO_REQUIRED",
                    "Debe añadir al menos una fotografía."
                )
            );
        }

        if (
            !summary.primaryPhotoId
        ) {
            errors.push(
                createFinding(
                    "PRIMARY_PHOTO_REQUIRED",
                    "Debe seleccionar una fotografía principal."
                )
            );
        }

        return createValidationResult(
            errors.length === 0,
            errors
        );
    }
'@

$wizardNew = @'
    function validatePhotosStep() {
        const summary =
            ProfileService.photos
                .summary();

        const errors = [];

        const photoCount =
            Number(
                summary?.total ??
                summary?.count ??
                0
            );

        const primaryPhotoId =
            summary?.primaryId ||
            summary?.primaryPhotoId ||
            null;

        if (photoCount < 1) {
            errors.push(
                createFinding(
                    "PHOTO_REQUIRED",
                    "Debe añadir al menos una fotografía."
                )
            );
        }

        if (!primaryPhotoId) {
            errors.push(
                createFinding(
                    "PRIMARY_PHOTO_REQUIRED",
                    "Debe seleccionar una fotografía principal."
                )
            );
        }

        return createValidationResult(
            errors.length === 0,
            errors
        );
    }
'@

if ($wizard.Contains($wizardNew)) {
    Write-Host "Wizard photos contract AC-01 ya corregido." -ForegroundColor Yellow
}
elseif ($wizard.Contains($wizardOld)) {
    $wizard = $wizard.Replace($wizardOld, $wizardNew)
    [System.IO.File]::WriteAllText($wizardPath, $wizard, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Wizard corregido: usa total/primaryId del contrato real de fotografías." -ForegroundColor Green
}
else {
    throw "No se encontró validatePhotosStep() con el contrato esperado en app/js/wizard.js"
}

Write-Host "AC-01 patch aplicado. No se ha modificado storage ni el modelo de fotografías." -ForegroundColor Cyan
