Traffic Max Voice Denoiser — Zack's Audio Outpost
====================================================
This build emphasizes **voice** and fights **traffic**, hiss, room noise, hum (50/60Hz + harmonics), plus a light dereverb.
Works with **mono** and **true stereo**. Everything runs **on‑device**.

Quick start (GitHub Pages)
--------------------------
1) Create a **public** repo and upload these files to the **repo root**:
   - index.html, app.js, styles.css, logo.svg
   - .github/workflows/fetch-rnnoise.yml
2) Commit → **Settings → Pages** → Source: `main`, Folder: `/ (root)` → Save
3) Wait ~1–2 minutes. The workflow will add `rnnoise.js` and `rnnoise.wasm`.
4) Open your Pages URL. Badge should read **RNNoise: active**.

Manual add (skip Actions)
-------------------------
Place these next to index.html:
- https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist/rnnoise.js
- https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist/rnnoise.wasm

Recommended settings for traffic
--------------------------------
- Strength: **Strong**
- Wet/Dry: **100%**
- Traffic mode: **ON**
- Traffic Max: **ON**
- Hum: **60 Hz** (US) or **50 Hz** (EU)

Notes
-----
- Extremely loud traffic is non‑stationary and can’t be fully removed without neural source separation; this stack prioritizes intelligibility and quieter gaps.
- Light dereverb gently ducks the tail between words; it won’t fully remove long, reflective reverb.
