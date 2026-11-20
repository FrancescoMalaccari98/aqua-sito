/* Aqua — smart mirror diagnostics (key D).
   Measures what the mirror really receives and does: camera frames, render frames, display refresh,
   face AI timings, lost frames, main-thread stalls, sizes, orientation and video delay.
   Collection is always on and cheap; the panel text is only rebuilt while the panel is visible.
   This module only observes: it never changes the camera, the tracking or the rendering. */

const WINDOW_MS = 5000;        // rates and "recent" counts use the last 5 seconds
const STALL_WINDOW_MS = 60000; // main-thread stalls are counted over the last minute
const PANEL_MS = 500;          // panel refresh period
const LOG_MS = 1000;           // one log sample per second while the panel is open
const LOG_MAX = 3 * 3600;      // at most three hours of samples

/* ---------- Small statistics helpers ---------- */
class Samples {
  constructor(size = 300) { this.size = size; this.data = []; }
  push(v) { this.data.push(v); if (this.data.length > this.size) this.data.shift(); }
  clear() { this.data.length = 0; }
  stats() {
    const n = this.data.length;
    if (!n) return null;
    const sorted = [...this.data].sort((a, b) => a - b);
    const mean = this.data.reduce((s, v) => s + v, 0) / n;
    return { n, mean, median: sorted[Math.floor(n / 2)], p95: sorted[Math.min(n - 1, Math.ceil(n * 0.95) - 1)], max: sorted[n - 1] };
  }
}

// Timestamped events (with an optional amount), kept for a limited time
class Events {
  constructor(keepMs = STALL_WINDOW_MS) { this.keepMs = keepMs; this.list = []; this.total = 0; }
  add(t, v = 1) {
    this.list.push([t, v]);
    this.total += v;
    while (this.list.length && this.list[0][0] < t - this.keepMs) this.list.shift();
  }
  clear() { this.list.length = 0; this.total = 0; }
  sum(now, ms) { let s = 0; for (const [t, v] of this.list) if (t >= now - ms) s += v; return s; }
  max(now, ms) { let m = 0; for (const [t, v] of this.list) if (t >= now - ms) m = Math.max(m, v); return m; }
}

/* ---------- Formatting (Italian) ---------- */
const nf0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (v, f = nf1) => (v == null || !Number.isFinite(v) ? '—' : f.format(v));
const msStats = (st) => (st ? `media ${num(st.mean)} · p95 ${num(st.p95)} · max ${num(st.max)} ms` : '—');
const round1 = (v) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10);

const RATIOS = [[16, 9], [9, 16], [16, 10], [10, 16], [4, 3], [3, 4], [1, 1]];
function ratioLabel(w, h) {
  if (!w || !h) return '—';
  const a = w / h;
  for (const [x, y] of RATIOS) if (Math.abs(a - x / y) / (x / y) < 0.015) return `${x}:${y}`;
  return `${nf2.format(a)}:1`;
}
const ROTATION_LABELS = ['0°', '90° orario', '180°', '270° (90° antiorario)'];

