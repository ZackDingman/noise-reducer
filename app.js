// True stereo + mono support with local rnnoise.wasm.
// Each channel is resampled to 48 kHz and denoised separately, then re-encoded as mono or stereo WAV.

const CDN_BASE = "https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist";
const RNNOISE_JS = `${CDN_BASE}/rnnoise.js`;

let ModuleFactory = null;
let rnModule = null;

function folderURL() { return new URL('./', window.location.href).href; }

async function loadRnnoise() {
  if (rnModule) return rnModule;
  if (!ModuleFactory) {
    console.log('[RNNoise] Loading rnnoise.js from CDN…');
    ModuleFactory = (await import(RNNOISE_JS)).default;
  }
  rnModule = await ModuleFactory({
    locateFile: (path) => path.endsWith('.wasm') ? folderURL() + 'rnnoise.wasm' : path,
  });
  console.log('[RNNoise] Module initialized with local rnnoise.wasm');
  return rnModule;
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

function setProgress(p, text){ el.progressWrap.classList.remove('hidden'); el.progressBar.style.width = Math.min(100, Math.max(0, p)) + '%'; if(text) el.progressText.textContent = text; }
function hideProgress(){ el.progressWrap.classList.add('hidden'); }

el.drop.addEventListener('click', () => el.fileInput.click());
el.drop.addEventListener('dragover', e => { e.preventDefault(); el.drop.classList.add('drag'); });
el.drop.addEventListener('dragleave', () => el.drop.classList.remove('drag'));
el.drop.addEventListener('drop', e => { e.preventDefault(); el.drop.classList.remove('drag'); const f = e.dataTransfer.files?.[0]; if (f) processFile(f); });
el.fileInput.addEventListener('change', e => { const f = e.target.files?.[0]; if (f) processFile(f); });

async function decodeFileToBuffer(file) {
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const arrayBuf = await file.arrayBuffer();
  return await ac.decodeAudioData(arrayBuf.slice(0));
}

// Resample a single channel Float32Array to 48k using OfflineAudioContext
async function resampleChannelTo48k(samples, sampleRate) {
  if (sampleRate === TARGET_SR) return samples;
  const oac = new OfflineAudioContext(1, Math.ceil(samples.length * TARGET_SR / sampleRate), TARGET_SR);
  const src = oac.createBufferSource();
  const buf = oac.createBuffer(1, samples.length, sampleRate);
  buf.copyToChannel(samples, 0);
  src.buffer = buf; src.connect(oac.destination); src.start();
  const rendered = await oac.startRendering();
  const out = new Float32Array(rendered.length);
  rendered.copyFromChannel(out, 0);
  return out;
}

function extractChannels(audioBuf) {
  const ch = audioBuf.numberOfChannels;
  if (ch === 1) {
    const a = new Float32Array(audioBuf.length);
    audioBuf.copyFromChannel(a, 0);
    return { channels: [a], sampleRate: audioBuf.sampleRate };
  } else {
    // Use first two channels for stereo; if >2 channels, we ignore the rest
    const L = new Float32Array(audioBuf.length);
    const R = new Float32Array(audioBuf.length);
    audioBuf.copyFromChannel(L, 0);
    audioBuf.copyFromChannel(R, 1);
    return { channels: [L, R], sampleRate: audioBuf.sampleRate };
  }
}

async function rnnoiseDenoiseSingle(input48kMono, strength, mod) {
  const state = mod._rnnoise_create();
  const framePtr = mod._malloc(FRAME_SIZE * 4);
  const out = new Float32Array(Math.ceil(input48kMono.length / FRAME_SIZE) * FRAME_SIZE);
  const mix = (v) => strength === 0 ? v * 0.7 : (strength === 1 ? v * 0.85 : v);

  const frames = Math.ceil(input48kMono.length / FRAME_SIZE);
  for (let i = 0; i < frames; i++) {
    const start = i * FRAME_SIZE;
    const frame = input48kMono.subarray(start, Math.min(start + FRAME_SIZE, input48kMono.length));
    const tmp = new Float32Array(FRAME_SIZE);
    tmp.set(frame);
    mod.HEAPF32.set(tmp, framePtr >> 2);
    mod._rnnoise_process_frame(state, framePtr, framePtr);
    const processed = mod.HEAPF32.subarray(framePtr >> 2, (framePtr >> 2) + FRAME_SIZE);
    for (let j = 0; j < FRAME_SIZE; j++) out[start + j] = mix(processed[j]);
  }
  mod._rnnoise_destroy(state);
  mod._free(framePtr);
  return out.subarray(0, input48kMono.length);
}

function encodeWavPCM16(channels48k) {
  const numChannels = channels48k.length;
  const numFrames = channels48k[0].length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = TARGET_SR * blockAlign;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(view, offset, str){ for(let i=0;i<str.length;i++) view.setUint8(offset+i, str.charCodeAt(i)); }
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, TARGET_SR, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const s = Math.max(-1, Math.min(1, channels48k[ch][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

async function processFile(file) {
  try {
    setProgress(5, "Decoding…");
    el.preview.classList.add('hidden');
    const baseName = file.name.replace(/\.[^.]+$/, '');
    const strength = parseInt(el.strength.value, 10) || 1;

    const buf = await decodeFileToBuffer(file);
    const { channels, sampleRate } = extractChannels(buf);

    setProgress(20, "Resampling…");
    const resampled = [];
    for (let i = 0; i < channels.length; i++) {
      resampled.push(await resampleChannelTo48k(channels[i], sampleRate));
    }

    setProgress(35, channels.length === 2 ? "Denoising (L)…" : "Denoising…");
    const mod = await loadRnnoise();

    // Denoise per channel
    const cleaned = [];
    cleaned.push(await rnnoiseDenoiseSingle(resampled[0], strength, mod));
    if (resampled.length === 2) {
      setProgress(65, "Denoising (R)…");
      cleaned.push(await rnnoiseDenoiseSingle(resampled[1], strength, mod));
    }

    setProgress(92, "Encoding WAV…");
    const origWav = encodeWavPCM16(resampled);
    const denWav = encodeWavPCM16(cleaned);

    const origUrl = URL.createObjectURL(new Blob([origWav], {type:'audio/wav'}));
    const denUrl = URL.createObjectURL(new Blob([denWav], {type:'audio/wav'}));

    el.playerOriginal.src = origUrl;
    el.playerDenoised.src = denUrl;
    el.downloadLink.href = denUrl;
    el.downloadLink.download = baseName + "_denoised.wav";

    el.preview.classList.remove('hidden');
  } catch (err) {
    console.error(err);
    alert("Sorry — something went wrong processing that file.");
  } finally {
    hideProgress();
  }
}
