/* Aqua — smart mirror
   The webcam image is drawn mirrored on a WebGL canvas; a fragment shader warps the face areas
   found by MediaPipe Face Landmarker (loaded from ./vendor, so it works offline).
   Only face-shaping filters: every filter is a combination of smooth, fold-free local warps. */

const $ = (id) => document.getElementById(id);
const video = $('source');
const canvas = $('view');
const debugCanvas = $('debug');
const statusEl = $('status');
const toastEl = $('toast');
const promptEl = $('prompt');

/* ---------- Filters (label shown in the panel and in the toast) ---------- */
const FILTERS = [
  { id: 0, label: 'Normale' },
  { id: 1, label: 'Occhioni' },
  { id: 2, label: 'Occhi piccoli' },
  { id: 3, label: 'Faccia gonfia' },
  { id: 4, label: 'Faccia secca' },
  { id: 5, label: 'Testone' },
  { id: 6, label: 'Testina' },
  { id: 7, label: 'Nasone' },
  { id: 8, label: 'Nasino' },
  { id: 9, label: 'Boccona' },
  { id: 10, label: 'Bocca piccola' },
  { id: 11, label: 'Guance da criceto' },
  { id: 12, label: 'Mento lungo' },
  { id: 13, label: 'Fronte alta' },
  { id: 14, label: 'Faccia lunga' },
  { id: 15, label: 'Faccia schiacciata' },
  { id: 16, label: 'Mascellone' },
  { id: 17, label: 'Sorrisone' },
  { id: 18, label: 'Alieno' },
  { id: 19, label: 'Bebè' },
];

/* ---------- Settings, remembered on this device ---------- */
const STORE_KEY = 'aqua-mirror';
const DEFAULT_ROTATION = 0;
const settings = {
  filter: 1, strength: 75, fit: 'cover', rotation: DEFAULT_ROTATION, captions: true,
  auto: false, seconds: 10, camera: '', uiHidden: false,
};
try { Object.assign(settings, JSON.parse(localStorage.getItem(STORE_KEY) || '{}')); } catch (e) { /* private mode: defaults */ }
settings.rotation = [0, 1, 2, 3].includes(+settings.rotation) ? +settings.rotation : DEFAULT_ROTATION;
const save = () => { try { localStorage.setItem(STORE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ } };

// Developer test mode (?prova): a generated grid replaces the webcam and a fake face sits in the middle.
// Useful to check every warp without a camera or a person in front of the screen.
const TEST_MODE = new URLSearchParams(location.search).has('prova');

/* ---------- Messages ---------- */
let quietTimer = 0;
function note(message, { sticky = false } = {}) {
  statusEl.textContent = message;
  statusEl.classList.remove('is-quiet');
  clearTimeout(quietTimer);
  // when everything works the message fades away, so the mirror stays clean
  if (!sticky) quietTimer = setTimeout(() => statusEl.classList.add('is-quiet'), 4500);
}
let toastTimer = 0;
function toast(label) {
  toastEl.innerHTML = '';
  const words = label.split(' ');
  // last word in brass italic, like the titles on the website
  toastEl.append(document.createTextNode(words.slice(0, -1).join(' ') + (words.length > 1 ? ' ' : '')));
  const em = document.createElement('em');
  em.textContent = words[words.length - 1];
  toastEl.append(em);
  toastEl.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-on'), 2200);
}

/* ---------- Panel ---------- */
const filtersEl = $('filters');
for (const f of FILTERS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.filter = f.id;
  b.textContent = f.label;
  b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => setFilter(f.id));
  filtersEl.append(b);
}

// Filter changes fade the old effect out and the new one in, so faces never jump.
let mode = 0;            // filter currently drawn
let pendingMode = null;  // filter waiting for the fade-out to finish
let fade = 0;            // 0..1 multiplier of the effect strength
let lastSwitch = performance.now();

function setFilter(id, { announce = true } = {}) {
  if (!FILTERS.some((f) => f.id === id)) id = 0;
  settings.filter = id;
  save();
  lastSwitch = performance.now();
  filtersEl.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.filter === id)));
  if (id !== mode || pendingMode !== null) pendingMode = id;
  if (announce) toast(FILTERS.find((f) => f.id === id).label);
}
function stepFilter(dir, { skipNormal = false } = {}) {
  const ids = FILTERS.map((f) => f.id).filter((id) => !skipNormal || id !== 0);
  const i = ids.indexOf(settings.filter);
  setFilter(ids[(i + dir + ids.length) % ids.length]);
}

