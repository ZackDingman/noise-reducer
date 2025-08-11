// Voice Master Denoiser — from scratch
const STATUS = document.getElementById('status');
const diag = document.getElementById('diag');
function log(s){ if(diag) diag.textContent += s + "\n"; }
function setStatus(ok,msg){ STATUS.className='badge ' + (ok?'good':'bad'); STATUS.textContent='RNNoise: ' + msg; }

const TARGET_SR = 48000;
const FRAME_SIZE = 480;

let RN = null;
async function loadRN(){
  if(RN) return RN;
  try{
    const factory = (await import('./rnnoise.js')).default;
    RN = await factory({ locateFile: (p)=> p.endsWith('.wasm') ? './rnnoise.wasm' : p });
    setStatus(true,'active'); log('[ok] RNNoise ready');
    return RN;
  }catch(e){
    setStatus(false,'failed to load'); log('[err] RNNoise load: ' + (e?.message||e)); throw e;
  }
}

// UI
const el = {
  drop: document.getElementById('drop'),
  input: document.getElementById('fileInput'),
  strength: document.getElementById('strength'),
  wet: document.getElementById('wet'),
  traffic: document.getElementById('traffic'),
  hiss: document.getElementById('hiss'),
  dereverb: document.getElementById('dereverb'),
  hum50: document.getElementById('hum50'),
  hum60: document.getElementById('hum60'),
  orig: document.getElementById('orig'),
  den: document.getElementById('den'),
  dl: document.getElementById('dl'),
  progress: document.getElementById('progress'),
  bar: document.getElementById('bar'),
  ptext: document.getElementById('ptext'),
  preview: document.getElementById('preview'),
};

el.drop.addEventListener('click', ()=> el.input.click());
el.drop.addEventListener('dragover', e=> e.preventDefault());
el.drop.addEventListener('drop', e=> { e.preventDefault(); const f=e.dataTransfer.files?.[0]; if(f) processFile(f); });
el.input.addEventListener('change', e=> { const f=e.target.files?.[0]; if(f) processFile(f); });

function setProgress(p, text){ el.progress.classList.remove('hidden'); el.bar.style.width = Math.max(0,Math.min(100,p))+'%'; if(text) el.ptext.textContent = text; }
function hideProgress(){ el.progress.classList.add('hidden'); }

async function decode(file){
  const ac = new (window.AudioContext||window.webkitAudioContext)();
  const ab = await file.arrayBuffer();
  return await ac.decodeAudioData(ab.slice(0));
}
function splitChannels(buf){
  const n = buf.numberOfChannels;
  if (n<=1){ const a=new Float32Array(buf.length); buf.copyFromChannel(a,0); return {chs:[a], sr:buf.sampleRate}; }
  const L=new Float32Array(buf.length), R=new Float32Array(buf.length);
  buf.copyFromChannel(L,0); buf.copyFromChannel(R,1);
  return {chs:[L,R], sr:buf.sampleRate};
}
async function resample48k(samples, sr){
  if (sr===TARGET_SR) return samples;
  const oac = new OfflineAudioContext(1, Math.ceil(samples.length*TARGET_SR/sr), TARGET_SR);
  const src = oac.createBufferSource(); const b = oac.createBuffer(1, samples.length, sr);
  b.copyToChannel(samples,0); src.buffer=b; src.connect(oac.destination); src.start();
  const out = await oac.startRendering(); const a=new Float32Array(out.length); out.copyFromChannel(a,0); return a;
}

// ===== Filters =====
function biquadNotch(fc, Q, sr){
  const w0 = 2*Math.PI*fc/sr, alpha = Math.sin(w0)/(2*Q);
  const b0=1, b1=-2*Math.cos(w0), b2=1, a0=1+alpha, a1=-2*Math.cos(w0), a2=1-alpha;
  const bz=[b0/a0,b1/a0,b2/a0], az=[1,a1/a0,a2/a0];
  let x1=0,x2=0,y1=0,y2=0;
  return (x)=>{ const y = bz[0]*x + bz[1]*x1 + bz[2]*x2 - az[1]*y1 - az[2]*y2; x2=x1; x1=x; y2=y1; y1=y; return y; };
}
function biquadHighShelf(fc, gainDB, sr){
  const A = Math.pow(10,gainDB/40), w0=2*Math.PI*fc/sr, alpha=Math.sin(w0)/Math.SQRT2, cos=Math.cos(w0);
  const b0 = A*((A+1)+(A-1)*cos+2*Math.sqrt(A)*alpha);
  const b1 = -2*A*((A-1)+(A+1)*cos);
  const b2 = A*((A+1)+(A-1)*cos-2*Math.sqrt(A)*alpha);
  const a0 = (A+1)-(A-1)*cos+2*Math.sqrt(A)*alpha;
  const a1 = 2*((A-1)-(A+1)*cos);
  const a2 = (A+1)-(A-1)*cos-2*Math.sqrt(A)*alpha;
  const bz=[b0/a0,b1/a0,b2/a0], az=[1,a1/a0,a2/a0];
  let x1=0,x2=0,y1=0,y2=0;
  return (x)=>{ const y=bz[0]*x+bz[1]*x1+bz[2]*x2-az[1]*y1-az[2]*y2; x2=x1;x1=x;y2=y1;y1=y; return y; };
}
function onePoleHP(fc, sr){
  const a = Math.exp(-2*Math.PI*fc/sr);
  let px=0, py=0;
  return (x)=>{ const y=a*(py + x - px); px=x; py=y; return y; };
}

// VAD-guided ducking
function duckSample(x, vad, amtDb){
  const att = (vad<0.5) ? Math.pow(10, amtDb/20) : 1.0;
  return x*att;
}

