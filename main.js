import createRnnoiseModule from './rnnoise.js';

const statusEl = document.getElementById('rn-status');
let RN = null;

async function init() {
  try {
    RN = await createRnnoiseModule({
      locateFile: (p) => p.endsWith('.wasm') ? './rnnoise.wasm' : p
    });
    statusEl.textContent = 'RNNoise: active';
    statusEl.className = 'status status-good';
  } catch (e) {
    statusEl.textContent = 'RNNoise: failed';
    console.error(e);
  }
}
init();

document.getElementById('fileInput').addEventListener('change', async e => {
  if (!RN) return alert('RNNoise not ready');
  const file = e.target.files[0];
  const ac = new AudioContext();
  const buf = await ac.decodeAudioData(await file.arrayBuffer());
  const ch = buf.numberOfChannels;
  const outCh = [];
  for (let c = 0; c < ch; c++) {
    outCh.push(await denoiseChannel(buf.getChannelData(c), buf.sampleRate));
  }
  const wav = encodeWav(outCh, 48000);
  document.getElementById('playerOriginal').src = URL.createObjectURL(file);
  document.getElementById('playerDenoised').src = URL.createObjectURL(new Blob([wav], {type: 'audio/wav'}));
});

async function denoiseChannel(samples, sr) {
  // Resample to 48k
  if (sr !== 48000) {
    const oac = new OfflineAudioContext(1, Math.ceil(samples.length * 48000 / sr), 48000);
    const src = oac.createBuffer(1, samples.length, sr);
    src.copyToChannel(samples, 0);
    const node = oac.createBufferSource();
    node.buffer = src;
    node.connect(oac.destination);
    node.start();
    const rendered = await oac.startRendering();
    samples = rendered.getChannelData(0);
  }
  const frameSize = 480;
  const out = new Float32Array(samples.length);
  const state = RN._rnnoise_create();
  const inPtr = RN._malloc(frameSize * 4);
  const outPtr = RN._malloc(frameSize * 4);
  for (let i = 0; i < samples.length; i += frameSize) {
    const frame = samples.subarray(i, i + frameSize);
    RN.HEAPF32.set(frame, inPtr >> 2);
    RN._rnnoise_process_frame(state, outPtr, inPtr);
    out.set(RN.HEAPF32.subarray(outPtr >> 2, (outPtr >> 2) + frame.length), i);
  }
  RN._rnnoise_destroy(state);
  RN._free(inPtr);
  RN._free(outPtr);
  return out;
}

function encodeWav(channels, sampleRate) {
  const numChannels = channels.length;
  const length = channels[0].length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + length * blockAlign);
  const view = new DataView(buffer);
  function writeString(offset, string) {
    for (let i = 0; i < string.length; i++) view.setUint8(offset + i, string.charCodeAt(i));
  }
  let offset = 0;
  writeString(offset, 'RIFF'); offset += 4;
  view.setUint32(offset, 36 + length * blockAlign, true); offset += 4;
  writeString(offset, 'WAVE'); offset += 4;
  writeString(offset, 'fmt '); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString(offset, 'data'); offset += 4;
  view.setUint32(offset, length * blockAlign, true); offset += 4;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < numChannels; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return buffer;
}
