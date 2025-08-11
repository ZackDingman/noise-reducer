Zack's Audio Outpost — Noise Reducer (Mono + True Stereo, Local WASM)
========================================================================
WHAT THIS IS
- In-browser noise reduction powered by RNNoise (WASM)
- Supports mono AND true stereo (L/R processed independently)
- Wet/Dry control + Strength (Light/Normal/Strong)
- RNNoise status badge shows if the module is active

REQUIRED BEFORE PUBLISHING
1) Download rnnoise.wasm and place it NEXT TO index.html (repo root):
   https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist/rnnoise.wasm
   (Filename must be exactly rnnoise.wasm)

GITHUB PAGES
1) Create a PUBLIC repo (e.g., noise-reducer) or open your existing one.
2) Upload ALL files to the repo ROOT:
   - index.html
   - styles.css
   - app.js
   - logo.svg
   - rnnoise.wasm   <-- add this one you downloaded
   - README.txt
3) Settings → Pages → Source: main, Folder: /(root) → Save
4) Wait 1–2 minutes, then open https://YOUR-USERNAME.github.io/noise-reducer/

EMBED IN HOSTINGER WEBSITE BUILDER
<iframe src="https://YOUR-USERNAME.github.io/noise-reducer/" width="100%" height="900" style="border:0;border-radius:12px;overflow:hidden;" loading="lazy"></iframe>

VERIFY
- Badge turns green: RNNoise: active
- Console logs show module initialization
- For voice: Strong + Wet 100%; For music/ambience: Light + Wet 50–70%

TROUBLESHOOT
- If badge stays red: rnnoise.wasm missing or 404 (check Network tab).
- Hard refresh after changes (Cmd/Ctrl+Shift+R).