const strengthEl = $('strength');
const strengthValue = $('strengthValue');
const fitEl = $('fit');
const autoEl = $('auto');
const secondsEl = $('seconds');
const cameraEl = $('camera');

strengthEl.value = settings.strength;
strengthValue.textContent = `${settings.strength}%`;
fitEl.value = settings.fit;
autoEl.checked = settings.auto;
secondsEl.value = String(settings.seconds);

strengthEl.addEventListener('input', () => {
  settings.strength = +strengthEl.value;
  strengthValue.textContent = `${settings.strength}%`;
  save();
});
fitEl.addEventListener('change', () => { settings.fit = fitEl.value; save(); });

// Screen orientation: rotates only the mirror image (and its captions), never the panel.
// Useful when the TV is mounted vertically but the computer still sees it as horizontal.
const rotationEl = $('rotation');
function setRotation(r) {
  settings.rotation = ((r % 4) + 4) % 4;
  rotationEl.value = String(settings.rotation);
  document.body.dataset.rotation = settings.rotation;
  save();
}
rotationEl.addEventListener('change', () => setRotation(+rotationEl.value));
$('resetRotation').addEventListener('click', () => setRotation(DEFAULT_ROTATION));
setRotation(settings.rotation);

// Captions on the mirror (filter name, "come closer"): can be switched off for an image-only screen
const captionsEl = $('captions');
captionsEl.checked = settings.captions;
document.body.classList.toggle('no-captions', !settings.captions);
captionsEl.addEventListener('change', () => {
  settings.captions = captionsEl.checked;
  document.body.classList.toggle('no-captions', !settings.captions);
  save();
});
autoEl.addEventListener('change', () => { settings.auto = autoEl.checked; lastSwitch = performance.now(); save(); });
secondsEl.addEventListener('change', () => { settings.seconds = +secondsEl.value; save(); });
cameraEl.addEventListener('change', () => { settings.camera = cameraEl.value; save(); startCamera(); });
$('prev').addEventListener('click', () => stepFilter(-1));
$('next').addEventListener('click', () => stepFilter(1));

function setMenu(hidden) {
  document.body.classList.toggle('ui-hidden', hidden);
  settings.uiHidden = hidden;
  save();
}
function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch((err) => note(`Schermo intero non disponibile: ${err.message}`));
}
$('hide').addEventListener('click', () => setMenu(true));
$('fullscreen').addEventListener('click', toggleFullscreen);
canvas.addEventListener('dblclick', () => setMenu(!document.body.classList.contains('ui-hidden')));

let showDebug = false;
document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  // Letter shortcuts always work, even after using a menu or slider in the panel;
  // arrows and space stay with the focused control (they change its value).
  const tag = document.activeElement?.tagName;
  const inControl = tag === 'INPUT' || tag === 'SELECT';
  if (inControl && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) return;
  const k = e.key.toLowerCase();
  if (k === 'h' || k === 'm') setMenu(!document.body.classList.contains('ui-hidden'));
  else if (k === 'escape' && document.body.classList.contains('ui-hidden')) setMenu(false);
  else if (k === 'f') toggleFullscreen();
  else if (k === 'arrowright') stepFilter(1);
  else if (k === 'arrowleft') stepFilter(-1);
  else if (k === ' ') { autoEl.checked = !autoEl.checked; autoEl.dispatchEvent(new Event('change')); }
  else if (k === 'd') { showDebug = !showDebug; debugCanvas.hidden = !showDebug; }
  else if (k === 'r') setRotation(settings.rotation + 1);
  else return;
  e.preventDefault();
});
// After picking an option, give the keyboard back to the mirror (shortcuts, arrows, space)
document.getElementById('panel').addEventListener('change', (e) => { if (e.target.tagName === 'SELECT') e.target.blur(); });

