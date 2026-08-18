# Data decision log

This log makes data policies reviewable. “Provisional” means the code uses the policy today but the evidence is insufficient to treat it as a Unity contract. “Open” means the current behavior is unsafe or underspecified and needs a product/engineering decision.

## D-001 — Use the Publisher Portal as the single source

- **Status:** Accepted for the prototype.
- **Current behavior:** The extension uses only the signed-in Publisher Portal endpoints and keeps normalized records locally.
- **Basis:** The original session explicitly chose to trust one source and avoid fallback complexity. The source provides the daily, monthly, ledger, catalog, and category data required by the initial product.
- **Consequence:** No CSV fallback or hosted ingestion path will mask API breakage. Endpoint changes should fail visibly.
- **Review trigger:** Unity removes required fields, retention proves insufficient, or the portal and API cannot be reconciled.

## D-002 — Accept broad field aliases

- **Status:** Provisional.
- **Current behavior:** `valueFrom()` normalizes case and punctuation and accepts many snake-case, camelCase, and semantic aliases.
- **Basis:** Defensive implementation during rapid reverse engineering; no fixture suite exists.
- **Risk:** A semantically different field may be accepted silently, and maintainers cannot tell compatibility evidence from guesses.
- **Target decision:** Keep only a fixture-backed canonical field plus fixture-backed variants. Unknown shapes should produce a diagnostic error rather than silently become zero.

## D-003 — Start daily history no earlier than 2019-01-01

- **Status:** Provisional and unsupported.
- **Current behavior:** The earliest package publication or ledger date is clamped to `2019-01-01`.
- **Basis:** The constant existed in the initial commit; no provenance was recorded.
- **Risk:** Older retained publisher history is silently excluded.
- **Target decision:** Discover the retention boundary empirically per account or document a verified Unity boundary. Until then, describe the result as “history available since the attempted boundary,” not inherently complete history.

## D-004 — Treat two days ago as the newest complete daily date

- **Status:** Provisional.
- **Current behavior:** Today and yesterday are excluded from daily sync.
- **Basis:** Safety heuristic from the initial implementation; no revision study was recorded.
- **Risk:** The dashboard is less fresh than necessary or still includes data Unity later revises.
- **Target decision:** Measure recent-day stability, choose a documented lag, and show the actual coverage-through date in the interface.

## D-005 — Request daily data in 365-day windows

- **Status:** Provisional, observed on one account.
- **Current behavior:** Full and incremental daily sync use annual half-open windows.
- **Basis:** Commit `435c4eb` enlarged the original 60-day window to reduce calls. No benchmark or limit test was retained.
- **Risk:** Large scopes or server changes may time out, be rate-limited, or return silently incomplete data.
- **Target decision:** Validate across catalog sizes and add adaptive retry by splitting a failed window. Splitting is transport resilience, not an alternate data source.

## D-006 — Treat daily `end_date` as exclusive

- **Status:** Provisional.
- **Current behavior:** Adjacent windows share a boundary cursor, and the UI labels the end as one day earlier.
- **Basis:** Working loop behavior and conventional API range design, but no retained boundary test.
- **Risk:** If Unity uses inclusive ends, boundaries overlap; if another interpretation applies, days may be skipped.
- **Target decision:** Confirm with paired requests around a known active date and retain the sanitized fixtures.

## D-007 — Refresh only one overlapping daily date

- **Status:** Provisional.
- **Current behavior:** Incremental sync starts at each scope's latest stored daily date. Only that date is deliberately re-fetched; only the current monthly sales/download reports are refreshed.
- **Basis:** Simple idempotent refresh behavior; no Unity revision study.
- **Risk:** Corrections older than one day or outside the current month remain stale.
- **Target decision:** Measure revision depth, then use a documented rolling overlap. Persist the last successful coverage range separately from the latest returned record.

## D-008 — Include paid units and free claims in conversion

- **Status:** Accepted, with a verification task.
- **Current behavior:** `(paid sales + free claims) / pageviews`, capped at 100%.
- **Basis:** The original portal analytics CSV showed a free asset with 242 sales quantity, 598 pageviews, and 40.47% conversion; the arithmetic exactly includes free claims.
- **Risk:** Daily endpoint semantics or Unity's aggregation rules may differ from the export; the 100% cap is extension-defined.
- **Review trigger:** Fixture reconciliation shows different portal behavior. If kept, label the numerator as purchases and claims rather than paid conversion.

## D-009 — Interpret wishlist as net change

- **Status:** Accepted for aggregate display; daily reconciliation pending.
- **Current behavior:** Daily wishlist values are summed and may reduce a period total.
- **Basis:** The original analytics CSV contained `Wishlisted = -1`, proving the portal metric can be negative.
- **Risk:** Daily values have not been reconciled to the export and may represent a different window or event rule.

## D-010 — Format every monetary value as USD

