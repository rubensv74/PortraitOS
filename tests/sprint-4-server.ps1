param(
    [int]$Port,
    [string]$RepoRoot,
    [string]$ResultsPath
)

# ============================================================
# Servidor HTTP de PortraitOS Sprint 4 (proceso separado).
# GetContext bloqueante (fiable); el lanzador lo termina con
# taskkill /T /F, evitando el deadlock de Stop-Job.
# ============================================================

$ErrorActionPreference = "Stop"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
try {
    while ($true) {
        $ctx = $listener.GetContext()
        $res = $ctx.Response
        try {
            $req = $ctx.Request
            $path = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
            if ($req.HttpMethod -eq "POST" -and $path -eq "results") {
                $reader = New-Object System.IO.StreamReader($req.InputStream)
                [System.IO.File]::WriteAllText($ResultsPath, $reader.ReadToEnd())
                $res.StatusCode = 200
                $bytes = [System.Text.Encoding]::UTF8.GetBytes("ok")
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                $res.Close()
                continue
            }
            if ($path -eq "") { $path = "app/index.html" }
            $rootFull = [System.IO.Path]::GetFullPath($RepoRoot).TrimEnd('\')
            $full = [System.IO.Path]::GetFullPath((Join-Path $rootFull ($path -replace '/', '\')))
            if (($full -ne $rootFull) -and (-not $full.StartsWith($rootFull + '\'))) { $res.StatusCode = 403; $res.Close(); continue }
            if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { $res.StatusCode = 404; $res.Close(); continue }
            $bytes = [System.IO.File]::ReadAllBytes($full)
            $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
            $mime = switch ($ext) {
                ".html" { "text/html; charset=utf-8" }
                ".js"   { "application/javascript; charset=utf-8" }
                ".mjs"  { "application/javascript; charset=utf-8" }
                ".css"  { "text/css; charset=utf-8" }
                ".json" { "application/json; charset=utf-8" }
                ".map"  { "application/json; charset=utf-8" }
                ".png"  { "image/png" }
                ".jpg"  { "image/jpeg" }
                ".jpeg" { "image/jpeg" }
                ".gif"  { "image/gif" }
                ".webp" { "image/webp" }
                ".svg"  { "image/svg+xml" }
                ".ico"  { "image/x-icon" }
                ".woff2"{ "font/woff2" }
                ".woff" { "font/woff" }
                ".ttf"  { "font/ttf" }
                default { "application/octet-stream" }
            }
            $res.ContentType = $mime
            $res.ContentLength64 = $bytes.Length
            $res.Headers["Cache-Control"] = "no-store"
            $res.Headers["Access-Control-Allow-Origin"] = "*"
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } catch {
            $res.StatusCode = 500
        } finally {
            try { $res.OutputStream.Close() } catch { }
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