// Core denoise per channel
async function processChannel(x, opts, rn){
  if (rn._rnnoise_init) rn._rnnoise_init();
  const frames = Math.ceil(x.length/FRAME_SIZE);
  const y = new Float32Array(frames*FRAME_SIZE);

  const state = rn._rnnoise_create();
  const inPtr = rn._malloc(FRAME_SIZE*4);
  const outPtr= rn._malloc(FRAME_SIZE*4);

  // Build filters based on toggles
  const hp = opts.traffic ? onePoleHP(120, TARGET_SR) : (v=>v);
  const hissShelf = opts.hiss ? biquadHighShelf(8000, -8, TARGET_SR) : (v=>v);

  const hums = [];
  if (opts.hum60){ [60,120,180,240].forEach(f=> hums.push(biquadNotch(f, 30, TARGET_SR))); }
  if (opts.hum50){ [50,100,150,200].forEach(f=> hums.push(biquadNotch(f, 30, TARGET_SR))); }

  const passes = opts.traffic ? (opts.strength===2 ? 3 : 2) : (opts.strength===2 ? 2 : 1);
  const mix = Math.max(0, Math.min(1, opts.wet));

  let diff=0, cnt=0;

  for(let i=0;i<frames;i++){
    const start = i*FRAME_SIZE;
    const dryFrame = x.subarray(start, Math.min(start+FRAME_SIZE, x.length));
    const frame = new Float32Array(FRAME_SIZE);
    frame.set(dryFrame);
    rn.HEAPF32.set(frame, inPtr>>2);

    let vad = 1.0;
    for (let p=0;p<passes;p++){
      vad = rn._rnnoise_process_frame(state, outPtr, inPtr) || vad;
      if (p<passes-1){
        const outView = rn.HEAPF32.subarray(outPtr>>2, (outPtr>>2)+FRAME_SIZE);
        rn.HEAPF32.set(outView, inPtr>>2);
      }
    }
    const den = rn.HEAPF32.subarray(outPtr>>2, (outPtr>>2)+FRAME_SIZE);

    // Post treatment
    for(let j=0;j<FRAME_SIZE;j++){
      let s = den[j] || 0;
      s = hp(s);
      for (const notch of hums) s = notch(s);
      s = hissShelf(s);
      if (opts.dereverb) s = duckSample(s, vad, -9); // duck when no speech

      const dry = frame[j] || 0;
      const mixed = dry*(1-mix) + s*mix;
      y[start+j] = mixed;

      const d = mixed - dry; diff += d*d; cnt++;
    }
  }
  rn._rnnoise_destroy(state); rn._free(inPtr); rn._free(outPtr);
  const rms = Math.sqrt(diff/Math.max(1,cnt)); log(`[diag] RMS diff: ${rms.toFixed(6)} (passes=${passes})`);
  return y.subarray(0, x.length);
}

function encodeWav(chs){
  const nCh=chs.length, n=chs[0].length, bps=2, align=nCh*bps, rate=TARGET_SR*align, size=n*align;
  const buf=new ArrayBuffer(44+size), v=new DataView(buf);
  function w(o,s){ for(let i=0;i<s.length;i++) v.setUint8(o+i,s.charCodeAt(i)); }
  w(0,'RIFF'); v.setUint32(4,36+size,true); w(8,'WAVE'); w(12,'fmt '); v.setUint32(16,16,true);
  v.setUint16(20,1,true); v.setUint16(22,nCh,true); v.setUint32(24,TARGET_SR,true);
  v.setUint32(28,rate,true); v.setUint16(32,align,true); v.setUint16(34,16,true);
  w(36,'data'); v.setUint32(40,size,true);
  let off=44; for(let i=0;i<n;i++){ for(let c=0;c<nCh;c++){ const s=Math.max(-1,Math.min(1,chs[c][i])); v.setInt16(off, s<0? s*0x8000 : s*0x7fff, true); off+=2; } }
  return buf;
}

async function processFile(file){
  try{
    el.preview.classList.add('hidden'); diag.textContent='';
    setProgress(10,'Decoding…');
    const base = file.name.replace(/\.[^.]+$/,'');
    const buf = await decode(file);
    const {chs,sr} = splitChannels(buf);
    setProgress(25,'Resampling…');
    const res=[]; for(let i=0;i<chs.length;i++) res.push(await resample48k(chs[i], sr));
    const rn = await loadRN();

    const opts = {
      strength: parseInt(el.strength.value,10)||1,
      wet: (parseInt(el.wet.value,10)||85)/100,
      traffic: el.traffic.checked,
      hiss: el.hiss.checked,
      dereverb: el.dereverb.checked,
      hum50: el.hum50.checked,
      hum60: el.hum60.checked,
    };

    setProgress(50, res.length===2?'Cleaning (L)…':'Cleaning…');
    const out=[];
    out.push(await processChannel(res[0], opts, rn));
    if (res.length===2){ setProgress(75,'Cleaning (R)…'); out.push(await processChannel(res[1], opts, rn)); }

    setProgress(92,'Encoding WAV…');
    const origURL = URL.createObjectURL(new Blob([encodeWav(res)], {type:'audio/wav'}));
    const denURL  = URL.createObjectURL(new Blob([encodeWav(out)], {type:'audio/wav'}));
    el.orig.src = origURL; el.den.src = denURL; el.dl.href = denURL; el.dl.download = base + "_cleaned.wav";
    el.preview.classList.remove('hidden'); hideProgress();
  }catch(e){ log('[err] ' + (e?.message||e)); alert('Sorry, that failed. See Diagnostics.'); hideProgress(); }
}

// Preload RNNoise so badge turns green
loadRN().catch(()=>{});
