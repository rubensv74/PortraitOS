param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"

$path = Join-Path $RepoRoot "app\js\services\profile.direction.js"
if (-not (Test-Path $path)) {
    throw "No se encuentra app/js/services/profile.direction.js"
}

$content = Get-Content -Path $path -Raw -Encoding UTF8
$original = $content

$old = @'
        direction.status =
            DIRECTION_STATUS.READY;

        markUpdated(profile);

        return clone(direction);
'@

$new = @'
        /*
         * markUpdated() invalida un estado READY porque cualquier cambio
         * posterior obliga a revisar de nuevo la dirección. Durante la
         * transición explícita a READY debemos actualizar timestamps antes
         * de establecer el estado final; de lo contrario markReady() se
         * autoinvalida y termina devolviendo DRAFT.
         */
        markUpdated(profile);

        direction.status =
            DIRECTION_STATUS.READY;

        return clone(direction);
'@

if ($content.Contains($old)) {
    $content = $content.Replace($old, $new)
} elseif ($content.Contains("Durante la transición explícita a READY")) {
    Write-Host "La corrección de transición READY ya estaba aplicada." -ForegroundColor Yellow
    exit 0
} else {
    throw "No se encontró el bloque esperado de ProfileDirection.markReady()."
}

Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline
Write-Host "ProfileDirection.markReady corregido: READY ya no se autoinvalida a DRAFT." -ForegroundColor Green
Write-Host "Causa raíz: markReady establecía READY y después markUpdated lo convertía inmediatamente en DRAFT." -ForegroundColor Cyan