// Hide the mouse pointer after a few seconds without movement (kiosk screen)
let idleTimer = 0;
const wake = () => {
  document.body.classList.remove('is-idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('is-idle'), 3000);
};
['mousemove', 'mousedown', 'keydown', 'touchstart'].forEach((ev) => document.addEventListener(ev, wake, { passive: true }));
wake();

// Keep the screen on while the mirror is running
let wakeLock = null;
async function keepAwake() {
  try { if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { /* not supported or refused */ }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') keepAwake(); });

/* ---------- WebGL ---------- */
const MAX_FACES = 3;
const VEC4_PER_FACE = 7;
const faceUniforms = new Float32Array(MAX_FACES * VEC4_PER_FACE * 4);

const VERTEX = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() { vUv = (aPos + 1.0) * 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// Coordinates: warps work in "square" texture space, x scaled by the video aspect ratio,
// so circles stay circles. Each face is a local frame (centre + rotation from the eye line).
const FRAGMENT = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVideo;
uniform vec2 uResolution;   // canvas size (px)
uniform vec2 uVideoSize;    // camera frame size (px)
uniform int uFit;           // 0 = fill the screen (crop), 1 = show the whole frame
uniform int uRotation;      // display rotation in quarter turns clockwise: 0, 1 = 90°, 2 = 180°, 3 = 270°
uniform int uMode;          // filter id
uniform float uAmount;      // 0..1: intensity x fade
uniform int uFaceCount;
uniform vec4 uFace[${MAX_FACES * VEC4_PER_FACE}];

const vec3 BACKGROUND = vec3(0.055, 0.082, 0.078);

vec2 toLocal(vec2 d, vec2 rot) { return vec2(d.x * rot.x + d.y * rot.y, -d.x * rot.y + d.y * rot.x); }
vec2 toWorld(vec2 q, vec2 rot) { return vec2(q.x * rot.x - q.y * rot.y, q.x * rot.y + q.y * rot.x); }

// Scales the image around c inside an ellipse with radii r (aligned to the face).
// k > 0 enlarges, k < 0 shrinks, per local axis. The clamp keeps the mapping monotonic (no folds).
vec2 scaleAround(vec2 p, vec2 c, vec2 r, vec2 rot, vec2 k) {
  vec2 q = toLocal(p - c, rot);
  vec2 n = q / r;
  float t2 = dot(n, n);
  if (t2 >= 1.0) return p;
  float f = (1.0 - t2) * (1.0 - t2);
  k = clamp(k, vec2(-1.2), vec2(0.9));
  return c + toWorld(q * (1.0 - k * f), rot);
}

// Moves the image inside an ellipse by "shift" (local units, +y = up), fading out at the edge.
vec2 moveAround(vec2 p, vec2 c, vec2 r, vec2 rot, vec2 shift) {
  vec2 q = toLocal(p - c, rot);
  vec2 n = q / r;
  float t2 = dot(n, n);
  if (t2 >= 1.0) return p;
  float f = (1.0 - t2) * (1.0 - t2);
  shift = clamp(shift, -0.5 * r, 0.5 * r);
  return c + toWorld(q - shift * f, rot);
}

vec2 warpFace(vec2 p, int i) {
  int b = i * ${VEC4_PER_FACE};
  vec4 f0 = uFace[b], f1 = uFace[b + 1], f2 = uFace[b + 2], f3 = uFace[b + 3];
  vec4 f4 = uFace[b + 4], f5 = uFace[b + 5], f6 = uFace[b + 6];
  float a = uAmount * f1.z;                 // f1.z = this face's fade in/out
  if (a < 0.001) return p;
  vec2 center = f0.xy, rot = f0.zw;
  float hw = f1.x, hh = f1.y;               // half width / half height of the face
  vec2 eyeA = f2.xy, eyeB = f2.zw, nose = f3.xy, mouth = f3.zw;
  vec2 chin = f4.xy, brow = f4.zw, cheekA = f5.xy, cheekB = f5.zw;
  vec2 cornerA = f6.xy, cornerB = f6.zw;
  vec2 eyeR = vec2(0.42 * hw);
  vec2 mouthR = vec2(0.62 * hw, 0.42 * hw);
  vec2 cheekR = vec2(0.55 * hw);

  if (uMode == 1) {                         // Occhioni
    p = scaleAround(p, eyeA, eyeR, rot, vec2(0.55 * a));
    p = scaleAround(p, eyeB, eyeR, rot, vec2(0.55 * a));
  } else if (uMode == 2) {                  // Occhi piccoli
    p = scaleAround(p, eyeA, eyeR, rot, vec2(-0.85 * a));
    p = scaleAround(p, eyeB, eyeR, rot, vec2(-0.85 * a));
  } else if (uMode == 3) {                  // Faccia gonfia
    p = scaleAround(p, mix(nose, chin, 0.45), vec2(1.3 * hw, 0.95 * hh), rot, vec2(0.45 * a, 0.12 * a));
    p = scaleAround(p, cheekA, cheekR, rot, vec2(0.22 * a));
    p = scaleAround(p, cheekB, cheekR, rot, vec2(0.22 * a));
  } else if (uMode == 4) {                  // Faccia secca
    p = scaleAround(p, mix(center, chin, 0.25), vec2(1.3 * hw, 1.1 * hh), rot, vec2(-0.85 * a, 0.0));
    p = scaleAround(p, cheekA, cheekR, rot, vec2(-0.3 * a));
    p = scaleAround(p, cheekB, cheekR, rot, vec2(-0.3 * a));
  } else if (uMode == 5) {                  // Testone
    p = scaleAround(p, mix(center, brow, 0.25), vec2(1.6 * hw, 1.45 * hh), rot, vec2(0.5 * a));
  } else if (uMode == 6) {                  // Testina
    p = scaleAround(p, mix(center, brow, 0.25), vec2(1.6 * hw, 1.45 * hh), rot, vec2(-0.9 * a));
  } else if (uMode == 7) {                  // Nasone
    p = scaleAround(p, nose, vec2(0.48 * hw), rot, vec2(0.6 * a));
  } else if (uMode == 8) {                  // Nasino
    p = scaleAround(p, nose, vec2(0.48 * hw), rot, vec2(-0.85 * a));
  } else if (uMode == 9) {                  // Boccona
    p = scaleAround(p, mouth, mouthR, rot, vec2(0.55 * a));
  } else if (uMode == 10) {                 // Bocca piccola
    p = scaleAround(p, mouth, mouthR, rot, vec2(-0.85 * a));
  } else if (uMode == 11) {                 // Guance da criceto
    p = scaleAround(p, cheekA, cheekR, rot, vec2(0.6 * a));
    p = scaleAround(p, cheekB, cheekR, rot, vec2(0.6 * a));
  } else if (uMode == 12) {                 // Mento lungo
    p = scaleAround(p, mix(mouth, chin, 0.6), vec2(0.85 * hw, 0.5 * hh), rot, vec2(0.0, 0.4 * a));
    p = moveAround(p, chin, vec2(0.95 * hw, 0.6 * hh), rot, vec2(0.0, -0.28 * hh * a));
  } else if (uMode == 13) {                 // Fronte alta
    p = scaleAround(p, brow, vec2(1.05 * hw, 0.62 * hh), rot, vec2(0.12 * a, 0.5 * a));
    p = moveAround(p, brow, vec2(1.1 * hw, 0.7 * hh), rot, vec2(0.0, 0.22 * hh * a));
  } else if (uMode == 14) {                 // Faccia lunga
    p = scaleAround(p, center, vec2(1.4 * hw, 1.35 * hh), rot, vec2(-0.2 * a, 0.45 * a));
  } else if (uMode == 15) {                 // Faccia schiacciata
    p = scaleAround(p, center, vec2(1.4 * hw, 1.35 * hh), rot, vec2(0.28 * a, -0.85 * a));
  } else if (uMode == 16) {                 // Mascellone
    p = scaleAround(p, mix(mouth, chin, 0.45), vec2(1.35 * hw, 0.72 * hh), rot, vec2(0.6 * a, 0.05 * a));
  } else if (uMode == 17) {                 // Sorrisone: mouth corners up and slightly out
    vec2 r = vec2(0.4 * hw, 0.32 * hw);
    p = moveAround(p, cornerA, r, rot, vec2(-0.05 * hw * a, 0.15 * hw * a));
    p = moveAround(p, cornerB, r, rot, vec2(0.05 * hw * a, 0.15 * hw * a));
  } else if (uMode == 18) {                 // Alieno
    vec2 bigEye = vec2(0.5 * hw);
    p = scaleAround(p, eyeA, bigEye, rot, vec2(0.6 * a));
    p = scaleAround(p, eyeB, bigEye, rot, vec2(0.6 * a));
    p = scaleAround(p, mouth, mouthR, rot, vec2(-0.7 * a));
    p = scaleAround(p, mix(mouth, chin, 0.5), vec2(1.15 * hw, 0.7 * hh), rot, vec2(-0.75 * a, 0.0));
    p = scaleAround(p, brow, vec2(1.0 * hw, 0.6 * hh), rot, vec2(0.0, 0.3 * a));
  } else if (uMode == 19) {                 // Bebè
    p = scaleAround(p, eyeA, eyeR, rot, vec2(0.45 * a));
    p = scaleAround(p, eyeB, eyeR, rot, vec2(0.45 * a));
    p = scaleAround(p, nose, vec2(0.45 * hw), rot, vec2(-0.5 * a));
    p = scaleAround(p, mouth, mouthR, rot, vec2(-0.45 * a));
    p = scaleAround(p, cheekA, cheekR, rot, vec2(0.3 * a));
    p = scaleAround(p, cheekB, cheekR, rot, vec2(0.3 * a));
    p = scaleAround(p, chin, vec2(0.9 * hw, 0.5 * hh), rot, vec2(0.0, -0.5 * a));
  }
  return p;
}

void main() {
  // 1. Display rotation (final render only; face tracking keeps the camera's own coordinates).
  //    Find where this screen pixel lies in the upright mirror image. For 90° and 270° that
  //    upright image is the screen with width and height swapped, so proportions stay correct.
  vec2 s = (vUv - 0.5) * uResolution;
  vec2 res = uResolution;
  vec2 v = s;
  if (uRotation == 1) { v = vec2(-s.y, s.x); res = uResolution.yx; }       // 90° clockwise
  else if (uRotation == 2) { v = -s; }                                      // 180°
  else if (uRotation == 3) { v = vec2(s.y, -s.x); res = uResolution.yx; }  // 270° (90° anticlockwise)
  vec2 uv = v / res + 0.5;
  float aspect = res.x / res.y;
  float va = uVideoSize.x / max(1.0, uVideoSize.y);
  // 2. Mirror, then fit the camera frame (Riempi = crop, Contieni = whole frame with bands)
  uv.x = 1.0 - uv.x;                        // mirror reflection
  vec2 scale = vec2(1.0);
  if (uFit == 0) { if (aspect > va) scale.y = va / aspect; else scale.x = aspect / va; }
  else           { if (aspect > va) scale.x = aspect / va; else scale.y = va / aspect; }
  uv = (uv - 0.5) * scale + 0.5;

  vec2 p = vec2(uv.x * va, uv.y);
  if (uMode > 0) {
    for (int i = 0; i < ${MAX_FACES}; i++) {
      if (i >= uFaceCount) break;
      p = warpFace(p, i);
    }
  }
  uv = vec2(p.x / va, p.y);
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) { outColor = vec4(BACKGROUND, 1.0); return; }
  outColor = texture(uVideo, uv);
}`;

const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
let program = null;
let texture = null;
const loc = {};

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
  return shader;
}
function initGL() {
  if (!gl) throw new Error('WebGL2 non disponibile: usa Chrome o Edge aggiornati.');
  program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
  texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  for (const name of ['uVideo', 'uResolution', 'uVideoSize', 'uFit', 'uRotation', 'uMode', 'uAmount', 'uFaceCount', 'uFace']) {
    loc[name] = gl.getUniformLocation(program, name);
  }
  gl.uniform1i(loc.uVideo, 0);
}
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); note('La grafica si è interrotta: ricarico lo specchio…', { sticky: true }); });
canvas.addEventListener('webglcontextrestored', () => location.reload());

/* ---------- Face tracking ---------- */
// One Euro filter: smooths small jitter but follows fast movements without lag.
class OneEuro {
  constructor(minCutoff = 1.2, beta = 14, dCutoff = 1.0) { Object.assign(this, { minCutoff, beta, dCutoff, x: null, dx: 0 }); }
  static alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(value, dt) {
    if (this.x === null) { this.x = value; return value; }
    const dx = (value - this.x) / dt;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

// Parameter vector of a face, in square texture space:
// 0-1 centre · 2-3 cos/sin of the roll · 4 half width · 5 half height · 6-7 eye A · 8-9 eye B
// 10-11 nose · 12-13 mouth · 14-15 chin · 16-17 forehead · 18-19 cheek A · 20-21 cheek B
// 22-23 mouth corner A · 24-25 mouth corner B          ("A" = left side of the camera image)
const PARAMS = 26;

function faceParams(lm, va) {
  const P = (i) => [lm[i].x * va, 1 - lm[i].y];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const left = P(234), right = P(454), top = P(10), chin = P(152);
  const eyeA = mid(P(33), P(133)), eyeB = mid(P(362), P(263));
  const angle = Math.atan2(eyeB[1] - eyeA[1], eyeB[0] - eyeA[0]);
  const center = mid(mid(left, right), mid(top, chin));
  return [
    ...center, Math.cos(angle), Math.sin(angle),
    dist(left, right) / 2, dist(top, chin) / 2,
    ...eyeA, ...eyeB, ...P(1), ...mid(P(13), P(14)), ...chin, ...P(151),
    ...P(205), ...P(425), ...P(61), ...P(291),
  ];
}

// Tracked faces keep their own smoothing and fade, and are matched between frames by position.
let tracks = [];
function updateTracks(detected, now) {
  const used = new Set();
  for (const raw of detected) {
    let best = null;
    let bestDist = Infinity;
    for (const t of tracks) {
      if (used.has(t)) continue;
      const d = Math.hypot(t.raw[0] - raw[0], t.raw[1] - raw[1]);
      if (d < bestDist) { bestDist = d; best = t; }
    }
    if (!best || bestDist > raw[4] * 1.2) {
      best = { raw, value: Float32Array.from(raw), filters: raw.map(() => new OneEuro()), weight: 0, seen: now };
      tracks.push(best);
    }
    best.raw = raw;
    best.seen = now;
    used.add(best);
  }
}
function stepTracks(now, dt) {
  for (const t of tracks) {
    for (let i = 0; i < PARAMS; i++) t.value[i] = t.filters[i].filter(t.raw[i], dt);
    const n = Math.hypot(t.value[2], t.value[3]) || 1;
    t.value[2] /= n; t.value[3] /= n;
    const visible = now - t.seen < 150;
    t.weight = Math.min(1, Math.max(0, t.weight + (visible ? dt / 0.25 : -dt / 0.35)));
  }
  tracks = tracks.filter((t) => t.weight > 0 || now - t.seen < 150);
  tracks.sort((a, b) => b.weight - a.weight);
  faceUniforms.fill(0);
  const count = Math.min(MAX_FACES, tracks.length);
  for (let i = 0; i < count; i++) {
    const v = tracks[i].value;
    const o = i * VEC4_PER_FACE * 4;
    faceUniforms.set([v[0], v[1], v[2], v[3], v[4], v[5], tracks[i].weight, 0], o);
    faceUniforms.set(v.subarray(6, 26), o + 8);
  }
  return count;
}

let landmarker = null;
let delegate = '';
async function loadLandmarker() {
  try {
    const base = new URL('vendor/mediapipe/', location.href).href;
    const { FaceLandmarker, FilesetResolver } = await import(`${base}vision_bundle.mjs`);
    const fileset = await FilesetResolver.forVisionTasks(`${base}wasm`);
    const options = (d) => ({
      baseOptions: { modelAssetPath: `${base}models/face_landmarker.task`, delegate: d },
      runningMode: 'VIDEO', numFaces: MAX_FACES,
      minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    // GPU is much faster; some computers only manage the CPU version
    for (const d of ['GPU', 'CPU']) {
      try { landmarker = await FaceLandmarker.createFromOptions(fileset, options(d)); delegate = d; break; } catch (e) { console.warn(`Face Landmarker (${d})`, e); }
    }
    if (!landmarker) throw new Error('modello non avviato');
    // do not hide a camera problem behind a "ready" message
    if (videoReady) note('Specchio pronto: mettiti davanti alla videocamera.');
  } catch (err) {
    console.error(err);
    note('Riconoscimento del volto non disponibile: lo specchio funziona solo come specchio normale.', { sticky: true });
  }
}

/* ---------- Camera ---------- */
let stream = null;
let videoReady = false;
let retryTimer = 0;

async function listCameras() {
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    cameraEl.innerHTML = '';
    cameraEl.append(new Option('Predefinita', ''));
    devices.forEach((d, i) => cameraEl.append(new Option(d.label || `Videocamera ${i + 1}`, d.deviceId)));
    cameraEl.value = devices.some((d) => d.deviceId === settings.camera) ? settings.camera : '';
  } catch (e) { /* list not available */ }
}

async function startCamera() {
  clearTimeout(retryTimer);
  if (TEST_MODE) { startTestPattern(); return; }
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      throw Object.assign(new Error('La videocamera funziona solo da https:// o da http://localhost.'), { name: 'Insecure' });
    }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    note('Richiesta del permesso per la videocamera…', { sticky: true });
    const video_ = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } };
    if (settings.camera) video_.deviceId = { exact: settings.camera };
    else video_.facingMode = 'user';
    // If the camera never answers (macOS has not allowed this browser, or another app is using it),
    // getUserMedia stays pending forever: after a few seconds explain what to check, but keep waiting.
    const slow = setTimeout(() => note(
      'La videocamera non risponde. Su Mac: Impostazioni di Sistema › Privacy e sicurezza › Videocamera, attiva il browser che stai usando; '
      + 'poi chiudi le app che la usano (FaceTime, Zoom, Teams…) e ricarica la pagina.', { sticky: true }), 8000);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: video_ });
    } finally {
      clearTimeout(slow);
    }
    // if the camera is unplugged or stops, try again every few seconds
    stream.getVideoTracks()[0].addEventListener('ended', () => {
      videoReady = false;
      note('La videocamera si è scollegata: riprovo…', { sticky: true });
      retryTimer = setTimeout(startCamera, 3000);
    });
    video.srcObject = stream;
    await video.play();
    videoReady = true;
    listCameras();
    keepAwake();
    note(landmarker ? 'Specchio pronto: mettiti davanti alla videocamera.' : 'Videocamera attiva. Avvio del riconoscimento del volto…');
  } catch (err) {
    videoReady = false;
    console.error(err);
    const messages = {
      NotAllowedError: 'Permesso negato: consenti l\'uso della videocamera dalle impostazioni del browser, poi ricarica la pagina.',
      NotFoundError: 'Nessuna videocamera trovata: collegala e attendi qualche secondo.',
      NotReadableError: 'La videocamera è già usata da un altro programma: chiudilo, riprovo tra poco.',
      OverconstrainedError: 'La videocamera scelta non è disponibile: torno a quella predefinita.',
      Insecure: err.message,
    };
    note(messages[err.name] || `Videocamera non disponibile: ${err.message}`, { sticky: true });
    if (err.name === 'OverconstrainedError') { settings.camera = ''; save(); }
    if (err.name !== 'NotAllowedError' && err.name !== 'Insecure') retryTimer = setTimeout(startCamera, 4000);
  }
}

// ?prova: grid + fake face, to check the warps without a camera
function startTestPattern() {
  const c = document.createElement('canvas');
  c.width = 1280; c.height = 720;
  const g = c.getContext('2d');
  g.fillStyle = '#1b2624'; g.fillRect(0, 0, 1280, 720);
  g.strokeStyle = '#b89a5e'; g.lineWidth = 2;
  for (let x = 0; x <= 1280; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 720); g.stroke(); }
  for (let y = 0; y <= 720; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(1280, y); g.stroke(); }
  g.fillStyle = '#ede6d8';
  for (const [x, y, r] of [[560, 300, 34], [720, 300, 34], [640, 390, 26], [640, 470, 40]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#ede6d8'; g.lineWidth = 4;
  g.beginPath(); g.ellipse(640, 380, 190, 240, 0, 0, Math.PI * 2); g.stroke();
  video.srcObject = c.captureStream(30);
  video.play().then(() => {
    videoReady = true;
    // stays on screen with a way out, so nobody gets stuck on the grid
    statusEl.textContent = 'Modalità di prova: griglia e volto finto, senza videocamera. ';
    const link = document.createElement('a');
    link.href = location.pathname;
    link.textContent = 'Usa la webcam →';
    statusEl.append(link);
    statusEl.classList.remove('is-quiet');
  });
  const va = 1280 / 720;
  const p = (x, y) => [x / 1280 * va, 1 - y / 720];
  testFace = [...p(640, 380), 1, 0, 190 / 1280 * va, 240 / 720, ...p(560, 300), ...p(720, 300), ...p(640, 390), ...p(640, 470),
    ...p(640, 615), ...p(640, 200), ...p(530, 420), ...p(750, 420), ...p(600, 470), ...p(680, 470)];
}
let testFace = null;

/* ---------- Render loop ---------- */
let lastVideoTime = -1;
let lastFrame = performance.now();
let detectMs = 0;
let noFaceSince = performance.now();
let frames = 0;
let fps = 0;
let fpsTime = performance.now();

function resize() {
  // cap the canvas size: on 4K TVs the warp still looks sharp and stays fast
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = Math.round(innerWidth * dpr);
  let h = Math.round(innerHeight * dpr);
  const cap = 2560 / Math.max(w, h);
  if (cap < 1) { w = Math.round(w * cap); h = Math.round(h * cap); }
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; gl.viewport(0, 0, w, h); }
  if (showDebug && (debugCanvas.width !== innerWidth || debugCanvas.height !== innerHeight)) { debugCanvas.width = innerWidth; debugCanvas.height = innerHeight; }
}

function detect(now) {
  if (TEST_MODE) { if (testFace) updateTracks([testFace], now); return; }
  if (!landmarker || video.readyState < 2 || video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;
  const t0 = performance.now();
  try {
    const result = landmarker.detectForVideo(video, now);
    const va = video.videoWidth / video.videoHeight;
    updateTracks((result.faceLandmarks || []).map((lm) => faceParams(lm, va)), now);
  } catch (err) { console.warn('Face Landmarker', err); }
  detectMs = detectMs * 0.9 + (performance.now() - t0) * 0.1;
}

function render(now) {
  requestAnimationFrame(render);
  if (!program) return;
  const dt = Math.min(0.1, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  resize();
  if (!videoReady || video.readyState < 2) { gl.clearColor(0.055, 0.082, 0.078, 1); gl.clear(gl.COLOR_BUFFER_BIT); return; }

  detect(now);
  const faceCount = stepTracks(now, dt);

  // fade between filters: out, switch, in
  if (pendingMode !== null) {
    fade = Math.max(0, fade - dt / 0.18);
    if (fade === 0) { mode = pendingMode; pendingMode = null; }
  } else {
    fade = Math.min(1, fade + dt / 0.35);
  }
  if (settings.auto && now - lastSwitch > settings.seconds * 1000) stepFilter(1, { skipNormal: true });

  // invite people to come closer when nobody is in front of the mirror
  if (faceCount && tracks[0].weight > 0.5) noFaceSince = now;
  const lonely = (landmarker || TEST_MODE) && now - noFaceSince > 3000 && document.body.classList.contains('ui-hidden');
  promptEl.classList.toggle('is-on', lonely);

  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  gl.uniform2f(loc.uResolution, canvas.width, canvas.height);
  gl.uniform2f(loc.uVideoSize, video.videoWidth, video.videoHeight);
  gl.uniform1i(loc.uFit, settings.fit === 'contain' ? 1 : 0);
  gl.uniform1i(loc.uRotation, settings.rotation);
  gl.uniform1i(loc.uMode, mode);
  const eased = fade * fade * (3 - 2 * fade);
  gl.uniform1f(loc.uAmount, (settings.strength / 100) * eased);
  gl.uniform1i(loc.uFaceCount, faceCount);
  gl.uniform4fv(loc.uFace, faceUniforms);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  frames++;
  if (now - fpsTime > 1000) { fps = Math.round(frames * 1000 / (now - fpsTime)); frames = 0; fpsTime = now; }
  if (showDebug) drawDebug(faceCount);
}

// D key: face frames and timings, to tune the filters
function drawDebug(faceCount) {
  const g = debugCanvas.getContext('2d');
  const W = debugCanvas.width;
  const H = debugCanvas.height;
  g.clearRect(0, 0, W, H);
  const rot = settings.rotation;
  const VW = rot % 2 ? H : W;               // size of the upright mirror image
  const VH = rot % 2 ? W : H;
  const aspect = VW / VH;
  const va = video.videoWidth / video.videoHeight;
  let sx = 1, sy = 1;
  if (settings.fit !== 'contain') { if (aspect > va) sy = va / aspect; else sx = aspect / va; }
  else { if (aspect > va) sx = aspect / va; else sy = va / aspect; }
  // square texture space -> upright image -> rotated screen pixels (inverse of the shader mapping)
  const toScreen = (x, y) => {
    let cx = (1 - ((x / va - 0.5) / sx + 0.5) - 0.5) * VW;
    let cy = ((y - 0.5) / sy) * VH;
    if (rot === 1) [cx, cy] = [cy, -cx];
    else if (rot === 2) [cx, cy] = [-cx, -cy];
    else if (rot === 3) [cx, cy] = [-cy, cx];
    return [W / 2 + cx, H / 2 - cy];
  };
  for (let i = 0; i < faceCount; i++) {
    const v = tracks[i].value;
    g.strokeStyle = `rgba(184,154,94,${tracks[i].weight})`;
    g.fillStyle = g.strokeStyle;
    g.lineWidth = 2;
    for (let k = 6; k < PARAMS; k += 2) { const [x, y] = toScreen(v[k], v[k + 1]); g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); }
    const [cx, cy] = toScreen(v[0], v[1]);
    const [ex, ey] = toScreen(v[0] + v[2] * v[4], v[1] + v[3] * v[4]);
    g.beginPath(); g.moveTo(cx, cy); g.lineTo(ex, ey); g.stroke();
  }
  g.fillStyle = 'rgba(14,21,20,.8)';
  g.fillRect(12, H - 40, 380, 28);
  g.fillStyle = '#ede6d8';
  g.font = '12px Manrope, system-ui, sans-serif';
  g.fillText(`${fps} fps · volti ${faceCount} · AI ${delegate || (TEST_MODE ? 'prova' : '—')} ${detectMs.toFixed(1)} ms · ${video.videoWidth}×${video.videoHeight}`, 22, H - 21);
}

/* ---------- Start ---------- */
setFilter(settings.filter, { announce: false });
mode = settings.filter; pendingMode = null;
if (settings.uiHidden) document.body.classList.add('ui-hidden');
try {
  initGL();
  requestAnimationFrame(render);
} catch (err) {
  console.error(err);
  note(`Errore della grafica: ${err.message}`, { sticky: true });
}
startCamera();
if (!TEST_MODE) loadLandmarker();
