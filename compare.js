// compare.js — calls 3 cloud endpoints (configurable in config.js)
const fileInput = document.getElementById('fileInput');
const runBtn = document.getElementById('run');
const orig = document.getElementById('orig');
const outA = document.getElementById('outA');
const outB = document.getElementById('outB');
const outC = document.getElementById('outC');
const progress = document.getElementById('progress');
const bar = document.getElementById('bar');
const ptext = document.getElementById('ptext');
const results = document.getElementById('results');

function setProgress(p, text){ progress.classList.remove('hidden'); bar.style.width = Math.max(0,Math.min(100,p))+'%'; if(text) ptext.textContent = text; }
function hideProgress(){ progress.classList.add('hidden'); }

let selectedFile = null;
fileInput.addEventListener('change', e=> { selectedFile = e.target.files?.[0] || null; });

async function callHuggingFaceEndpoint(url, token, file){
  const form = new FormData();
  form.append('file', file, file.name || 'audio.wav');
  const res = await fetch(url, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: form
  });
  if(!res.ok) throw new Error('HF endpoint failed: ' + res.status + ' ' + await res.text());
  const blob = await res.blob();
  return blob;
}

async function callReplicate(version, token, file){
  const uploadRes = await fetch('https://api.replicate.com/v1/files', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: (()=>{ const f=new FormData(); f.append('file', file, file.name||'audio.wav'); return f; })()
  });
  if(!uploadRes.ok) throw new Error('Replicate upload failed: ' + uploadRes.status + ' ' + await uploadRes.text());
  const uploaded = await uploadRes.json();
  const audioUrl = uploaded?.urls?.get || uploaded?.url || uploaded?.serve_url || uploaded?.urls?.serve;
  if(!audioUrl) throw new Error('Replicate did not return a usable file URL.');

  const predRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ version, input: { audio: audioUrl } })
  });
  if(!predRes.ok) throw new Error('Replicate prediction create failed: ' + predRes.status + ' ' + await predRes.text());
  let pred = await predRes.json();

  while (['starting','processing','queued'].includes(pred.status)){
    await new Promise(r=> setTimeout(r, 1500));
    const poll = await fetch(`https://api.replicate.com/v1/predictions/${pred.id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    pred = await poll.json();
  }
  if (pred.status !== 'succeeded') throw new Error('Replicate failed: ' + pred.status + ' ' + (pred.error||''));
  const outUrl = Array.isArray(pred.output) ? pred.output[0] : pred.output;
  const outBlob = await fetch(outUrl).then(r=>r.blob());
  return outBlob;
}

runBtn.addEventListener('click', async ()=>{
  try{
    if(!selectedFile) { alert('Choose an audio file first.'); return; }
    results.classList.add('hidden');
    setProgress(5,'Uploading…');
    const checked = [
      document.getElementById('m1').checked,
      document.getElementById('m2').checked,
      document.getElementById('m3').checked,
    ];

    orig.src = URL.createObjectURL(selectedFile);

    const outputs = [null,null,null];
    let step = 10;

    if (checked[0] && CONFIG.hfA.url){
      setProgress(step+=20,'DeepFilterNet…');
      outputs[0] = await callHuggingFaceEndpoint(CONFIG.hfA.url, CONFIG.hfA.token, selectedFile);
    }

    if (checked[1] && CONFIG.hfB.url){
      setProgress(step+=20,'MetricGAN+/FullSubNet…');
      outputs[1] = await callHuggingFaceEndpoint(CONFIG.hfB.url, CONFIG.hfB.token, selectedFile);
    }

    if (checked[2] && CONFIG.replicate.version && CONFIG.replicate.token){
      setProgress(step+=20,'Demucs/FAIR…');
      outputs[2] = await callReplicate(CONFIG.replicate.version, CONFIG.replicate.token, selectedFile);
    }

    if (outputs[0]) outA.src = URL.createObjectURL(outputs[0]);
    if (outputs[1]) outB.src = URL.createObjectURL(outputs[1]);
    if (outputs[2]) outC.src = URL.createObjectURL(outputs[2]);

    results.classList.remove('hidden');
    setProgress(100,'Done');
    setTimeout(hideProgress, 500);
  }catch(e){
    console.error(e);
    alert('Failed: ' + (e?.message||e));
    hideProgress();
  }
});
