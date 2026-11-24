#!/bin/bash
# Aqua — smart mirror launcher for macOS (double click in Finder).
# Starts a small local web server for the site folder, opens Chrome full screen on the mirror,
# keeps the Mac awake, and stops the server when the mirror window is closed (Cmd+Q).
#
# Chrome is opened through macOS ("open"), never as a child of this Terminal window:
#  - macOS would otherwise blame Terminal for Chrome's own self-updates ("App Management" warning);
#  - Terminal signals (Ctrl+Z, closing the window) could freeze or kill the browser.
# Everything printed here is also written to ~/Library/Logs/Aqua Specchio.log, to diagnose problems.

PORT="${SPECCHIO_PORT:-8080}"   # another port: SPECCHIO_PORT=8090 ./avvia-specchio-mac.command
PAGE="smart-mirror/"
# Separate browser profile: kiosk mode works even if Chrome is already open,
# and camera permission + mirror settings are remembered between launches.
PROFILE="${SPECCHIO_PROFILE:-$HOME/Library/Application Support/Aqua Specchio}"
LOG="$HOME/Library/Logs/Aqua Specchio.log"
PROFILE_MATCH="--user-data-dir=$PROFILE"

mkdir -p "$(dirname "$LOG")"
START=$(date +%s)
say() { local line; line="[$(date +%H:%M:%S)] $*"; printf '  %s\n' "$line"; printf '%s\n' "$line" >> "$LOG"; }
fail() { say "ERRORE: $*"; printf '\n  Premi Invio per chiudere.'; read -r _; exit 1; }

# The site root is the folder above this script
cd "$(dirname "$0")/.." || fail "cartella del sito non trovata."
ROOT="$(pwd)"
printf '\n' >> "$LOG"
say "Specchio Aqua: avvio (cartella $ROOT)"

# ---------- Browser: Chrome, or Edge as a fallback (SPECCHIO_APP can name another Chromium browser) ----------
APP="${SPECCHIO_APP:-}"
if [ -z "$APP" ]; then
  for candidate in "/Applications/Google Chrome.app" "$HOME/Applications/Google Chrome.app" \
                   "/Applications/Microsoft Edge.app" "$HOME/Applications/Microsoft Edge.app"; do
    [ -d "$candidate" ] && { APP="$candidate"; break; }
  done
fi
[ -n "$APP" ] && [ -d "$APP" ] || fail "Google Chrome non trovato. Installalo da https://www.google.com/chrome/ e riprova."
say "Browser: $APP"

# ---------- Mirror already open? ----------
OLD_PID="$(pgrep -o -f -- "$PROFILE_MATCH")"
ATTACH_PID=""   # mirror window already open: keep its server alive instead of opening a new one
if [ -n "$OLD_PID" ]; then
  if ps -o stat= -p "$OLD_PID" | grep -q T; then
    # a window left frozen by an older version of this script: close it and start again
    say "Trovato uno specchio bloccato (processo $OLD_PID): lo chiudo e riparto."
    pkill -CONT -f -- "$PROFILE_MATCH"
    pkill -TERM -f -- "$PROFILE_MATCH"
    for _ in $(seq 1 30); do pgrep -f -- "$PROFILE_MATCH" >/dev/null || break; sleep 0.2; done
    pkill -KILL -f -- "$PROFILE_MATCH" 2>/dev/null
  else
    ATTACH_PID="$OLD_PID"
    say "Lo specchio è già aperto (processo $OLD_PID): controllo che il server sia attivo."
  fi
fi

# ---------- Python for the web server ----------
PYTHON="$(command -v python3)"
if [ -z "$PYTHON" ] || { [ "$PYTHON" = "/usr/bin/python3" ] && ! xcode-select -p >/dev/null 2>&1; }; then
  # /usr/bin/python3 is only a stub until the Command Line Tools are installed
  fail "Python 3 non è installato. Installa gli strumenti con:  xcode-select --install   (oppure Python da https://www.python.org) e riprova."
fi

is_mirror() { curl -fsS -m 2 -o /dev/null "http://127.0.0.1:$1/smart-mirror/mirror.js" 2>/dev/null; }
port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# ---------- Web server ----------
SERVER_PID=""
start_server() {
  "$PYTHON" -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT" >/dev/null 2>&1 < /dev/null &
  SERVER_PID=$!
  for _ in $(seq 1 50); do is_mirror "$PORT" && return 0; sleep 0.2; done
  kill "$SERVER_PID" 2>/dev/null
  SERVER_PID=""
  return 1
}
if is_mirror "$PORT"; then
  # a server for the mirror is already running (for example started by hand): reuse it;
  # if it stops later, the watch below starts our own on the same port
  say "Server già attivo sulla porta $PORT: lo riuso."
else
  if port_busy "$PORT" && [ -z "$ATTACH_PID" ]; then
    # another program holds the port: use the next free one (mirror settings are saved per port)
    for p in 8081 8082 8083 8084 8085; do port_busy "$p" || { PORT=$p; break; }; done
    say "La porta 8080 è occupata da un altro programma: uso la $PORT (le impostazioni salvate dello specchio ripartono da zero)."
  fi
  start_server || fail "Il server non è partito sulla porta $PORT."
  say "Server avviato in $(( $(date +%s) - START )) s: http://localhost:$PORT/$PAGE"
fi

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null
  SERVER_PID=""
}
# closing this Terminal window (or Ctrl+C) also closes the mirror window and stops the server
trap 'say "Terminale chiuso: chiudo lo specchio."; pkill -TERM -o -f -- "$PROFILE_MATCH"; cleanup; exit 0' INT TERM HUP

# ---------- Browser, full screen ----------
if [ -n "$ATTACH_PID" ]; then
  WATCH_PID="$ATTACH_PID"
  say "Se lo specchio mostra «Impossibile raggiungere il sito», clicca sulla sua finestra e premi Cmd+R."
else
  say "Apro il browser a schermo intero (la prima volta può volerci qualche secondo). Per uscire: Cmd+Q."
  say "Lo schermo intero si apre sullo schermo principale: rendi principale la TV in Impostazioni di Sistema › Monitor, oppure usa il Mac chiuso."
  # -n: a separate instance (own profile), -W: "open" stays running until that instance is closed
  open -n -W -a "$APP" --args \
    "$PROFILE_MATCH" \
    --kiosk \
    --no-first-run \
    --no-default-browser-check \
    --disable-features=Translate \
    --autoplay-policy=no-user-gesture-required \
    "http://localhost:$PORT/$PAGE" < /dev/null &
  WATCH_PID=$!
fi

# keep the display and the Mac awake while the mirror is open
caffeinate -di -w "$WATCH_PID" < /dev/null &

# watch: while the mirror is open, the server must keep answering (restart it if it stops)
while kill -0 "$WATCH_PID" 2>/dev/null; do
  sleep 2
  kill -0 "$WATCH_PID" 2>/dev/null || break
  if ! is_mirror "$PORT"; then
    cleanup
    if port_busy "$PORT"; then
      say "Il server non risponde e la porta $PORT è occupata da un altro programma."
    elif start_server; then
      say "Il server si era fermato: riavviato sulla porta $PORT."
    else
      say "Il server si era fermato e non riparte: riprovo tra poco."
    fi
  fi
done

if [ -n "$SERVER_PID" ]; then say "Specchio chiuso. Server fermato."; else say "Specchio chiuso (il server avviato a mano resta attivo)."; fi
cleanup
say "Puoi chiudere questa finestra."
exit 0
