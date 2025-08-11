const CDN_BASE = "https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist";
const RNNOISE_JS = `${CDN_BASE}/rnnoise.js`;

let ModuleFactory = null;

async function loadRnnoise() {
  if (ModuleFactory) return;
  ModuleFactory = (await import(RNNOISE_JS)).default;
}

const TARGET_SR = 48000;
const FRAME_SIZE = 480;

const el = {
  drop: document.getElementById('drop'),
  fileInput: document.getElementById('fileInput'),
  strength: document.getElementById('strength'),
  progressWrap: document.getElementById('progressWrap'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  preview: document.getElementById('preview'),
  playerOriginal: document.getElementById('playerOriginal'),
  playerDenoised: document.getElementById('playerDenoised'),
  downloadLink: document.getElementById('downloadLink'),
};

function setProgress(pct, text) {
  el.progressWrap.classList.remove('hidden');
  el.progressBar.style.width = Math.max(0, Math.min(100, pct)) + '%';
  if (text) el.progressText.textContent = text;
}

function hideProgress() {
  el.progressWrap.classList.add('hidden');
}

el.drop.addEventListener('click', () => el.fileInput.click());
el.drop.addEventListener('dragover', e => { e.preventDefault(); });
el.drop.addEventListener('drop', e => {
  e.preventDefault();
  const f = e.dataTransfer.files?.[0];
  if (f) processFile(f);
});
el.fileInput.addEventListener('change', e => {
  const f = e.target.files?.[0];
  if (f) processFile(f);
});

async function decodeFileToBuffer(file) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuf = await file.arrayBuffer();
  return await ac.decodeAudioData(arrayBuf.slice(0));
}

async function resampleToMono48k(buf) {
  const numCh = buf.numberOfChannels;
  const length = buf.length;
  const tmp = new Float32Array(length);
  if (numCh === 1) buf.copyFromChannel(tmp, 0);
  else {
    const ch0 = new Float32Array(length);
    const ch1 = new Float32Array(length);
    buf.copyFromChannel(ch0, 0);
    buf.copyFromChannel(ch1, 1);
    for (let i = 0; i < length; i++) tmp[i] = 0.5 * (ch0[i] + ch1[i]);
  }
  if (buf.sampleRate === TARGET_SR) return tmp;
  const oac = new OfflineAudioContext(1, Math.ceil(length * TARGET_SR / buf.sampleRate), TARGET_SR);
  const src = oac.createBufferSource();
  const mono = oac.createBuffer(1, length, buf.sampleRate);
  mono.copyToChannel(tmp, 0);
  src.buffer = mono;
  src.connect(oac.destination);
  src.start();
  const rendered = await oac.startRendering();
  const out = new Float32Array(rendered.length);
  rendered.copyFromChannel(out, 0);
  return out;
}

async function encodePCMToWav(samples48kMono) {
  function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  const numFrames = samples48kMono.length;
  const bytesPerSample = 2;
  const blockAlign = 1 * bytesPerSample;
  const byteRate = TARGET_SR * blockAlign;
  const dataSize = numFrames * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SR, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);
  let offset = 44;
  for (let i = 0; i < numFrames; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples48kMono[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buffer;
}

async function rnnoiseDenoise(input48kMono, strength, onProgress) {
  await loadRnnoise();
  const mod = await ModuleFactory({
    locateFile: (path) => path.endsWith('.wasm') ? `${CDN_BASE}/rnnoise.wasm` : path,
  });

  const frameCount = Math.ceil(input48kMono.length / FRAME_SIZE);
  const out = new Float32Array(frameCount * FRAME_SIZE);

  const state = mod._rnnoise_create();
  const framePtr = mod._malloc(FRAME_SIZE * 4);

  const mix = (v) => {
    if (strength === 0) return v * 0.7;
    if (strength === 1) return v * 0.85;
    return v;
  };

  for (let i = 0; i < frameCount; i++) {
    const start = i * FRAME_SIZE;
    const frame = input48kMono.subarray(start, Math.min(start + FRAME_SIZE, input48kMono.length));
    const tmp = new Float32Array(FRAME_SIZE);
    tmp.set(frame);
    mod.HEAPF32.set(tmp, framePtr >> 2);
    mod._rnnoise_process_frame(state, framePtr, framePtr);
    const processed = mod.HEAPF32.subarray(framePtr >> 2, (framePtr >> 2) + FRAME_SIZE);
    for (let j = 0; j < FRAME_SIZE; j++) {
      out[start + j] = mix(processed[j]);
    }
    if (onProgress && i % 50 === 0) onProgress(Math.round((i / frameCount) * 100));
  }

  mod._rnnoise_destroy(state);
  mod._free(framePtr);

  return out.subarray(0, input48kMono.length);
}

async function processFile(file) {
  try {
    setProgress(5, "Decoding…");
    el.preview.classList.add('hidden');
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const strength = parseInt(el.strength.value, 10) || 1;

    const buf = await decodeFileToBuffer(file);
    setProgress(20, "Resampling…");
    const mono48 = await resampleToMono48k(buf);
    setProgress(30, "Denoising…");
    const cleaned = await rnnoiseDenoise(mono48, strength, (p)=>setProgress(30 + p*0.6, "Denoising…"));
    setProgress(95, "Encoding WAV…");
    const wav = await encodePCMToWav(cleaned);

    const originalWav = await encodePCMToWav(mono48);

    const origUrl = URL.createObjectURL(new Blob([originalWav], {type:'audio/wav'}));
    const denoisedUrl = URL.createObjectURL(new Blob([wav], {type:'audio/wav'}));

    el.playerOriginal.src = origUrl;
    el.playerDenoised.src = denoisedUrl;
    el.downloadLink.href = denoisedUrl;
    el.downloadLink.download = baseName + "_denoised.wav";

    el.preview.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert("Sorry — something went wrong processing that file.");
  } finally {
    hideProgress();
  }
}
