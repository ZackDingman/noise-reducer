Zack's Audio Outpost — Noise Reducer (Stereo, Wet/Dry, Local WASM) — v2
=============================================================================
WHAT'S NEW
- True stereo per-channel denoise (L/R processed separately)
- Proper WET/DRY mix (not just gain scaling)
- RNNoise status badge shows whether the WASM module is loaded
- Extra console logs for debugging

REQUIRED BEFORE PUBLISHING
1) Download rnnoise.wasm and place it NEXT TO index.html:
   https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist/rnnoise.wasm
   (Filename must be exactly rnnoise.wasm)

GITHUB PAGES
1) Create a PUBLIC repo (noise-reducer) or open your existing one.
2) Upload ALL files to the repo ROOT:
   - index.html
   - styles.css
   - app.js
   - logo.svg
   - rnnoise.wasm   <-- add this
   - README.txt
3) Settings → Pages → Source: main, Folder: /(root) → Save
4) Wait 1–2 minutes, then open https://YOUR-USERNAME.github.io/noise-reducer/

VERIFY
- The top-right badge should say: RNNoise: active (green).
- Console logs should show the module initializing.
- Try a noisy VO; adjust Strength + Wet to taste.

EMBED IN HOSTINGER WEBSITE BUILDER
<iframe src="https://YOUR-USERNAME.github.io/noise-reducer/" width="100%" height="900" style="border:0;border-radius:12px;overflow:hidden;" loading="lazy"></iframe>

TROUBLESHOOT
- Badge stays red: rnnoise.wasm missing or not found (check Network tab for 404).
- No audible change: increase Wet to 100%, Strength to Strong, test with a noisy voice file.
- Browser cache: hard refresh (Cmd/Ctrl+Shift+R).
