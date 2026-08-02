param([string]$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe")

$ErrorActionPreference = "Stop"
if (-not (Test-Path -LiteralPath $ChromePath)) { throw "Chrome no está disponible en $ChromePath" }
$testRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$runnerPath = Join-Path $testRoot "sprint-2-runner.html"
$temporaryRoot = Join-Path $env:TEMP ("portraitos-sprint-2-" + [guid]::NewGuid().ToString("N"))
$profilePath = Join-Path $temporaryRoot "profile"
$stdoutPath = Join-Path $temporaryRoot "stdout.html"
$stderrPath = Join-Path $temporaryRoot "stderr.txt"
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null
$runnerUrl = "file:///" + ($runnerPath -replace "\\", "/")
$arguments = @(
    "--headless=new", "--disable-gpu", "--no-first-run", "--allow-file-access-from-files",
    "--user-data-dir=$profilePath", "--virtual-time-budget=150000", "--dump-dom", $runnerUrl
)
$process = Start-Process -FilePath $ChromePath -ArgumentList $arguments -WorkingDirectory $temporaryRoot `
    -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath
$dom = Get-Content -LiteralPath $stdoutPath -Raw
$stderr = Get-Content -LiteralPath $stderrPath -Raw
$match = [regex]::Match($dom, '<pre id="results" data-test-status="([^"]+)">([\s\S]*?)</pre>')
if (-not $match.Success) { throw "El runner no produjo resultado. Chrome exit: $($process.ExitCode). Stderr: $stderr" }
$status = $match.Groups[1].Value
$text = [System.Net.WebUtility]::HtmlDecode($match.Groups[2].Value)
Write-Output $text
Write-Output "CHROME_EXIT=$($process.ExitCode)"
Write-Output "TEST_STATUS=$status"
if ($process.ExitCode -ne 0 -or $status -ne "passed") {
    if ($stderr) { Write-Output "CHROME_STDERR=$stderr" }
    exit 1
}
