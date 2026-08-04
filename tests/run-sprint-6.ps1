param([string]$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe")

# ============================================================
# PortraitOS Sprint 6 — Portrait Review Completion (HTTP)
# ------------------------------------------------------------
# Sirve el repositorio en un puerto libre con HttpListener y
# ejecuta tests/sprint-6-runner.html en Chrome headless.
# ============================================================

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ChromePath)) { throw "Chrome no está disponible en $ChromePath" }

$testRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $testRoot
$runnerName = "sprint-6-runner.html"
$temporaryRoot = Join-Path $env:TEMP ("portraitos-sprint-6-" + [guid]::NewGuid().ToString("N"))
$profilePath = Join-Path $temporaryRoot "profile"
$stdoutPath = Join-Path $temporaryRoot "chrome-stdout.txt"
$stderrPath = Join-Path $temporaryRoot "chrome-stderr.txt"
$resultsPath = Join-Path $temporaryRoot "results.json"
$stopPath = Join-Path $temporaryRoot "stop.txt"
New-Item -ItemType Directory -Path $profilePath -Force | Out-Null

# Puerto libre (TCPListener efímero y liberado de inmediato)
$probe = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, 0)
$probe.Start()
$port = ([System.Net.IPEndPoint]$probe.LocalEndpoint).Port
$probe.Stop()

# Servidor HTTP en un proceso PowerShell separado
$serverScript = Join-Path $testRoot "sprint-4-server.ps1"
$serverProcess = Start-Process -FilePath "powershell.exe" -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $serverScript, $port, $repoRoot, $resultsPath) -WindowStyle Hidden -PassThru

$chromeProcess = $null
try {
    # Esperar a que el servidor acepte conexiones antes de lanzar Chrome.
    $ready = $false
    for ($i = 0; $i -lt 50 -and -not $ready; $i += 1) {
        Start-Sleep -Milliseconds 100
        try {
            $client = New-Object System.Net.Sockets.TcpClient
            $client.Connect("127.0.0.1", $port)
            $client.Close()
            $ready = $true
        } catch { }
    }
    if (-not $ready) { throw "El servidor HTTP no aceptó conexiones en el puerto $port." }

    $runnerUrl = "http://localhost:$port/tests/$runnerName"
    $arguments = @("--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--user-data-dir=$profilePath", $runnerUrl)
    $chromeProcess = Start-Process -FilePath $ChromePath -ArgumentList $arguments -WorkingDirectory $temporaryRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath

    # Esperar el POST /results en tiempo real (hasta ~120s).
    $deadline = [DateTime]::UtcNow.AddSeconds(120)
    while (-not (Test-Path -LiteralPath $resultsPath) -and [DateTime]::UtcNow -lt $deadline) {
        Start-Sleep -Milliseconds 500
    }

    if (-not (Test-Path -LiteralPath $resultsPath)) {
        $stderr = Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue
        throw "El runner no publicó resultados. Stderr: $stderr"
    }

    $result = Get-Content -LiteralPath $resultsPath -Raw | ConvertFrom-Json
    Write-Output $result.text
    Write-Output "STEP=$($result.step)"
    Write-Output "TEST_STATUS=$($result.status)"

    if ($result.status -ne "passed") {
        $stderr = Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue
        if ($stderr) { Write-Output "CHROME_STDERR=$stderr" }
        exit 1
    }
} finally {
    if ($chromeProcess -and -not $chromeProcess.HasExited) {
        try { & taskkill /PID $chromeProcess.Id /T /F 2>$null | Out-Null } catch { }
        try { Stop-Process -Id $chromeProcess.Id -Force -ErrorAction SilentlyContinue } catch { }
    }
    if ($serverProcess -and -not $serverProcess.HasExited) {
        try { & taskkill /PID $serverProcess.Id /T /F 2>$null | Out-Null } catch { }
        try { Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue } catch { }
    }
    try { Set-Content -LiteralPath $stopPath -Value "stop" -ErrorAction SilentlyContinue } catch { }
    try { Remove-Item -LiteralPath $temporaryRoot -Recurse -Force -ErrorAction SilentlyContinue } catch { }
}
