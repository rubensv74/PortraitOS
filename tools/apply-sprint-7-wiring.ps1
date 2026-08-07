param(
    [string]$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot ".."))
)

$ErrorActionPreference = "Stop"

$indexPath = Join-Path $RepoRoot "app\index.html"
if (-not (Test-Path $indexPath)) { throw "No se encuentra app/index.html" }

$content = Get-Content -Path $indexPath -Raw -Encoding UTF8
$original = $content

function Add-OnceBefore {
    param([string]$Needle,[string]$Insertion,[string]$Marker)
    if ($script:content.Contains($Marker)) { return }
    if (-not $script:content.Contains($Needle)) { throw "No se encontró anchor: $Needle" }
    $script:content = $script:content.Replace($Needle, "$Insertion`r`n$Needle")
}

# CSS RC1
Add-OnceBefore -Needle "</head>" -Marker 'href="css/rc1-polish.css"' -Insertion @'
    <link
        rel="stylesheet"
        href="css/rc1-polish.css"
    >
'@

# Footer release metadata
$legacyFooter = @'
                <span>
                    PortraitOS v1.0
                </span>

                <small>
                    Identity remains constant
                </small>
'@
$newFooter = @'
                <div class="release-meta" aria-label="Información de versión">
                    <span class="release-meta__version" data-release-version>PortraitOS RC1</span>
                    <small class="release-meta__details" data-release-details>Build local</small>
                </div>

                <small>
                    Identity remains constant
                </small>
'@
if (-not $content.Contains("data-release-version")) {
    if (-not $content.Contains($legacyFooter)) { throw "No se encontró el footer legacy." }
    $content = $content.Replace($legacyFooter, $newFooter)
}

# Scripts
Add-OnceBefore -Needle '    <script src="js/wizard.js"></script>' -Marker 'src="js/services/release.metadata.js"' -Insertion @'
    <script src="js/services/release.metadata.js"></script>
    <script src="js/bindings/release.metadata.binding.js"></script>
    <script src="js/bindings/prompt.orientation.binding.js"></script>
'@

# Bootstrap init
$bootstrapAnchor = "                    ReviewBinding.init();"
if (-not $content.Contains("PromptOrientationBinding.init();")) {
    if (-not $content.Contains($bootstrapAnchor)) { throw "No se encontró ReviewBinding.init()." }
    $replacement = @'
                    ReviewBinding.init();
                    PromptOrientationBinding.init();
                    ReleaseMetadataBinding.init().catch(error => console.warn("PortraitOS: metadata RC1 no disponible.", error));
'@
    $content = $content.Replace($bootstrapAnchor, $replacement)
}

if ($content -eq $original) {
    Write-Host "Sprint 7 wiring ya estaba aplicado." -ForegroundColor Yellow
    exit 0
}

Set-Content -Path $indexPath -Value $content -Encoding UTF8 -NoNewline
Write-Host "Sprint 7 wiring aplicado a app/index.html" -ForegroundColor Green
