# API fixture guidance

These instructions apply to work under `internal-docs/api-fixtures/`. Read the
repository `AGENTS.md`, this directory's `README.md`, `manifest.json`, and
`request-shapes.json` before editing fixtures.

## Privacy boundary

- Never commit or quote cookies, CSRF values, or session headers. Do not commit
  authorization headers, email addresses, real identities, or unrelated network
  traffic.
- A raw response is an unchanged Portal response. Keep raw responses outside the
  repository. Delete them after the privacy check.
- To sanitize a response means to make a safe evidence copy. Remove secrets and
  replace private values in the authorized page before output when possible. Do
  not send a raw response to an agent.
- Do not retain a general HAR file. Capture only the required request shape and
  parsed JSON response.
- Keep a temporary page-world capture helper behind an explicit opt-in flag.
  Give the helper a narrow read-only request list. Remove the helper and its
  output marker before you finish. The maintainer must reload the extension
  after you add the helper. The maintainer must reload it again after removal.

## Evidence boundary

- A captured fixture must have a provenance sidecar and a manifest entry.
- Preserve key spelling, JSON types, nesting, nulls, signs, and zero states.
  Preserve ordering and relationships that affect semantics. Preserve documented
  boundaries.
- Use stable fictional replacements across related fixtures and update related
  totals together.
- Record every truncation, removed row, shifted date, replaced identifier, and
  transformed value in provenance.
- Use `*.synthetic.json` for invented examples. Synthetic data tests code. It
  does not confirm Unity behavior.
- Mark unavailable account variants and boundary behavior as unknown rather than
  manufacturing representative cases.
- Do not set an evidence status to Confirmed solely because a fixture parses.

## Required companion changes

When adding a captured endpoint or response variant, inspect and normally update:

- `manifest.json`.
- `request-shapes.json`.
- `<fixture>.provenance.json` using `provenance.template.json` as a starting
  structure.
- `../DATA-EVIDENCE.md`.
- `../VALIDATION.md` for remaining variants and boundaries.
- `../../scripts/validate-api-fixtures.js` or another focused validator.

Run `npm run test:fixtures` and the privacy search described in `README.md`
before finishing. Ask for a second privacy review when possible.
