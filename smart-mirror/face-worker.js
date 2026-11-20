/* Aqua — smart mirror face AI worker.
   Runs MediaPipe Face Landmarker in its own thread, so the ~20 ms of analysis per camera frame never
   blocks the drawing of the mirror. The page sends a cropped frame (ImageBitmap) and gets back the
   face points; the options come from mirror.js, so both ways of running the AI behave the same. */

let landmarker = null;
let delegate = '';
let lastTimestamp = 0;

// MediaPipe loads its WASM glue code with importScripts(), which module workers refuse (TypeError);
// it then falls back to self.import(url). Running the script as global code defines self.ModuleFactory,
// exactly as importScripts would.
self.import = async (url) => {
  const code = await (await fetch(url)).text();
  (0, eval)(`${code}\n//# sourceURL=${url}`);
};

async function init({ base, options }) {
  const { FaceLandmarker, FilesetResolver } = await import(`${base}vision_bundle.mjs`);
  const fileset = await FilesetResolver.forVisionTasks(`${base}wasm`);
  // GPU is much faster; some computers only manage the CPU version
  for (const d of ['GPU', 'CPU']) {
    try {
      landmarker = await FaceLandmarker.createFromOptions(fileset, {
        ...options, baseOptions: { modelAssetPath: `${base}models/face_landmarker.task`, delegate: d },
      });
      delegate = d;
      break;
    } catch (e) { console.warn(`Face Landmarker nel worker (${d})`, e); }
  }
  if (!landmarker) throw new Error('modello non avviato nel worker');
}

function detect(msg) {
  const { bitmap } = msg;
  const echo = { seq: msg.seq, time: msg.time, sent: msg.sent, area: msg.area };
  try {
    // VIDEO mode needs strictly increasing timestamps (ms)
    const timestamp = Math.max(lastTimestamp + 1, Math.round(msg.time));
    lastTimestamp = timestamp;
    const t0 = performance.now();
    const result = landmarker.detectForVideo(bitmap, timestamp);
    const inferMs = performance.now() - t0;
    // only x and y are used: pack them, so the transfer back is cheap
    const faces = (result.faceLandmarks || []).map((lm) => {
      const packed = new Float32Array(lm.length * 2);
      for (let i = 0; i < lm.length; i++) { packed[2 * i] = lm[i].x; packed[2 * i + 1] = lm[i].y; }
      return packed;
    });
    self.postMessage({ type: 'result', faces, inferMs, ...echo }, faces.map((f) => f.buffer));
  } catch (err) {
    self.postMessage({ type: 'result', faces: [], inferMs: 0, error: String(err), ...echo });
  } finally {
    bitmap.close();
  }
}

self.onmessage = async (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      await init(msg);
      self.postMessage({ type: 'ready', delegate });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err && err.message ? err.message : err) });
    }
  } else if (msg.type === 'detect') {
    if (landmarker) detect(msg);
    else { msg.bitmap.close(); self.postMessage({ type: 'result', faces: [], inferMs: 0, seq: msg.seq, time: msg.time, sent: msg.sent, area: msg.area }); }
  }
};
