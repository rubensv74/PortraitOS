param(
    [int]$Port = 8769,
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$resultsFile = Join-Path $env:TEMP "portraitos-sprint-7-results.json"
$serverError = Join-Path $env:TEMP "portraitos-sprint-7-server-error.log"
$tempServer = Join-Path $env:TEMP "portraitos-sprint-7-server.ps1"
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
        if ([string]::IsNullOrWhiteSpace($relative)) { $relative = "tests/sprint-7-runner.html" }
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
$browserProcess = $null; $profilePath = $null
try {
    Start-Sleep -Milliseconds 800
    if ($server.HasExited) { throw "El servidor Sprint 7 no pudo iniciarse. $(Get-Content $serverError -Raw -ErrorAction SilentlyContinue)" }
    $profilePath = Join-Path $env:TEMP ("portraitos-sprint-7-profile-" + [guid]::NewGuid().ToString("N"))
    $browserProcess = Start-Process $browser -PassThru -WindowStyle Hidden -ArgumentList @("--headless=new","--disable-gpu","--no-first-run","--no-default-browser-check","--disable-background-networking","--user-data-dir=$profilePath","http://127.0.0.1:$Port/tests/sprint-7-runner.html")
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline -and -not (Test-Path $resultsFile)) { Start-Sleep -Milliseconds 250 }
    if (-not (Test-Path $resultsFile)) { throw "Sprint 7 no devolvió resultados antes del timeout." }
    $result = Get-Content $resultsFile -Raw | ConvertFrom-Json
    Write-Host $result.text
    Write-Host "STEP=$($result.step)"
    Write-Host "TEST_STATUS=$($result.status)"
    if ($result.status -ne "passed") {
        Write-Host "RESULT_JSON=$($result | ConvertTo-Json -Depth 8 -Compress)" -ForegroundColor DarkYellow
        $failureLines = @($result.text -split "`n" | Where-Object { $_ -like "FAIL*" })
        foreach ($failureLine in $failureLines) {
            Write-Host "FAILURE_DETAIL=$failureLine" -ForegroundColor Red
        }
        throw "SPRINT_7_BLOCKED (stage=$($result.step))"
    }
    Write-Host "SPRINT_7_READY"
} finally {
    if ($browserProcess -and -not $browserProcess.HasExited) { Stop-Process -Id $browserProcess.Id -Force -ErrorAction SilentlyContinue }
    if ($server -and -not $server.HasExited) { Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue }
    if ($profilePath -and (Test-Path $profilePath)) { Remove-Item $profilePath -Recurse -Force -ErrorAction SilentlyContinue }
    Remove-Item $tempServer -Force -ErrorAction SilentlyContinue
}
