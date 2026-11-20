# Aqua — smart mirror launcher for Windows (started by avvia-specchio-windows.bat).
# Serves the site folder on http://localhost:8080 with a small web server built into this script
# (no Python needed), opens Chrome (or Edge) full screen on the mirror, keeps the PC awake,
# and stops the server when the mirror window is closed (Alt+F4).
# Everything printed here is also written to %LOCALAPPDATA%\Aqua Specchio.log, to diagnose problems.
# Works with Windows PowerShell 5.1 (built into Windows 10/11) and PowerShell 7.

$ErrorActionPreference = 'Stop'
$Port = 8080
if ($env:SPECCHIO_PORT) { $Port = [int]$env:SPECCHIO_PORT }
$Page = 'smart-mirror/'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
# Separate browser profile: kiosk mode works even if Chrome is already open,
# and camera permission + mirror settings are remembered between launches.
$BrowserProfile = Join-Path $env:LOCALAPPDATA 'Aqua Specchio'
if ($env:SPECCHIO_PROFILE) { $BrowserProfile = $env:SPECCHIO_PROFILE }
$LogFile = Join-Path $env:LOCALAPPDATA 'Aqua Specchio.log'
$Start = Get-Date

function Say([string]$Message) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $Message
  Write-Host "  $line"
  try { Add-Content -Path $LogFile -Value $line -Encoding UTF8 } catch { }
}
function Fail([string]$Message) {
  Say "ERRORE: $Message"
  Read-Host '  Premi Invio per chiudere' | Out-Null
  exit 1
}

try { Add-Content -Path $LogFile -Value '' -Encoding UTF8 } catch { }
Say "Specchio Aqua: avvio (cartella $Root)"

# ---------- Browser: Chrome, or Edge as a fallback (SPECCHIO_BROWSER can name another Chromium browser) ----------
# (plain strings, not Join-Path: on 32-bit Windows ProgramFiles(x86) does not exist)
$candidates = @(
  $env:SPECCHIO_BROWSER,
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe"
)
$Browser = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $Browser) { Fail 'Google Chrome non trovato. Installalo da https://www.google.com/chrome/ e riprova.' }
Say "Browser: $Browser"

# ---------- Mirror already open? ----------
$exe = [System.IO.Path]::GetFileName($Browser)
$open = Get-CimInstance Win32_Process -Filter "Name='$exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains($BrowserProfile) }
if ($open) {
  Say 'Lo specchio è già aperto. Per chiuderlo: Alt+F4 nella finestra dello specchio.'
  Start-Sleep -Seconds 4
  exit 0
}

function Test-Mirror([int]$P) {
  try {
    $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 -Uri "http://localhost:$P/smart-mirror/mirror.js"
    return ($r.StatusCode -eq 200)
  } catch { return $false }
}
function Test-PortBusy([int]$P) {
  try {
    $l = New-Object System.Net.Sockets.TcpListener ([System.Net.IPAddress]::Loopback), $P
    $l.Start(); $l.Stop(); return $false
  } catch { return $true }
}

