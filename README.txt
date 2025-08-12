Cloud AI Denoiser — Comparison Demo (v2)
========================================

What this is
------------
A tiny site to upload one clip and hear 3 AI denoisers side-by-side:
- A: DeepFilterNet
- B: MetricGAN+ / FullSubNet
- C: Demucs / FAIR Denoiser

Two ways to try it
------------------
1) **Instant demo (no keys):** scroll to the iframes and use the public Spaces.
2) **API calls (private endpoints):** put your URLs/keys in `config.js`, then click Run Comparison.

Deploy
------
1) Create a **public GitHub repo** and upload these files to the **root**.
2) Enable **GitHub Pages** → Source: `main`, Folder: `/ (root)`.
3) Visit your Pages URL.

Configure endpoints (optional)
------------------------------
- Hugging Face Inference Endpoint (A/B):
  - Create endpoint(s) from model cards (DeepFilterNet, MetricGAN+, FullSubNet).
  - Ensure they take a `file` and return an audio file.
  - Paste URL/token into `CONFIG.hfA` / `CONFIG.hfB` in `config.js`.
- Replicate (C):
  - Get an API token and the model version hash.
  - Paste into `CONFIG.replicate`.

Notes
-----
- Public Spaces can throttle/queue; private endpoints are faster + more reliable.
- Costs vary; DeepFilterNet endpoints are usually cheapest.