/* ---------- Orientation, aspect ratio and crop (same maths as the shader) ---------- */
export function orientationReport({ W, H, rot, fit, vw, vh, cw, ch, dpr }) {
  const odd = rot % 2 === 1;
  const UW = odd ? H : W;          // upright mirror image, CSS px
  const UH = odd ? W : H;
  const CW = odd ? ch : cw;        // upright mirror image, canvas px
  const CH = odd ? cw : ch;
  const ua = UW / UH;
  const out = { upright: `${nf0.format(UW)}×${nf0.format(UH)} (${ratioLabel(UW, UH)})`, uprightPortrait: UH > UW, warnings: [], notes: [] };

  // who turns the picture: macOS (the window is already portrait) or the app (shader rotation)
  const windowPortrait = H > W;
  if (windowPortrait && odd) {
    out.rotation = 'doppia: macOS e app';
    out.warnings.push('Doppia rotazione: lo schermo è già verticale (ruotato da macOS) e anche l\'app ruota di 90°/270°. Imposta Rotazione 0° nell\'app oppure riporta macOS in orizzontale.');
  } else if (windowPortrait) {
    out.rotation = rot === 2 ? 'macOS (verticale) + app 180°' : 'macOS (schermo già verticale), app 0°';
  } else if (odd) {
    out.rotation = `app ${ROTATION_LABELS[rot]} (macOS orizzontale)`;
  } else {
    out.rotation = rot === 2 ? 'app 180° (immagine orizzontale)' : 'nessuna (immagine orizzontale)';
    out.notes.push('L\'immagine è orizzontale: con la TV montata in verticale apparirà coricata. Ruota da macOS oppure dall\'app (90°/270°), non entrambi.');
  }
  if (out.uprightPortrait && ratioLabel(UW, UH) !== '9:16') out.notes.push(`L'immagine verticale non è 9:16 (${ratioLabel(UW, UH)}): controlla schermo intero e risoluzione di macOS.`);

  if (!vw || !vh) return out;
  const va = vw / vh;
  out.camera = `${vw}×${vh} (${ratioLabel(vw, vh)}${vh > vw ? ', verticale' : ''})`;
  if (fit === 'cover') {
    // Riempi: the shader keeps the full camera height (or width) and crops the other side
    const usedW = ua > va ? vw : vh * ua;
    const usedH = ua > va ? vw / ua : vh;
    out.fit = `Riempi: usa ${nf0.format(usedW)}×${nf0.format(usedH)} px della videocamera (${nf0.format(usedW / vw * 100)}% larghezza, ${nf0.format(usedH / vh * 100)}% altezza)`;
    out.magnifyCanvas = CH / usedH;
    out.magnifyScreen = (UH * dpr) / usedH;
    if (usedW / vw < 0.5) out.notes.push(`Riempi usa solo il ${nf0.format(usedW / vw * 100)}% della larghezza della videocamera: con lo schermo verticale l'immagine viene ingrandita molto.`);
  } else {
    // Contieni: the whole camera frame, with dark bands where it does not reach
    const shownW = ua > va ? UH * va : UW;
    const shownH = ua > va ? UH : UW / va;
    const bands = ua > va ? `bande laterali di ${nf0.format((UW - shownW) / 2)} px` : `bande sopra e sotto di ${nf0.format((UH - shownH) / 2)} px`;
    out.fit = `Contieni: videocamera intera, ${bands}`;
    out.magnifyCanvas = (ua > va ? CH : CW) / (ua > va ? vh : vw);
    out.magnifyScreen = ((ua > va ? UH : UW) * dpr) / (ua > va ? vh : vw);
  }
  return out;
}