# ---------- Web server (runs in a background runspace of this same window) ----------
$ServerScript = {
  param($Listener, $Root)
  $types = @{
    '.html' = 'text/html; charset=utf-8'; '.htm' = 'text/html; charset=utf-8'
    '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
    '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'
    '.webmanifest' = 'application/manifest+json'; '.txt' = 'text/plain; charset=utf-8'; '.md' = 'text/plain; charset=utf-8'
    '.xml' = 'application/xml'; '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'
    '.webp' = 'image/webp'; '.gif' = 'image/gif'; '.ico' = 'image/x-icon'
    '.woff' = 'font/woff'; '.woff2' = 'font/woff2'; '.ttf' = 'font/ttf'
    '.wasm' = 'application/wasm'; '.task' = 'application/octet-stream'; '.mp4' = 'video/mp4'; '.pdf' = 'application/pdf'
  }
  $rootBase = [System.IO.Path]::GetFullPath($Root).TrimEnd('\')
  $rootFull = $rootBase + '\'
  while ($Listener.IsListening) {
    try { $ctx = $Listener.GetContext() } catch { break }   # Stop() ends the loop
    $res = $ctx.Response
    try {
      $urlPath = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
      $file = [System.IO.Path]::GetFullPath((Join-Path $rootFull ($urlPath.TrimStart('/') -replace '/', '\')))
      # never serve anything outside the site folder
      if ($file -ne $rootBase -and -not $file.StartsWith($rootFull, [System.StringComparison]::OrdinalIgnoreCase)) {
        $res.StatusCode = 403
      } elseif (Test-Path -LiteralPath $file -PathType Container) {
        if (-not $urlPath.EndsWith('/')) {
          # folders need a final slash, so relative links in the page work
          $res.StatusCode = 301
          $res.RedirectLocation = $urlPath + '/' + $ctx.Request.Url.Query
        } else {
          $file = Join-Path $file 'index.html'
        }
      }
      if ($res.StatusCode -eq 200) {
        if (Test-Path -LiteralPath $file -PathType Leaf) {
          $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
          $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
          $res.AddHeader('Cache-Control', 'no-cache')
          $stream = [System.IO.File]::OpenRead($file)
          try {
            $res.ContentLength64 = $stream.Length
            if ($ctx.Request.HttpMethod -ne 'HEAD') { $stream.CopyTo($res.OutputStream) }
          } finally { $stream.Dispose() }
        } else {
          $res.StatusCode = 404
        }
      }
    } catch {
      try { $res.StatusCode = 500 } catch { }
    } finally {
      try { $res.OutputStream.Close() } catch { }
    }
  }
}

$Listener = $null
$ServerPs = $null
if (Test-Mirror $Port) {
  # a server for the mirror is already running (for example started by hand): reuse it, never stop it
  Say "Server già attivo sulla porta ${Port}: lo riuso."
} else {
  if (Test-PortBusy $Port) {
    # another program holds the port: use the next free one (mirror settings are saved per port)
    foreach ($p in 8081..8085) { if (-not (Test-PortBusy $p)) { $Port = $p; break } }
    Say "La porta 8080 è occupata da un altro programma: uso la $Port (le impostazioni salvate dello specchio ripartono da zero)."
  }
  try {
    # "localhost" prefixes do not need administrator rights
    $Listener = New-Object System.Net.HttpListener
    $Listener.Prefixes.Add("http://localhost:$Port/")
    $Listener.Start()
  } catch {
    Fail "Il server non è partito sulla porta $Port ($($_.Exception.Message))."
  }
  $ServerPs = [PowerShell]::Create()
  [void]$ServerPs.AddScript($ServerScript).AddArgument($Listener).AddArgument($Root)
  [void]$ServerPs.BeginInvoke()
  $ok = $false
  foreach ($i in 1..25) { if (Test-Mirror $Port) { $ok = $true; break }; Start-Sleep -Milliseconds 200 }
  if (-not $ok) { Fail "Il server non risponde sulla porta $Port." }
  Say ("Server avviato in {0:N1} s: http://localhost:{1}/{2}" -f ((Get-Date) - $Start).TotalSeconds, $Port, $Page)
}

# ---------- Keep the PC and the screen awake while the mirror is open ----------
try {
  Add-Type -Namespace Aqua -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
  [void][Aqua.Power]::SetThreadExecutionState([uint32]2147483651)   # 0x80000003: continuous + system + display
} catch { Say 'Impossibile impedire lo standby: controlla le opzioni risparmio energia.' }

# ---------- Browser, full screen ----------
Say 'Apro il browser a schermo intero (la prima volta può volerci qualche secondo). Per uscire: Alt+F4.'
Say "Lo schermo intero si apre sullo schermo principale: imposta la TV come schermo principale (Impostazioni › Sistema › Schermo)."
$browserArgs = @(
  "--user-data-dir=`"$BrowserProfile`"",
  '--kiosk',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-features=Translate',
  '--autoplay-policy=no-user-gesture-required',
  "http://localhost:$Port/$Page"
)
try {
  $proc = Start-Process -FilePath $Browser -ArgumentList $browserArgs -PassThru
  $proc.WaitForExit()
  # Chrome sometimes hands the window to a second process: wait for every process of this profile
  while (Get-CimInstance Win32_Process -Filter "Name='$exe'" -ErrorAction SilentlyContinue |
         Where-Object { $_.CommandLine -and $_.CommandLine.Contains($BrowserProfile) }) {
    Start-Sleep -Seconds 1
  }
} finally {
  try { [void][Aqua.Power]::SetThreadExecutionState([uint32]2147483648) } catch { }   # 0x80000000: back to normal
  if ($Listener) {
    try { $Listener.Stop(); $Listener.Close() } catch { }
    Say 'Specchio chiuso. Server fermato.'
  } else {
    Say 'Specchio chiuso (il server avviato a mano resta attivo).'
  }
  if ($ServerPs) { try { $ServerPs.Dispose() } catch { } }
}
Say 'Puoi chiudere questa finestra.'
Start-Sleep -Seconds 3
