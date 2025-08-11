NEW — Zack's Audio Outpost Noise Reduction (from scratch)
============================================================
This is a clean rebuild that does **mono + true stereo** and requires **no CDN**.
It expects the two RNNoise assets to be served **locally** (same folder as index.html).

YOU MUST ADD (once) BEFORE PUBLISHING
-------------------------------------
Download both files and upload to **the same folder as index.html**:
1) rnnoise.js
   https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist/rnnoise.js
2) rnnoise.wasm
   https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist/rnnoise.wasm

DEPLOY (GITHUB PAGES)
---------------------
1) Create or open your public repo (e.g., noise-reducer).
2) Upload ALL of these to the repo **root**:
   - index.html
   - styles.css
   - app.js
   - logo.svg
   - rnnoise.js        <-- you add this
   - rnnoise.wasm      <-- you add this
   - README.txt
3) Settings → Pages → Source = main, Folder = /(root) → Save
4) Wait ~1–2 minutes, then open https://YOUR-USERNAME.github.io/noise-reducer/

EMBED IN HOSTINGER WEBSITE BUILDER
----------------------------------
Use an HTML/Embed block:
<iframe src="https://YOUR-USERNAME.github.io/noise-reducer/" width="100%" height="900" style="border:0;border-radius:12px;overflow:hidden;" loading="lazy"></iframe>

VERIFY & TROUBLESHOOT
---------------------
- Status badge should read **RNNoise: active** (green).
- If it stays red, you’re missing **rnnoise.js** or **rnnoise.wasm** in the same folder.
- Use a noisy **voice** clip to test (Strong + Wet 100% for clear effect).
- Hard refresh after changes (Cmd/Ctrl + Shift + R).

LICENSE
-------
RNNoise is BSD‑3‑Clause; the Jitsi wasm build is under compatible terms.
