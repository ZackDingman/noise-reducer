
// Fresh build: mono + true stereo RNNoise, entirely local rnnoise.js/wasm (no CDN).

let RN_MODULE = null;
const RN_JS_PATH = "./rnnoise.js";      // You will upload this file
const RN_WASM_PATH = "./rnnoise.wasm";  // You will upload this file

const TARGET_SR = 48000;
const FRAME_SIZE = 480; // 10 ms

const el = {
  drop: document.getElementById('drop'),
  fileInput: document.getElementById('fileInput'),
  strength: document.getElementById('strength'),
  wet: document.getElementById('wet'),
  progressWrap: document.getElementById('progressWrap'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  preview: document.getElementById('preview'),
  playerOriginal: document.getElementById('playerOriginal'),
  playerDenoised: document.getElementById('playerDenoised'),
  downloadLink: document.getElementById('downloadLink'),
  status: document.getElementById('rn-status'),
  diag: document.getElementById('diag'),
};

function setStatus(ok, msg){
  el.status.className = 'status ' + (ok ? 'status-good' : 'status-bad');
  el.status.textContent = 'RNNoise: ' + msg;
}

function logDiag(line){
  if (!el.diag) return;
  el.diag.textContent += line + "\n";
}

async function loadRnnoise(){
  if (RN_MODULE) return RN_MODULE;
  try {
    // Load local rnnoise.js dynamically
    const modFactory = (await import(RN_JS_PATH)).default;
    RN_MODULE = await modFactory({
      locateFile: (path) => path.endsWith('.wasm') ? RN_WASM_PATH : path,
    });
    setStatus(true, 'active');
    logDiag('[OK] RNNoise module initialized.');
    return RN_MODULE;
  } catch (e) {
    setStatus(false, 'failed to load');
    logDiag('[ERR] RNNoise failed to load: ' + (e && e.message ? e.message : e));
    throw e;
  }
}

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
  try {
    return await ac.decodeAudioData(arrayBuf.slice(0));
  } catch (err) {
    logDiag('[ERR] Browser failed to decode audio: ' + err);
    throw err;
  }
}

function extractChannels(abuf) {
  const n = abuf.numberOfChannels;
  if (n <= 1) {
    const a = new Float32Array(abuf.length);
    abuf.copyFromChannel(a, 0);
    return {ch:[a], sr: abuf.sampleRate};
  } else {
    const L = new Float32Array(abuf.length);
    const R = new Float32Array(abuf.length);
    abuf.copyFromChannel(L, 0);
    abuf.copyFromChannel(R, 1);
    return {ch:[L,R], sr: abuf.sampleRate};
  }
}

async function resampleTo48k(samples, sr) {
  if (sr === TARGET_SR) return samples;
  const oac = new OfflineAudioContext(1, Math.ceil(samples.length * TARGET_SR / sr), TARGET_SR);
  const src = oac.createBufferSource();
  const b = oac.createBuffer(1, samples.length, sr);
  b.copyToChannel(samples, 0);
  src.buffer = b; src.connect(oac.destination); src.start();
  const rendered = await oac.startRendering();
  const out = new Float32Array(rendered.length);
  rendered.copyFromChannel(out, 0);
  return out;
}

async function denoiseMono(input48k, strength, wet, mod) {
  const frames = Math.ceil(input48k.length / FRAME_SIZE);
  const out = new Float32Array(frames * FRAME_SIZE);
  const state = mod._rnnoise_create();
  const ptr = mod._malloc(FRAME_SIZE * 4);

  const strengthScale = strength === 0 ? 0.9 : (strength === 1 ? 1.0 : 1.1);
  const mix = Math.max(0, Math.min(1, wet));

  for (let i = 0; i < frames; i++) {
    const start = i * FRAME_SIZE;
    const dryFrame = input48k.subarray(start, Math.min(start + FRAME_SIZE, input48k.length));
    const tmp = new Float32Array(FRAME_SIZE);
    tmp.set(dryFrame);
    mod.HEAPF32.set(tmp, ptr >> 2);
    mod._rnnoise_process_frame(state, ptr, ptr);
    const den = mod.HEAPF32.subarray(ptr >> 2, (ptr >> 2) + FRAME_SIZE);

    for (let j = 0; j < FRAME_SIZE; j++) {
      const dry = tmp[j] || 0;
      const wetSample = (den[j] || 0) * strengthScale;
      out[start + j] = dry * (1 - mix) + wetSample * mix;
    }
  }
  mod._rnnoise_destroy(state);
  mod._free(ptr);
  return out.subarray(0, input48k.length);
}

function encodeWavPCM16(chs48k){
  const nCh = chs48k.length;
  const nFrames = chs48k[0].length;
  const bps = 2;
  const align = nCh * bps;
  const rate = TARGET_SR * align;
  const dataSize = nFrames * align;
  const buf = new ArrayBuffer(44 + dataSize);
  const v = new DataView(buf);
  function wstr(off, s){ for(let i=0;i<s.length;i++) v.setUint8(off+i, s.charCodeAt(i)); }

  wstr(0,'RIFF'); v.setUint32(4, 36 + dataSize, true);
  wstr(8,'WAVE'); wstr(12,'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,nCh,true);
  v.setUint32(24,TARGET_SR,true); v.setUint32(28,rate,true); v.setUint16(32,align,true); v.setUint16(34,16,true);
  wstr(36,'data'); v.setUint32(40,dataSize,true);

  let off=44;
  for (let i=0;i<nFrames;i++){
    for(let c=0;c<nCh;c++){
      const s = Math.max(-1, Math.min(1, chs48k[c][i]));
      v.setInt16(off, s<0 ? s*0x8000 : s*0x7fff, true);
      off+=2;
    }
  }
  return buf;
}

async function processFile(file){
  try {
    setProgress(5, "Decoding…");
    el.preview.classList.add('hidden');
    el.diag.textContent='';

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const strength = parseInt(el.strength.value, 10) || 1;
    const wet = (parseInt(el.wet.value, 10) || 85) / 100;

    const abuf = await decodeFileToBuffer(file);
    const {ch, sr} = extractChannels(abuf);

    setProgress(20, "Resampling…");
    const res = [];
    for (let i=0;i<ch.length;i++) res.push(await resampleTo48k(ch[i], sr));

    const mod = await loadRnnoise();

    setProgress(40, ch.length===2 ? "Denoising (L)…" : "Denoising…");
    const den = [];
    den.push(await denoiseMono(res[0], strength, wet, mod));
    if (res.length===2){
      setProgress(70, "Denoising (R)…");
      den.push(await denoiseMono(res[1], strength, wet, mod));
    }

    setProgress(92, "Encoding WAV…");
    const origWav = encodeWavPCM16(res);
    const denWav = encodeWavPCM16(den);

    const origUrl = URL.createObjectURL(new Blob([origWav], {type:'audio/wav'}));
    const denUrl = URL.createObjectURL(new Blob([denWav], {type:'audio/wav'}));

    el.playerOriginal.src = origUrl;
    el.playerDenoised.src = denUrl;
    el.downloadLink.href = denUrl;
    el.downloadLink.download = baseName + "_denoised.wav";

    el.preview.classList.remove('hidden');
  } catch (e){
    logDiag('[ERR] ' + e);
    alert("RNNoise failed to run. Open Diagnostics below for details. Make sure rnnoise.js and rnnoise.wasm are in this same folder.");
  } finally {
    hideProgress();
  }
}

// Preload RNNoise on page load so the badge turns green
loadRnnoise().catch(e => console.warn('RNNoise preload failed', e));
