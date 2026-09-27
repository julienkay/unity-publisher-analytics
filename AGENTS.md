# Agent guidance

This file is the entry point for agent work. Keep detailed knowledge in
`internal-docs/` and use this file to select the required context.

## Start here

- Read `VISION.md` and `internal-docs/README.md` before changing product behavior.
- Read the current source. Then read the routed documents. Documentation records
  evidence and intent. Verify all claims against the code.
- Probe undocumented Unity behavior in authorized sessions. Record experimental
  results and evidence limits. Record missing evidence as unknown.
- Use browser CDP for live Unity API tests. Do not modify the extension only to
  test a request.

## Route by task

| Task | Required context |
|---|---|
| Runtime boundaries, storage, sync, or unfamiliar source code | `internal-docs/ARCHITECTURE.md` |
| Live Unity API request or browser investigation | `internal-docs/DATA-SOURCES.md` |
| New or changed Unity endpoint, response shape, metric, or ingestion path | `internal-docs/ARCHITECTURE.md`, `internal-docs/DATA-SOURCES.md`, `internal-docs/DATA-EVIDENCE.md`, `internal-docs/DECISIONS.md`, `internal-docs/VALIDATION.md`, and the API fixture guidance |
| API fixture capture or editing | `internal-docs/api-fixtures/AGENTS.md` and `internal-docs/api-fixtures/README.md` |
| Interface or publisher-facing copy | `internal-docs/DESIGN.md` |
| Charts or visualization behavior | `internal-docs/DESIGN.md` and `internal-docs/RENDERING.md` |
| Exported data or schema | `internal-docs/EXPORTS.md` plus the relevant data-trust documents |
| Local setup, scripts, packaging, or release validation | `internal-docs/DEVELOPMENT.md` and `internal-docs/SCRIPTS.md` |

When a change crosses rows, read every applicable document. For a new data
source, follow the complete evidence-to-integration workflow. Do not add only a
request path and parser.

## Product and data boundaries

- Keep the Manifest V3 extension local-first. Limit API requests to
  `publisher.unity.com`. The only other runtime network access is downloading
  public package icons from `assetstorev1-prd-cdn.unity3d.com`. Bundle each
  dependency locally. Never use a CDN for code or libraries.
- Never hardcode publisher IDs, packages, eligibility, or publisher-specific
  history dates.
- Preserve publisher isolation across requests, normalized records, sync state,
  preferences, exports, and clearing behavior.
- Keep implementation terminology out of publisher-facing copy.
- Use ASD-STE100 Simplified Technical English in maintainer documents. Use short
  sentences. Define necessary technical terms. Use one term for one meaning.
- Do not represent inferred or one-account behavior as a Unity contract.
- Do not bump the extension version unless explicitly requested.
- After finishing work that touched any file in `content-src/`, run `npm run build:content`.
- Do not automate `chrome://extensions`. Ask the user to reload the unpacked
  extension.

## Before finishing

- Keep `CHANGELOG.md` publisher-facing. List changes publishers can see or use;
  keep marketing assets and implementation details in maintainer documents.
- Run the checks that apply to the changed files and behavior. Use the validation
  matrix in `internal-docs/SCRIPTS.md`.
- Run `node --check` on each changed `.js` or `.mjs` file.
- Rebuild the committed chart bundle after a change to its entry point, ECharts
  version, or build configuration.
- Validate the manifests after a change to manifest inputs, generation,
  permissions, or packaging. Validate them before a release.
- Run fixture checks when a change affects API evidence or normalized data.
- Run publisher-isolation checks when a change affects identity, storage, sync,
  preferences, exports, clearing behavior, or package groups.
- Run the complete package validation only for release preparation or packaging
  changes.
