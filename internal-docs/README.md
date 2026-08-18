# Maintainer documentation

These documents describe implementation decisions, evidence, risks, and validation for maintainers. They are not user-facing product documentation.

## Product and interface

- [DESIGN.md](DESIGN.md) defines the shared interface system.
- [RENDERING.md](RENDERING.md) records the visualization architecture.
- [DEVELOPMENT.md](DEVELOPMENT.md) covers local setup, validation, chart builds, and Chrome and Firefox packaging.
- [SCRIPTS.md](SCRIPTS.md) documents every repository script, its prerequisites, inputs, outputs, and commands.

## Data trust

- [DATA-EVIDENCE.md](DATA-EVIDENCE.md) inventories Unity's undocumented endpoints, observed and defensive fields, metric semantics, sync behavior, publisher isolation, and category mapping.
- [DECISIONS.md](DECISIONS.md) records which data policies are accepted, provisional, or unresolved.
- [VALIDATION.md](VALIDATION.md) separates manually validated behavior from prototype assumptions, shortcuts, known issues, and next work.
- [api-fixtures](api-fixtures/README.md) tracks request shapes and the missing sanitized response-fixture coverage.

## Evidence standard

Data claims use four labels:

- **Confirmed:** supported by a retained fixture, an exact portal export, or a reproducible boundary/reconciliation check.
- **Observed once:** seen working in the original development session or on its publisher account, but not retained as a sanitized raw fixture.
- **Inferred:** the best interpretation of code, names, or aggregate behavior; not verified against a documented Unity contract.
- **Unknown:** not tested or not recoverable from the repository and session history.

Do not promote a claim to **Confirmed** without adding the evidence or a reproducible procedure. Undocumented Unity behavior can change without notice.
