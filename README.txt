Zack's Audio Outpost — Voice Master Denoiser (Fresh Start)
==============================================================

Purpose
-------
A **voice‑focused** web denoiser that targets: traffic rumble, hiss, room/ambient noise, hum (50/60Hz + harmonics), and light dereverb. Works with **mono and true stereo**. All processing is **local** in your browser.

What’s inside
-------------
- RNNoise (WASM) multi‑pass voice denoise
- Traffic mode: high‑pass + multi‑pass + VAD‑guided ducking between words
- Hiss tamer: high‑shelf cut above 8 kHz
- Hum removal: 50/60Hz notches + 2–3 harmonics
- Light dereverb: VAD‑guided background ducking (subtle)

Install (GitHub Pages)
----------------------
1) Create a **public** repo and upload these files to the repo **root**:
   - index.html, app.js, styles.css, logo.svg
   - .github/workflows/fetch-rnnoise.yml
2) Commit, then visit **Settings → Pages** and set Source: `main`, Folder: `/ (root)`.
3) Wait ~1–2 minutes. The workflow will add `rnnoise.js` and `rnnoise.wasm` to your repo.
4) Open your Pages URL. The badge should show **RNNoise: active**.

Manual (local test)
-------------------
If you prefer manual, download these next to index.html:
- https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist/rnnoise.js
- https://cdn.jsdelivr.net/npm/@jitsi/rnnoise-wasm@0.2.0/dist/rnnoise.wasm

Tips
----
- For heavy traffic: **Strength = Strong**, **Wet = 100%**, **Traffic mode ON**, **Hum 60 ON** (US) or **Hum 50 ON** (EU).
- For music/ambience: try **Light** and lower Wet (50–70%) to avoid artifacts.
- Dereverb here is *light*; real dereverb requires specialized models.

License
-------
RNNoise (BSD‑3‑Clause by Xiph/Jitsi). This wrapper code is MIT.
