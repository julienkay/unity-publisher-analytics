# Agent guidance

This file is the entry point for agent work. Keep detailed knowledge in
`internal-docs/` and use this file to select the required context.

## Start here

- Read `VISION.md` and `internal-docs/README.md` before changing product behavior.
- Read the current source. Then read the routed documents. Documentation records
  evidence and intent. Verify all claims against the code.
- Treat undocumented Unity behavior conservatively. Record missing evidence as
  unknown instead of filling gaps with plausible assumptions.

## Route by task

| Task | Required context |
|---|---|
| Runtime boundaries, storage, sync, or unfamiliar source code | `internal-docs/ARCHITECTURE.md` |
| New or changed Unity endpoint, response shape, metric, or ingestion path | `internal-docs/ARCHITECTURE.md`, `internal-docs/DATA-SOURCE-WORKFLOW.md`, `internal-docs/DATA-EVIDENCE.md`, `internal-docs/DECISIONS.md`, `internal-docs/VALIDATION.md`, and the API fixture guidance |
| API fixture capture or editing | `internal-docs/api-fixtures/AGENTS.md` and `internal-docs/api-fixtures/README.md` |
| Interface or publisher-facing copy | `internal-docs/DESIGN.md` |
| Charts or visualization behavior | `internal-docs/DESIGN.md` and `internal-docs/RENDERING.md` |
| Exported data or schema | `internal-docs/EXPORTS.md` plus the relevant data-trust documents |
| Local setup, scripts, packaging, or release validation | `internal-docs/DEVELOPMENT.md` and `internal-docs/SCRIPTS.md` |

When a change crosses rows, read every applicable document. For a new data
source, follow the complete evidence-to-integration workflow. Do not add only a
request path and parser.

## Product and data boundaries

- Keep the Manifest V3 extension local-first. Limit runtime network access to
  `publisher.unity.com`. Bundle each dependency locally. Never use a CDN.
- Never hardcode publisher IDs, packages, eligibility, or publisher-specific
  history dates.
- Preserve publisher isolation across requests, normalized records, sync state,
  preferences, exports, and clearing behavior.
- Keep implementation terminology out of publisher-facing copy.
- Use ASD-STE100 Simplified Technical English in maintainer documents. Use short
  sentences. Define necessary technical terms. Use one term for one meaning.
- Do not represent inferred or one-account behavior as a Unity contract.
- Do not bump the extension version unless explicitly requested.
- Do not automate `chrome://extensions`. Ask the user to reload the unpacked
  extension.

## Before finishing

- Rebuild the committed chart bundle.
- Run `node --check` on every JavaScript file.
- Validate `manifest.json` with the repository manifest validator.
- Run the change-specific checks listed in `internal-docs/SCRIPTS.md`, including
  fixture and publisher-isolation checks when data behavior is involved.
