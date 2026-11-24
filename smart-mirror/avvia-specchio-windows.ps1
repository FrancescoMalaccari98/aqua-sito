# Aqua — smart mirror launcher for Windows (started by avvia-specchio-windows.bat).
# Serves the site folder on http://localhost:8080 with a small web server built into this script
# (no Python needed), opens Chrome (or Edge) full screen on the mirror, keeps the PC awake,
# and stops the server when the mirror window is closed (Alt+F4).
# Everything printed here is also written to %LOCALAPPDATA%\Aqua Specchio.log, to diagnose problems.
# Works with Windows PowerShell 5.1 (built into Windows 10/11) and PowerShell 7.

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'   # no progress bar for the local server checks
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
function Test-MirrorOpen {
  [bool](Get-CimInstance Win32_Process -Filter "Name='$exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($BrowserProfile) })
}
# mirror window already open: keep its server alive instead of opening a new window
$Attach = Test-MirrorOpen
if ($Attach) { Say 'Lo specchio è già aperto: controllo che il server sia attivo.' }

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

$script:Listener = $null
$script:ServerPs = $null
function Start-MirrorServer {
  try {
    # "localhost" prefixes do not need administrator rights
    $l = New-Object System.Net.HttpListener
    $l.Prefixes.Add("http://localhost:$Port/")
    $l.Start()
  } catch {
    Say "Il server non parte sulla porta $Port ($($_.Exception.Message))."
    return $false
  }
  $ps = [PowerShell]::Create()
  [void]$ps.AddScript($ServerScript).AddArgument($l).AddArgument($Root)
  [void]$ps.BeginInvoke()
  $script:Listener = $l
  $script:ServerPs = $ps
  foreach ($i in 1..25) { if (Test-Mirror $Port) { return $true }; Start-Sleep -Milliseconds 200 }
  Stop-MirrorServer
  return $false
}
function Stop-MirrorServer {
  if ($script:Listener) { try { $script:Listener.Stop(); $script:Listener.Close() } catch { } }
  if ($script:ServerPs) { try { $script:ServerPs.Dispose() } catch { } }
  $script:Listener = $null
  $script:ServerPs = $null
}

if (Test-Mirror $Port) {
  # a server for the mirror is already running (for example started by hand): reuse it;
  # if it stops later, the watch below starts our own on the same port
  Say "Server già attivo sulla porta ${Port}: lo riuso."
} else {
  if ((Test-PortBusy $Port) -and -not $Attach) {
    # another program holds the port: use the next free one (mirror settings are saved per port)
    foreach ($p in 8081..8085) { if (-not (Test-PortBusy $p)) { $Port = $p; break } }
    Say "La porta 8080 è occupata da un altro programma: uso la $Port (le impostazioni salvate dello specchio ripartono da zero)."
  }
  if (-not (Start-MirrorServer)) { Fail "Il server non è partito sulla porta $Port." }
  Say ("Server avviato in {0:N1} s: http://localhost:{1}/{2}" -f ((Get-Date) - $Start).TotalSeconds, $Port, $Page)
}

# ---------- Keep the PC and the screen awake while the mirror is open ----------
try {
  Add-Type -Namespace Aqua -Name Power -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'
  [void][Aqua.Power]::SetThreadExecutionState([uint32]2147483651)   # 0x80000003: continuous + system + display
} catch { Say 'Impossibile impedire lo standby: controlla le opzioni risparmio energia.' }

# ---------- Browser, full screen ----------
$proc = $null
if ($Attach) {
  Say 'Se lo specchio mostra "Impossibile raggiungere il sito", clicca sulla sua finestra e premi F5.'
} else {
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
  $proc = Start-Process -FilePath $Browser -ArgumentList $browserArgs -PassThru
}

try {
  # watch: while the mirror is open, the server must keep answering (restart it if it stops).
  # The browser may hand its window to another process of the same profile, so every one is checked.
  while (($proc -and -not $proc.HasExited) -or (Test-MirrorOpen)) {
    Start-Sleep -Seconds 2
    if (-not (Test-Mirror $Port)) {
      $mine = [bool]$script:Listener
      Stop-MirrorServer
      if (Test-PortBusy $Port) {
        Say "Il server non risponde e la porta $Port è occupata da un altro programma."
      } elseif (Start-MirrorServer) {
        Say "Il server si era fermato: riavviato sulla porta $Port."
      } elseif ($mine) {
        Say 'Il server si era fermato e non riparte: riprovo tra poco.'
      }
    }
  }
} finally {
  try { [void][Aqua.Power]::SetThreadExecutionState([uint32]2147483648) } catch { }   # 0x80000000: back to normal
  if ($script:Listener) {
    Stop-MirrorServer
    Say 'Specchio chiuso. Server fermato.'
  } else {
    Say 'Specchio chiuso (il server avviato a mano resta attivo).'
  }
}
Say 'Puoi chiudere questa finestra.'
Start-Sleep -Seconds 3
