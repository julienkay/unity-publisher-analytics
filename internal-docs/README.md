# Maintainer documentation

These documents describe implementation decisions, evidence, risks, and
validation for maintainers. They are not user-facing product documentation.

Start with the task router in [`AGENTS.md`](../AGENTS.md). It identifies which
documents are required for a given type of change.

## Architecture and workflows

- [ARCHITECTURE.md](ARCHITECTURE.md) maps runtime contexts, request and storage
  boundaries, sync ownership, and the files that usually change together.
- [DATA-SOURCE-WORKFLOW.md](DATA-SOURCE-WORKFLOW.md) defines the investigation,
  evidence, fixture, implementation, and validation path for undocumented Unity
  data sources.
- [DEVELOPMENT.md](DEVELOPMENT.md) covers local setup, validation, chart builds,
  and Chrome and Firefox packaging.
- [SCRIPTS.md](SCRIPTS.md) documents every repository script, its prerequisites,
  inputs, outputs, and commands.

## Product and interface

- [DESIGN.md](DESIGN.md) defines the shared interface system.
- [RENDERING.md](RENDERING.md) records the visualization architecture.
- [EXPORTS.md](EXPORTS.md) documents the JSON export schema and record types. It
  also documents privacy limits, coverage limits, and CSV availability.

## Data trust

- [DATA-EVIDENCE.md](DATA-EVIDENCE.md) inventories Unity's undocumented
  endpoints and fields. It also records metric semantics, sync behavior,
  publisher isolation, and category mapping.
- [DECISIONS.md](DECISIONS.md) records which data policies are accepted, provisional, or unresolved.
- [VALIDATION.md](VALIDATION.md) separates manually validated behavior from prototype assumptions, shortcuts, known issues, and next work.
- [api-fixtures](api-fixtures/README.md) contains safe copies of captured API
  responses from one account. It also contains request shapes, origin records,
  and the remaining evidence gaps.
  Read its local `AGENTS.md` before adding or changing fixture material.

## Terms

The maintainer documents use these terms:

- A **captured fixture** is a JSON example that comes from a real Portal
  response.
- To **sanitize** a captured fixture means to make a safe evidence copy. Remove
  secrets. Replace private identities and values. Keep only the structure and
  relationships that the evidence needs. Record every change.
- A **raw response** is the unchanged Portal response. Never put a raw response
  in the repository or in an agent message.
- A **synthetic fixture** is invented test data. It can test code, but it cannot
  confirm Unity behavior.
- A **provenance file** records where a fixture came from, what changed, and what
  the fixture can and cannot prove.

Sanitization changes only the evidence copy. It does not change the publisher's
live data, stored data, charts, exports, or marketing screenshots.

## Evidence standard

Data claims use four labels:

- **Confirmed:** A retained fixture, an exact Portal export, or a reproducible
  check supports the claim.
- **Observed once:** The original development task or its publisher account
  showed the behavior. No captured fixture retains the behavior.
- **Inferred:** Code, names, or aggregate behavior support this interpretation.
  A documented Unity contract does not verify it.
- **Unknown:** not tested or not recoverable from the repository and task history.

Do not promote a claim to **Confirmed** without evidence or a reproducible
procedure. Unity can change undocumented behavior without notice.
