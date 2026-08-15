# Agent guidance

- Read `VISION.md` and `README.md` before changing product behavior.
- Follow `internal-docs/DESIGN.md` for interface changes.
- Follow `internal-docs/DATA-EVIDENCE.md` and `internal-docs/DECISIONS.md` for data behavior.
- Keep the Manifest V3 extension local-first and limited to `publisher.unity.com`; bundle any dependency locally, never from a CDN.
- Never hardcode publisher IDs, packages, or publisher-specific history dates.
- Keep implementation terminology out of publisher-facing copy.
- Do not bump the extension version unless explicitly requested.
- Do not automate `chrome://extensions`; ask the user to reload the unpacked extension.
- Before finishing, rebuild charts, run `node --check` on every JavaScript file, and validate `manifest.json`.
