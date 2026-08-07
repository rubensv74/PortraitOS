param(
    [int]$Port = 8768,
    [int]$TimeoutSeconds = 90
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$resultsFile = Join-Path $env:TEMP "portraitos-rc1-runtime-results.json"
$serverLog = Join-Path $env:TEMP "portraitos-rc1-runtime-server.log"
$serverError = Join-Path $env:TEMP "portraitos-rc1-runtime-server-error.log"

Remove-Item $resultsFile, $serverLog, $serverError -Force -ErrorAction SilentlyContinue

$chromeCandidates = @(
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe"
)

$browser = $chromeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) {
    throw "No se encontró Chrome o Edge para ejecutar el runtime gate."
}

$serverScript = @'
param(
    [string]$Root,
    [int]$Port,
    [string]$ResultsFile
)

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        if ($request.HttpMethod -eq "POST" -and $request.Url.AbsolutePath -eq "/results") {
            $reader = [System.IO.StreamReader]::new($request.InputStream, $request.ContentEncoding)
            $body = $reader.ReadToEnd()
            $reader.Dispose()
            [System.IO.File]::WriteAllText($ResultsFile, $body)
            $response.StatusCode = 204
            $response.Close()
            continue
        }

        $relative = [Uri]::UnescapeDataString($request.Url.AbsolutePath.TrimStart('/'))
        if ([string]::IsNullOrWhiteSpace($relative)) {
            $relative = "tests/rc1-runtime-runner.html"
        }

        $candidate = [System.IO.Path]::GetFullPath((Join-Path $Root $relative))
        $rootFull = [System.IO.Path]::GetFullPath($Root)
        if (-not $candidate.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $candidate -PathType Leaf)) {
            $response.StatusCode = 404
            $response.Close()
            continue
        }

        $extension = [System.IO.Path]::GetExtension($candidate).ToLowerInvariant()
        $contentTypes = @{
            ".html" = "text/html; charset=utf-8"
            ".js" = "application/javascript; charset=utf-8"
            ".css" = "text/css; charset=utf-8"
            ".json" = "application/json; charset=utf-8"
            ".png" = "image/png"
            ".jpg" = "image/jpeg"
            ".jpeg" = "image/jpeg"
            ".webp" = "image/webp"
        }

        $response.ContentType = $contentTypes[$extension]
        if (-not $response.ContentType) {
            $response.ContentType = "application/octet-stream"
        }

        $bytes = [System.IO.File]::ReadAllBytes($candidate)
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
        $response.Close()
    }
}
finally {
    $listener.Stop()
    $listener.Close()
}
'@

$tempServer = Join-Path $env:TEMP "portraitos-rc1-runtime-server.ps1"
[System.IO.File]::WriteAllText($tempServer, $serverScript)

$server = Start-Process powershell.exe -PassThru -WindowStyle Hidden `
    -ArgumentList @(
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", $tempServer,
        "-Root", $repoRoot,
        "-Port", $Port,
        "-ResultsFile", $resultsFile
    ) `
    -RedirectStandardOutput $serverLog `
    -RedirectStandardError $serverError

$browserProcess = $null
try {
    Start-Sleep -Milliseconds 800

    if ($server.HasExited) {
        $details = if (Test-Path $serverError) { Get-Content $serverError -Raw } else { "" }
        throw "El servidor RC1 no pudo iniciarse. $details"
    }

    $url = "http://127.0.0.1:$Port/tests/rc1-runtime-runner.html"
    $profilePath = Join-Path $env:TEMP ("portraitos-rc1-runtime-profile-" + [guid]::NewGuid().ToString("N"))
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
    while ((Get-Date) -lt $deadline -and -not (Test-Path $resultsFile)) {
        Start-Sleep -Milliseconds 250
    }

    if (-not (Test-Path $resultsFile)) {
        throw "El runtime gate no devolvió resultados antes del timeout."
    }

    $result = Get-Content $resultsFile -Raw | ConvertFrom-Json
    Write-Host $result.text

    $reportedStage = $result.step
    if (-not $reportedStage) { $reportedStage = $result.stage }
    if (-not $reportedStage) { $reportedStage = "unknown" }
    Write-Host "STEP=$reportedStage"
    Write-Host "TEST_STATUS=$($result.status)"

    if ($result.status -ne "passed") {
        throw "RC1_RUNTIME_BLOCKED (stage=$reportedStage)"
    }

    Write-Host "RC1_RUNTIME_READY"
}
finally {
    if ($browserProcess -and -not $browserProcess.HasExited) {
        Stop-Process -Id $browserProcess.Id -Force -ErrorAction SilentlyContinue
    }

    if ($server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
    }

    if ($profilePath -and (Test-Path $profilePath)) {
        Remove-Item $profilePath -Recurse -Force -ErrorAction SilentlyContinue
    }

    Remove-Item $tempServer -Force -ErrorAction SilentlyContinue
}
