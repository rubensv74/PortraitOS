param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"

$path = Join-Path $RepoRoot "app\js\services\profile.validation.js"
if (-not (Test-Path $path)) {
    throw "No se encuentra app/js/services/profile.validation.js"
}

$content = Get-Content -Path $path -Raw -Encoding UTF8
$original = $content

$sourceOld = @'
                if (
                    !photo.source ||
                    !normalizeText(
                        photo.source.dataUrl
                    )
                ) {
'@
$sourceNew = @'
                if (
                    !photo.source ||
                    (
                        !normalizeText(photo.source.dataUrl) &&
                        !normalizeText(photo.source.binaryId)
                    )
                ) {
'@

$thumbOld = @'
                if (
                    !photo.thumbnail ||
                    !normalizeText(
                        photo.thumbnail.dataUrl
                    )
                ) {
'@
$thumbNew = @'
                if (
                    !photo.thumbnail ||
                    (
                        !normalizeText(photo.thumbnail.dataUrl) &&
                        !normalizeText(photo.thumbnail.binaryId)
                    )
                ) {
'@

if ($content.Contains($sourceOld)) {
    $content = $content.Replace($sourceOld, $sourceNew)
} elseif (-not $content.Contains("photo.source.binaryId")) {
    throw "No se encontró el bloque esperado de validación de source."
}

if ($content.Contains($thumbOld)) {
    $content = $content.Replace($thumbOld, $thumbNew)
} elseif (-not $content.Contains("photo.thumbnail.binaryId")) {
    throw "No se encontró el bloque esperado de validación de thumbnail."
}

$content = $content.Replace('`${path}.source.dataUrl`', '`${path}.source`')
$content = $content.Replace('`${path}.thumbnail.dataUrl`', '`${path}.thumbnail`')

if ($content -eq $original) {
    Write-Host "La compatibilidad binaryId ya estaba aplicada." -ForegroundColor Yellow
    exit 0
}

Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline
Write-Host "Validación actualizada: dataUrl o binaryId son fuentes válidas." -ForegroundColor Green
Write-Host "Motivo: Sprint 4 migra Data URLs a binary-assets; el validador seguía exigiendo el formato legacy." -ForegroundColor Cyan
