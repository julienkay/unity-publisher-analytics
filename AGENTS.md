# Agent guidance

- Read `VISION.md` and `README.md` before changing product behavior.
- Keep the Manifest V3 extension local-first and limited to `publisher.unity.com`; bundle any dependency locally, never from a CDN.
- Never hardcode publisher IDs, packages, or publisher-specific history dates.
- Keep implementation terminology out of publisher-facing copy.
- Do not bump the extension version unless explicitly requested.
- Before finishing, rebuild charts, run `node --check` on every JavaScript file, and validate `manifest.json`.
