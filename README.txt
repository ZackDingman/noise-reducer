Zack's Audio Outpost — Noise Reducer (Local WASM, True Stereo)
=================================================================

This build supports BOTH mono and true stereo. Each channel is resampled to 48 kHz
and denoised independently via RNNoise, then re-encoded as mono or stereo WAV
to match the input (1 or 2 channels).

REQUIRED FILE BEFORE PUBLISHING
-------------------------------
Download rnnoise.wasm and place it NEXT TO index.html:
https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist/rnnoise.wasm
Filename must be exactly: rnnoise.wasm

GITHUB PAGES DEPLOY
-------------------
1) Create a PUBLIC repo (noise-reducer) on GitHub.
2) Upload ALL files to the repo ROOT:
   - index.html
   - styles.css
   - app.js
   - logo.svg
   - rnnoise.wasm  <-- add this file you downloaded
   - README.txt
3) Settings → Pages → Source: main, Folder: /(root) → Save
4) Wait 1–2 minutes: https://YOUR-USERNAME.github.io/noise-reducer/

EMBED IN HOSTINGER WEBSITE BUILDER
----------------------------------
Use an HTML/Embed block:
<iframe src="https://YOUR-USERNAME.github.io/noise-reducer/" width="100%" height="900" style="border:0;border-radius:12px;overflow:hidden;" loading="lazy"></iframe>

VERIFY PROCESSING
-----------------
Open DevTools Console. You should see:
- [RNNoise] Loading rnnoise.js from CDN…
- [RNNoise] Module initialized with local rnnoise.wasm
Drop a stereo file: progress will show L then R denoising.
For best audible results, test with noisy VO (fan/room tone).

NOTES
-----
- RNNoise is speech-focused; on music, use 'Light' to avoid artifacts.
- If you need >2 channels, the current build uses the first two (L/R).

LICENSE
-------
RNNoise (BSD-3-Clause); Jitsi WASM build under compatible terms.