- **Status:** Provisional and unsafe beyond the original account.
- **Current behavior:** Normalized sales, ledger, and daily records are stamped USD; formatting is fixed to USD.
- **Basis:** Dollar-denominated CSV exports from the original publisher account. No API currency field or platform-wide contract was retained.
- **Risk:** Incorrect presentation or aggregation for publishers settled or reported in another currency.
- **Target decision:** Read and persist a verified reporting currency. If Unity guarantees USD, retain authoritative evidence. Never aggregate different currencies without conversion semantics.

## D-011 — Isolate local workspaces by Asset Store publisher ID

- **Status:** Accepted; multi-account validation remains required.
- **Current behavior:** `publisherId` from the Portal user response is required before local data is loaded. Records, sync checkpoints, display metadata, and preferences are publisher-scoped. An identity change replaces the visible workspace without clearing the previous publisher. Missing identity fails closed. Clearing data affects only the active publisher's analytics and checkpoint, not preferences.
- **Basis:** The official production Portal bundle maps `publisherId` separately from `publisherOrgId`/`defaultOrgId` and uses `publisherId` for the Asset Store publisher profile. Analytics and packages belong to that publisher profile, so it is the appropriate ownership boundary.
- **Consequence:** A publisher can exist within an organization without coupling analytics ownership to the organization's lifecycle or selection. Every write batch rechecks the active publisher before committing. Future durable data such as package groups must use the same publisher boundary and remain outside analytics clearing.
- **Migration:** None. This is unreleased development software, and old unscoped records cannot be assigned safely; the IndexedDB v2 upgrade discards them. Legacy global preference keys are ignored.
- **Review trigger:** A live second-account test shows that `publisherId` changes unexpectedly, collides, or does not follow the active Asset Store publisher.

## D-012 — Define “complete history” as successful request loops

- **Status:** Open, priority P0.
- **Current behavior:** Completion is set after all scheduled loops return without throwing.
- **Basis:** Prototype progress/resume design.
- **Risk:** Silent omissions, zero-day ambiguity, missing scopes, partial months, and cross-publisher data can still receive a trustworthy-looking complete state.
- **Target decision:** Completion must assert publisher ownership, expected scope coverage, request ranges, response shape validity, and known gap semantics. Add monthly/daily reconciliation checks and communicate partial periods.

## D-013 — Handle catalog changes only through current discovery

- **Status:** Open, priority P1.
- **Current behavior:** Incremental sync skips packages with no prior daily row, stops refreshing removed packages, and applies current names/categories only to newly written rows.
- **Basis:** No lifecycle policy was recorded.
- **Risk:** New packages are absent; renames can duplicate records; historical category attribution becomes inconsistent; corrections are missed.
- **Target decision:** Maintain a publisher-scoped package identity table with aliases and lifecycle dates. Bootstrap new packages, preserve unpublished history, define rename/category behavior, and use a deliberate correction window.

## D-014 — Match category metadata through several identifiers and names

- **Status:** Provisional.
- **Current behavior:** Prefer identifier matches across several candidate fields, then fall back to a case-normalized exact package name. Accept scalar or nested category assignments.
- **Basis:** The original account required a nested live `category` assignment after simpler ID mapping failed.
- **Risk:** Ambiguous names, multiple package versions, and ID namespaces can misclassify assets.
- **Target decision:** Retain the live response variants as fixtures, establish identifier precedence, and surface unresolved or conflicting mappings instead of silently choosing the last row.

## D-015 — Define reusable package groups by package ID

- **Status:** Accepted for the local workspace.
- **Current behavior:** One Performance Asset group menu contains the built-in "All assets" group, saved groups, individual assets, and one visually separated Manage groups action. The action opens dedicated pages where publishers can create, rename, change membership, and delete groups. Groups are stored under a publisher-scoped local extension-storage key and contain a generated group ID, a unique display name, and a deduplicated list of Unity `package_id` strings. "All assets" is built in and is not stored or editable.
- **Selection rule:** Performance accepts multiple scopes at once: the built-in catalog group, saved groups, and individual assets. Each scope renders as one line; saved-group lines aggregate their member packages. Selecting the first non-default scope replaces the initial All assets selection, after which All assets can be explicitly added again. If a package belongs to more than one selected scope, it remains in every matching line and an overlap notice appears inside the open selector.
- **Input policy:** Names are trimmed, limited to 40 characters, case-insensitively unique, and cannot use "All assets." Empty groups and exact membership duplicates are rejected. Missing or currently unavailable package IDs remain in an edited group so temporary catalog/API changes do not silently destroy configuration.
- **Clear-data policy:** Analytics clearing removes records and the sync checkpoint only. Package groups and preferences remain intact.
- **Basis:** `package_id` is the strongest observed package identity used by package discovery and per-package reporting. Names are presentation data and may change.
- **Review trigger:** Fixtures show that `package_id` changes across package lifecycle events or uses incompatible namespaces across endpoints.
