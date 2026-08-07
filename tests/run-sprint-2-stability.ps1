param(
    [int]$Runs = 20,
    [int]$Port = 8772,
    [int]$TimeoutSeconds = 100
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$resultsFile = Join-Path $env:TEMP "portraitos-sprint-2-stability-results.json"
$serverError = Join-Path $env:TEMP "portraitos-sprint-2-stability-server-error.log"
$tempServer = Join-Path $env:TEMP "portraitos-sprint-2-stability-server.ps1"
Remove-Item $resultsFile, $serverError, $tempServer -Force -ErrorAction SilentlyContinue

$browser = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw "No se encontró Chrome o Edge." }

$serverScript = @'
param([string]$Root,[int]$Port,[string]$ResultsFile)
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
try {
    while ($listener.IsListening) {
        $context = $listener.GetContext(); $request = $context.Request; $response = $context.Response
        if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/results") {
            $reader = [System.IO.StreamReader]::new($request.InputStream, $request.ContentEncoding)
            [System.IO.File]::WriteAllText($ResultsFile, $reader.ReadToEnd()); $reader.Dispose()
            $response.StatusCode = 204; $response.Close(); continue
        }
        $relative = [Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart('/'))
        if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "tests/sprint-2-stability-runner.html" }
        $candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $relative)); $rootFull = [System.IO.Path]::GetFullPath($Root)
        if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $candidate -PathType Leaf)) { $response.StatusCode = 404; $response.Close(); continue }
        $ext = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
        $types = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".json"="application/json; charset=utf-8" }
        $response.ContentType = $types[$ext]; if (-not $response.ContentType) { $response.ContentType = "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($candidate); $response.ContentLength64 = $bytes.Length; $response.OutputStream.Write($bytes,0,$bytes.Length); $response.Close()
    }
} finally { $listener.Stop(); $listener.Close() }
'@

[System.IO.File]::WriteAllText($tempServer, $serverScript)
$server = Start-Process powershell.exe -PassThru -WindowStyle Hidden -ArgumentList @("-NoProfile","-ExecutionPolicy","Bypass","-File",$tempServer,"-Root",$repoRoot,"-Port",$Port,"-ResultsFile",$resultsFile) -RedirectStandardError $serverError

$passed = 0
$failed = 0
$failures = @()

try {
    Start-Sleep -Milliseconds 800
    if ($server.HasExited) { throw "El servidor de estabilidad Sprint 2 no pudo iniciarse. $(Get-Content $serverError -Raw -ErrorAction SilentlyContinue)" }

    for ($i = 1; $i -le $Runs; $i++) {
        Write-Host ""
        Write-Host "========== SPRINT 2 STABILITY $i/$Runs ==========" -ForegroundColor Cyan
        Remove-Item $resultsFile -Force -ErrorAction SilentlyContinue

        $profilePath = Join-Path $env:TEMP ("portraitos-sprint-2-stability-profile-" + [guid]::NewGuid().ToString("N"))
        $browserProcess = $null
        try {
            $url = "http://127.0.0.1:$Port/tests/sprint-2-stability-runner.html?run=$i&nonce=$([guid]::NewGuid().ToString('N'))"
            $browserProcess = Start-Process $browser -PassThru -WindowStyle Hidden -ArgumentList @(
                "--headless=new",
                "--disable-gpu",
                "--no-first-run",
                "--no-default-browser-check",
                "--disable-background-networking",
                "--user-data-dir=$profilePath",
                $url
            )

            $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
            while ((Get-Date) -lt $deadline -and -not (Test-Path $resultsFile)) { Start-Sleep -Milliseconds 200 }

            if (-not (Test-Path $resultsFile)) {
                $failed += 1; $failures += $i
                Write-Host "RUN $i FAIL (sin resultado antes del timeout externo)" -ForegroundColor Red
                continue
            }

            $result = Get-Content $resultsFile -Raw | ConvertFrom-Json
            Write-Host $result.text
            Write-Host "TEST_STATUS=$($result.status)"
            Write-Host "ELAPSED_MS=$($result.elapsedMs)"

            if ($result.status -eq "passed") {
                $passed += 1
                Write-Host "RUN $i PASS" -ForegroundColor Green
            } else {
                $failed += 1; $failures += $i
                Write-Host "RUN $i FAIL (status=$($result.status))" -ForegroundColor Red
            }
        }
        finally {
            if ($browserProcess -and -not $browserProcess.HasExited) { Stop-Process -Id $browserProcess.Id -Force -ErrorAction SilentlyContinue }
            if (Test-Path $profilePath) { Remove-Item $profilePath -Recurse -Force -ErrorAction SilentlyContinue }
        }
    }

    Write-Host ""
    Write-Host "SPRINT_2_STABILITY_SUMMARY=$passed/$Runs" -ForegroundColor Cyan
    if ($failed -gt 0) {
        Write-Host "FAILED_RUNS=$($failures -join ',')" -ForegroundColor Red
        throw "SPRINT_2_STABILITY_BLOCKED ($passed/$Runs PASS)"
    }
    Write-Host "SPRINT_2_STABILITY_READY ($Runs/$Runs PASS)" -ForegroundColor Green
}
finally {
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
    Remove-Item $resultsFile, $tempServer -Force -ErrorAction SilentlyContinue
}