/* ---------- Diagnostics ---------- */
export function createDiagnostics({ video, canvas, gl, state, onToggle }) {
  const panel = document.getElementById('diag');
  const body = document.getElementById('diagBody');

  let visible = false;
  let since = performance.now();
  let stream = null;
  let requested = null;
  let lastReset = 'avvio';

  // camera frames (requestVideoFrameCallback: called once per new frame given to the page)
  const vfcSupported = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  const camFrames = new Events(WINDOW_MS * 2);
  const camMissed = new Events();
  const camInterval = new Samples(150);
  let lastPresented = null;
  let lastFrameAt = 0;
  let latest = null;               // metadata of the newest camera frame
  let captureTimeSeen = false;
  let vfcHandle = 0;

  // track statistics (Chrome: MediaStreamTrack.stats), sampled at every panel tick
  const trackSamples = [];

  // render loop
  const rafInterval = new Samples(240);
  const renders = new Events(WINDOW_MS * 2);
  const renderCpu = new Samples(300);
  const missedVsync = new Events();
  let lastRaf = 0;
  let refreshMs = null;

  // texture uploads and face AI
  const uploads = new Events(WINDOW_MS * 2);
  const dupUploads = new Events();
  const age = new Samples(300);
  const lead = new Samples(300);   // how far the face points are predicted forward (worker mode)
  const infer = new Samples(300);
  const detectTotal = new Samples(300);
  const detects = new Events(WINDOW_MS * 2);
  const dupDetects = new Events();
  const skippedDetects = new Events();
  let lastUploadFrame = null;
  let lastDetectFrame = null;

  // main thread stalls
  const stalls = new Events();
  let stallApi = 'non disponibile';
  try {
    const types = PerformanceObserver.supportedEntryTypes || [];
    const type = types.includes('long-animation-frame') ? 'long-animation-frame' : types.includes('longtask') ? 'longtask' : '';
    if (type) {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) stalls.add(e.startTime + e.duration, e.duration);
      }).observe({ type, buffered: false });
      stallApi = type === 'long-animation-frame' ? 'Long Animation Frames' : 'Long Tasks';
    }
  } catch (e) { /* not supported */ }

  // CPU pressure (thermal throttling of a fanless Mac shows up here), Chrome only
  let pressure = null;
  try {
    if ('PressureObserver' in window) {
      const po = new PressureObserver((records) => { pressure = records[records.length - 1].state; });
      Promise.resolve(po.observe('cpu', { sampleInterval: 1000 })).catch(() => {});
    }
  } catch (e) { /* not supported */ }

  // WebGL renderer name (which GPU really draws the mirror)
  let renderer = '—';
  try {
    const info = gl && gl.getExtension('WEBGL_debug_renderer_info');
    renderer = gl ? String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : '—';
  } catch (e) { /* ignore */ }

  function onVideoFrame(now, md) {
    camFrames.add(now);
    if (lastPresented !== null && md.presentedFrames - lastPresented > 1) camMissed.add(now, md.presentedFrames - lastPresented - 1);
    if (lastFrameAt) camInterval.push(now - lastFrameAt);
    lastPresented = md.presentedFrames;
    lastFrameAt = now;
    latest = md;
    if (md.captureTime) captureTimeSeen = true;
    vfcHandle = video.requestVideoFrameCallback(onVideoFrame);
  }
  // (re)start watching the frames of the current source
  function watch() {
    if (!vfcSupported) return;
    if (vfcHandle) video.cancelVideoFrameCallback(vfcHandle);
    vfcHandle = video.requestVideoFrameCallback(onVideoFrame);
  }
  watch();

  function reset(reason = 'manuale') {
    since = performance.now();
    lastReset = reason;
    for (const s of [camInterval, rafInterval, renderCpu, age, lead, infer, detectTotal]) s.clear();
    for (const e of [camFrames, camMissed, renders, missedVsync, uploads, dupUploads, detects, dupDetects, skippedDetects, stalls]) e.clear();
    trackSamples.length = 0;
    lastRaf = 0;
    lastUploadFrame = null;
    lastDetectFrame = null;
  }

  /* ----- hooks called by mirror.js ----- */
  function frame(now) {
    if (lastRaf) {
      const dt = now - lastRaf;
      rafInterval.push(dt);
      if (refreshMs && dt > refreshMs * 1.5) missedVsync.add(now, Math.round(dt / refreshMs) - 1);
    }
    lastRaf = now;
  }
  // seq: number of the camera frame uploaded (counted by mirror.js); leadMs: prediction of the face points
  function upload(seq, leadMs = 0) {
    const now = performance.now();
    uploads.add(now);
    if (seq === lastUploadFrame) dupUploads.add(now);
    lastUploadFrame = seq;
    if (latest && latest.captureTime) age.push(now - latest.captureTime);
    if (leadMs > 0) lead.push(leadMs);
  }
  function drawn(cpuMs) {
    renders.add(performance.now());
    renderCpu.push(cpuMs);
  }
  // seq: number of the analysed camera frame (counted by mirror.js)
  function detection(inferMs, totalMs, seq) {
    const now = performance.now();
    detects.add(now);
    infer.push(inferMs);
    detectTotal.push(totalMs);
    const id = seq;
    if (id != null && lastDetectFrame !== null) {
      if (id === lastDetectFrame) dupDetects.add(now);
      else if (id - lastDetectFrame > 1) skippedDetects.add(now, id - lastDetectFrame - 1);
    }
    lastDetectFrame = id;
  }
  function setStream(s, constraints) {
    stream = s;
    requested = constraints || null;
    reset(s ? 'videocamera avviata' : 'videocamera ferma');
    if (s) watch();
  }

  // Display refresh period. The plain median would read 33 ms ("30 Hz") whenever the loop is overloaded
  // and skips every other refresh: take the short intervals only (within 1.5× the 10th percentile)
  // and use their median, which is also robust to timer jitter.
  function refreshPeriod() {
    const d = rafInterval.data;
    if (d.length < 30) return null;
    const sorted = [...d].sort((a, b) => a - b);
    const rough = sorted[Math.floor(sorted.length * 0.1)];
    const short = sorted.filter((x) => x <= rough * 1.5);
    return short[Math.floor(short.length / 2)];
  }

  /* ----- one complete reading of every value ----- */
  function snapshot() {
    const now = performance.now();
    const st = state();
    const span = Math.max(1, Math.min(WINDOW_MS, now - since));
    const perSecond = (events) => events.sum(now, span) / (span / 1000);
    const track = stream ? stream.getVideoTracks()[0] : null;
    const cs = (track && track.getSettings && track.getSettings()) || {};
    let caps = null;
    try { caps = track && track.getCapabilities ? track.getCapabilities() : null; } catch (e) { /* ignore */ }

    // camera fps: requestVideoFrameCallback first, then track stats, else unknown
    const vfcActive = vfcSupported && camFrames.sum(now, 2000) > 0;
    let camFps = vfcActive ? perSecond(camFrames) : null;
    let camSource = vfcActive ? 'requestVideoFrameCallback' : '';
    let trackStats = null;
    if (trackSamples.length > 1) {
      const a = trackSamples[0];
      const b = trackSamples[trackSamples.length - 1];
      const secs = (b.t - a.t) / 1000;
      if (secs > 0.5) {
        trackStats = { fps: (b.delivered - a.delivered) / secs, discarded: b.discarded - a.discarded, totalDiscarded: b.discarded };
        if (camFps === null) { camFps = trackStats.fps; camSource = 'MediaStreamTrack.stats'; }
      }
    }
    if (!camSource) camSource = vfcSupported ? 'nessun fotogramma ricevuto negli ultimi 2 s' : 'non misurabile in questo browser';

    const refreshMsNow = refreshPeriod();
    const refreshHz = refreshMsNow ? 1000 / refreshMsNow : null;
    const camInt = camInterval.stats();
    const ageSt = age.stats();
    const W = innerWidth;
    const H = innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const orient = orientationReport({ W, H, rot: st.settings.rotation, fit: st.settings.fit, vw: video.videoWidth, vh: video.videoHeight, cw: canvas.width, ch: canvas.height, dpr });
    const browserScale = canvas.width ? (W * dpr) / canvas.width : null;

    return {
      now, measuredFor: (now - since) / 1000, lastReset,
      mode: { processing: st.processing, processingLabel: st.processingLabel, filter: st.filterLabel, strength: st.settings.strength, faces: st.faces, test: st.testMode },
      camera: {
        label: st.testMode ? `griglia di test animata (${st.testMode})` : (track && track.label) || '—', deviceId: cs.deviceId || '',
        width: cs.width || video.videoWidth || null, height: cs.height || video.videoHeight || null,
        nominalFps: cs.frameRate || null, resizeMode: cs.resizeMode || '—',
        requested: requested ? `${requested.width?.ideal || '?'}×${requested.height?.ideal || '?'} @ ${requested.frameRate?.ideal || '?'} fps` : '—',
        maxWidth: caps?.width?.max || null, maxHeight: caps?.height?.max || null, maxFps: caps?.frameRate?.max || null,
        fps: camFps, fpsSource: camSource, interval: camInt, missed: camMissed.sum(now, WINDOW_MS), missedTotal: camMissed.total,
        trackStats, state: track ? track.readyState : 'nessuna',
      },
      render: {
        fps: perSecond(renders), refreshHz, refreshMs: refreshMsNow, cpu: renderCpu.stats(),
        missedVsync: missedVsync.sum(now, WINDOW_MS), missedVsyncTotal: missedVsync.total,
        uploadsPerSec: perSecond(uploads), dupUploadsPerSec: dupUploads.sum(now, span) / (span / 1000),
        renderer,
      },
      ai: {
        delegate: st.delegate || (st.simulatedFace ? 'non usato (volto simulato)' : st.aiReady ? '?' : 'non ancora avviato'), zoom: st.zoom, off: st.processing === 'solo-video',
        recognition: st.recognition, recognitionNote: st.recognitionNote, lead: lead.stats(),
        infer: infer.stats(), total: detectTotal.stats(), perSec: perSecond(detects),
        dupPerSec: dupDetects.sum(now, span) / (span / 1000), skippedPerSec: skippedDetects.sum(now, span) / (span / 1000),
      },
      thread: {
        api: stallApi, count60: stalls.list.filter(([t]) => t >= now - STALL_WINDOW_MS).length,
        max60: stalls.max(now, STALL_WINDOW_MS), pressure: pressure || 'non disponibile', visibility: document.visibilityState,
      },
      delay: {
        captureTime: captureTimeSeen, age: ageSt,
        note: captureTimeSeen
          ? 'acquisizione → disegno misurato; mancano composizione e uscita (≈ 1–2 vsync) e l\'elaborazione della TV'
          : 'non misurabile: il browser non fornisce captureTime per questa videocamera',
      },
      screen: {
        css: `${screen.width}×${screen.height}`, physical: `${Math.round(screen.width * dpr)}×${Math.round(screen.height * dpr)}`,
        window: `${W}×${H}`, dpr, canvas: `${canvas.width}×${canvas.height}`, browserScale,
        fullscreen: !!document.fullscreenElement, orientation: (screen.orientation && screen.orientation.type) || '—',
      },
      orient,
    };
  }

  function warnings(s) {
    const w = [...s.orient.warnings];
    if (s.camera.fps != null && s.camera.nominalFps && s.camera.fps < s.camera.nominalFps * 0.8 && s.measuredFor > 3) {
      w.push(`La videocamera consegna ${num(s.camera.fps)} fps invece di ${num(s.camera.nominalFps, nf0)}: di solito è poca luce (esposizione automatica più lunga).`);
    }
    if (s.render.refreshHz && s.render.refreshHz < 50 && s.thread.visibility === 'visible') {
      w.push(`Il disegno è limitato a circa ${num(s.render.refreshHz, nf0)} Hz: controlla Monitor a 60 Hz, adattatore HDMI 2.0, Energy Saver di Chrome e Basso consumo.`);
    }
    if (s.ai.delegate === 'CPU') w.push('Il riconoscimento del volto gira sulla CPU: più lento della GPU.');
    if (s.ai.recognitionNote) w.push(`Riconoscimento sul thread principale: ${s.ai.recognitionNote}.`);
    if (s.screen.browserScale && s.screen.browserScale > 1.02) w.push(`Il browser ingrandisce il canvas di ×${num(s.screen.browserScale, nf2)}: l'immagine perde un po' di nitidezza.`);
    if (!s.screen.fullscreen) w.push('Non a schermo intero (tasto F): misure di dimensioni e orientamento non definitive.');
    if (s.thread.pressure === 'serious' || s.thread.pressure === 'critical') w.push(`Il Mac è sotto sforzo (pressione CPU: ${s.thread.pressure}): possibile calo di prestazioni per il calore.`);
    if (s.mode.processing !== 'completa') w.push(`Modalità di test attiva: ${s.mode.processingLabel}. Ricordati di tornare a "Completa" (tasto E).`);
    return [...w, ...s.orient.notes];
  }

  /* ----- panel ----- */
  const row = (label, value) => `<div class="diag__row"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  const section = (title, rows) => `<section><h3>${esc(title)}</h3>${rows.join('')}</section>`;

  function sections(s) {
    const c = s.camera;
    const r = s.render;
    const a = s.ai;
    const out = [];
    out.push(section('Modalità', [
      row('Elaborazione', s.mode.processingLabel),
      row('Filtro', `${s.mode.filter} · intensità ${s.mode.strength}%`),
      row('Volti seguiti', String(s.mode.faces)),
      row('Misurato da', `${num(s.measuredFor, nf0)} s (azzerato: ${s.lastReset})`),
    ]));
    out.push(section('Videocamera', [
      row('Nome', c.label),
      row('Risoluzione effettiva', c.width ? `${c.width}×${c.height} (${ratioLabel(c.width, c.height)})` : '—'),
      row('FPS dichiarati', c.nominalFps ? `${num(c.nominalFps)} fps` : '—'),
      row('FPS reali', c.fps != null ? `${num(c.fps)} fps` : '—'),
      row('Fonte FPS reali', c.fpsSource),
      row('Intervallo tra fotogrammi', c.interval ? `media ${num(c.interval.mean)} · max ${num(c.interval.max)} ms` : '—'),
      row('Fotogrammi non ricevuti', `${c.missed} (5 s) · ${c.missedTotal} totali`),
      ...(c.trackStats ? [row('Scartati dal browser', `${c.trackStats.discarded} (5 s) ·${c.trackStats.totalDiscarded} totali`)] : []),
      row('Richiesta', c.requested),
      row('Massimo possibile', c.maxWidth ? `${c.maxWidth}×${c.maxHeight} @ ${num(c.maxFps, nf0)} fps` : 'non indicato'),
      row('Ridimensionamento', c.resizeMode),
    ]));
    out.push(section('Rendering e schermo', [
      row('FPS rendering', `${num(r.fps)} fps`),
      row('Frequenza schermo (stima)', r.refreshHz ? `${num(r.refreshHz)} Hz (${num(r.refreshMs)} ms)` : '—'),
      row('Vsync persi', `${r.missedVsync} (5 s) · ${r.missedVsyncTotal} totali`),
      row('Disegno (CPU)', msStats(r.cpu)),
      row('Caricamenti texture', `${num(r.uploadsPerSec)}/s · ripetuti ${num(r.dupUploadsPerSec)}/s`),
      row('Canvas interno', s.screen.canvas),
      row('Finestra', `${s.screen.window} CSS px · DPR ${num(s.screen.dpr, nf2)}`),
      row('Schermo', `${s.screen.css} CSS px · ${s.screen.physical} px fisici`),
      row('Schermo intero', s.screen.fullscreen ? 'sì' : 'no'),
      row('GPU', r.renderer),
    ]));
    const worker = a.recognition === 'worker';
    out.push(section('Riconoscimento del volto', a.off ? [row('Stato', 'spento (modalità Solo video)')] : [
      row('Esecuzione', worker ? 'worker (thread separato, non blocca il disegno)' : 'sincrona (thread principale, prima del disegno)'),
      row('Delegato', a.delegate),
      row('Inferenza MediaPipe', msStats(a.infer)),
      row(worker ? 'Andata e ritorno (ritaglio + worker)' : 'Analisi completa (con ritaglio)', msStats(a.total)),
      row('Analisi al secondo', `${num(a.perSec)} · stesso fotogramma ${num(a.dupPerSec)}/s · saltati ${num(a.skippedPerSec)}/s`),
      ...(worker ? [row('Previsione dei punti', a.lead ? `${msStats(a.lead)} in avanti` : 'nessuna (nessun volto o stesso fotogramma)')] : []),
      row('Zoom di analisi', `${num(a.zoom)}×`),
    ]));
    out.push(section('Thread principale', [
      row('Blocchi (ultimo minuto)', `${s.thread.count60}${s.thread.count60 ? ` · il più lungo ${num(s.thread.max60, nf0)} ms` : ''}`),
      row('Fonte', s.thread.api),
      row('Pressione CPU', s.thread.pressure),
    ]));
    out.push(section('Ritardo del video', [
      row('Acquisizione → disegno', s.delay.captureTime && s.delay.age ? msStats(s.delay.age) : 'non misurabile'),
      row('Nota', s.delay.note),
    ]));
    out.push(section('Orientamento e formato', [
      row('Immagine diritta', s.orient.upright),
      row('Chi ruota', s.orient.rotation),
      row('Videocamera', s.orient.camera || '—'),
      row('Adattamento', s.orient.fit || '—'),
      row('Ingrandimento', s.orient.magnifyScreen ? `×${num(s.orient.magnifyScreen, nf2)} sullo schermo · ×${num(s.orient.magnifyCanvas, nf2)} sul canvas` : '—'),
    ]));
    return out;
  }

  function render() {
    const s = snapshot();
    const w = warnings(s);
    body.innerHTML = (w.length ? `<ul class="diag__warn">${w.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="diag__ok">Nessun avviso.</p>')
      + sections(s).join('');
  }

  function reportText() {
    const s = snapshot();
    const lines = [`Specchio Aqua · dati tecnici · ${new Date().toLocaleString('it-IT')}`, `Browser: ${navigator.userAgent}`, ''];
    const w = warnings(s);
    if (w.length) { lines.push('AVVISI'); w.forEach((x) => lines.push(`- ${x}`)); lines.push(''); }
    // reuse the panel content as plain text
    const tmp = document.createElement('div');
    tmp.innerHTML = sections(s).join('');
    tmp.querySelectorAll('section').forEach((sec) => {
      lines.push(sec.querySelector('h3').textContent.toUpperCase());
      sec.querySelectorAll('.diag__row').forEach((r) => lines.push(`${r.children[0].textContent}: ${r.children[1].textContent}`));
      lines.push('');
    });
    return lines.join('\n');
  }

  /* ----- log: one sample per second while the panel is open ----- */
  const log = [];
  function logSample() {
    const s = snapshot();
    log.push({
      time: new Date().toISOString(), processing: s.mode.processing, filter: s.mode.filter, faces: s.mode.faces,
      camera: s.camera.label, camRes: `${s.camera.width}x${s.camera.height}`, camFps: round1(s.camera.fps), camNominalFps: s.camera.nominalFps,
      camMissed5s: s.camera.missed, renderFps: round1(s.render.fps), refreshHz: round1(s.render.refreshHz), missedVsync5s: s.render.missedVsync,
      inferMean: round1(s.ai.infer?.mean), inferP95: round1(s.ai.infer?.p95), inferMax: round1(s.ai.infer?.max), delegate: s.ai.delegate,
      recognition: s.ai.recognition, roundTripMean: round1(s.ai.total?.mean), detectPerSec: round1(s.ai.perSec),
      dupDetectPerSec: round1(s.ai.dupPerSec), leadMean: round1(s.ai.lead?.mean), uploadsPerSec: round1(s.render.uploadsPerSec),
      ageMean: round1(s.delay.age?.mean), ageP95: round1(s.delay.age?.p95), stalls60s: s.thread.count60, pressure: s.thread.pressure,
      rotation: state().settings.rotation, fit: state().settings.fit,
    });
    if (log.length > LOG_MAX) log.shift();
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

  document.getElementById('diagReset').addEventListener('click', () => reset('manuale'));
  document.getElementById('diagClose').addEventListener('click', () => toggle(false));
  document.getElementById('diagLog').addEventListener('click', () => {
    download(`specchio-log-${stamp()}.json`, JSON.stringify({ report: reportText(), samples: log }, null, 2), 'application/json');
  });
  const copyBtn = document.getElementById('diagCopy');
  copyBtn.addEventListener('click', async () => {
    const text = reportText();
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.textContent = 'Copiato ✓';
    } catch (e) {
      // clipboard refused: save the same text as a file instead
      download(`specchio-report-${stamp()}.txt`, text, 'text/plain');
      copyBtn.textContent = 'Salvato come file';
    }
    setTimeout(() => { copyBtn.textContent = 'Copia report'; }, 2000);
  });

  // periodic work: track stats sampling, display refresh estimate, panel and log
  let lastLog = 0;
  setInterval(() => {
    const now = performance.now();
    const period = refreshPeriod();
    if (period) refreshMs = period;
    const track = stream ? stream.getVideoTracks()[0] : null;
    try {
      const ts = track && track.stats;
      if (ts && typeof ts.deliveredFrames === 'number') {
        trackSamples.push({ t: now, delivered: ts.deliveredFrames, discarded: ts.discardedFrames, total: ts.totalFrames });
        while (trackSamples.length && trackSamples[0].t < now - WINDOW_MS) trackSamples.shift();
      }
    } catch (e) { /* not supported */ }
    if (!visible) return;
    render();
    if (now - lastLog >= LOG_MS - 50) { logSample(); lastLog = now; }
  }, PANEL_MS);

  function toggle(force) {
    visible = typeof force === 'boolean' ? force : !visible;
    panel.hidden = !visible;
    if (visible) render();
    if (onToggle) onToggle(visible);
  }

  return {
    get visible() { return visible; },
    toggle, reset, frame, upload, drawn, detection, setStream,
  };
}
