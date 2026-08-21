# Data decision log

This log makes data policies reviewable. **Provisional** means that current code
uses a policy without sufficient contract evidence. **Open** means that current
behavior is unsafe or incomplete. It requires a product or engineering decision.

## D-001 — Use the Publisher Portal as the single source

- **Status:** Accepted for the prototype.
- **Current behavior:** The extension uses only the signed-in Publisher Portal endpoints and keeps normalized records locally.
- **Basis:** The original development task selected one trusted source to avoid
  fallback complexity. This source provides the daily, monthly, ledger, catalog,
  and category data that the initial product requires.
- **Consequence:** No CSV fallback or hosted ingestion path will mask API breakage. Endpoint changes should fail visibly.
- **Review trigger:** Unity removes required fields, retention proves insufficient, or the portal and API cannot be reconciled.

## D-002 — Accept broad field aliases

- **Status:** Provisional.
- **Current behavior:** `valueFrom()` normalizes case and punctuation and accepts many snake-case, camelCase, and semantic aliases.
- **Basis:** Defensive implementation during rapid reverse engineering. A one-account canonical fixture set now exists, but most accepted aliases still have no retained variant evidence.
- **Risk:** A semantically different field may be accepted silently, and maintainers cannot tell compatibility evidence from guesses.
- **Target decision:** Keep only a fixture-backed canonical field plus fixture-backed variants. Unknown shapes should produce a diagnostic error rather than silently become zero.

## D-003 — Start daily history no earlier than 2019-01-01

- **Status:** Provisional and unsupported.
- **Current behavior:** The extension compares the earliest `first_published_at` package date with the earliest ledger date. It uses the earlier date as the full-history start date and clamps that date to `2019-01-01`.
- **Basis:** The constant existed in the initial commit. No provenance was
  recorded.
- **Risk:** Older retained publisher history is silently excluded.
- **Target decision:** Discover the retention boundary empirically per account or document a verified Unity boundary. Until then, describe the result as “history available since the attempted boundary,” not inherently complete history.

## D-004 — Treat two days ago as the newest complete daily date

- **Status:** Provisional.
- **Current behavior:** Today and yesterday are excluded from daily sync.
- **Basis:** This was a safety heuristic in the initial implementation. No
  revision study was recorded.
- **Risk:** The dashboard is less fresh than necessary or still includes data Unity later revises.
- **Target decision:** Measure recent-day stability, choose a documented lag, and show the actual coverage-through date in the interface.

## D-005 — Request daily data in 365-day windows

- **Status:** Provisional, observed on one account.
- **Current behavior:** Full and incremental daily sync use annual half-open windows.
- **Basis:** Commit `435c4eb` enlarged the original 60-day window to reduce calls. No benchmark or limit test was retained.
- **Risk:** Large scopes or server changes may time out, be rate-limited, or return silently incomplete data.
- **Target decision:** Validate across catalog sizes and add adaptive retry by splitting a failed window. Splitting is transport resilience, not an alternate data source.

## D-006 — Treat daily `end_date` as exclusive

- **Status:** Provisional, supported by one full-month fixture.
- **Current behavior:** Adjacent windows share a boundary cursor, and the UI labels the end as one day earlier.
- **Basis:** Retained catalog and package month responses include `start_date` through `end_date - 1` and exclude `end_date`. The stricter paired boundary suite is not yet retained.
- **Risk:** Boundaries overlap if Unity uses inclusive end dates. Another
  interpretation could cause skipped days.
- **Target decision:** Confirm with paired requests around a known active date. Retain safe captured fixtures for the requests.

## D-007 — Refresh only one overlapping daily date

- **Status:** Provisional.
- **Current behavior:** Incremental sync starts at each scope's latest stored
  daily date. It deliberately requests only that daily date again. It refreshes
  only the current monthly sales and download reports.
- **Basis:** This provides simple idempotent refresh behavior. No Unity revision
  study exists.
- **Risk:** Corrections older than one day or outside the current month remain stale.
- **Target decision:** Measure revision depth, then use a documented rolling overlap. Persist the last successful coverage range separately from the latest returned record.

## D-008 — Include paid units and free claims in conversion

- **Status:** Accepted, with a verification task.
- **Current behavior:** `(paid sales + free claims) / pageviews`, capped at 100%.
- **Basis:** The original Portal analytics CSV showed a free asset with 242 sales
  and 598 pageviews. Its conversion was 40.47%. This calculation includes free
  claims exactly.
- **Risk:** Daily endpoint semantics or Unity's aggregation rules can differ from
  the export. The extension defines the 100% limit.
- **Review trigger:** Fixture reconciliation shows different portal behavior. If kept, label the numerator as purchases and claims rather than paid conversion.

## D-009 — Interpret wishlist as net change

- **Status:** Accepted for aggregate display. Daily reconciliation is pending.
- **Current behavior:** Daily wishlist values are summed and may reduce a period total.
- **Basis:** The original analytics CSV contained `Wishlisted = -1`, proving the portal metric can be negative.
- **Risk:** Daily values have not been reconciled to the export and may represent a different window or event rule.

## D-010 — Format every monetary value as USD

- **Status:** Provisional and unsafe beyond the original account.
- **Current behavior:** Normalized sales, ledger, and daily records use USD. All
  monetary formatting also uses USD.
- **Basis:** Dollar-denominated CSV exports from the original publisher account. No API currency field or platform-wide contract was retained.
- **Risk:** Incorrect presentation or aggregation for publishers settled or reported in another currency.
- **Target decision:** Read and persist a verified reporting currency. If Unity guarantees USD, retain authoritative evidence. Never aggregate different currencies without conversion semantics.

## D-011 — Isolate local workspaces by Asset Store publisher ID

- **Status:** Accepted. Multi-account validation remains required.
- **Current behavior:** The extension requires `publisherId` from the Portal user
  response before it loads local data. Records, sync checkpoints, display
  metadata, and preferences are publisher-scoped. An identity change replaces
  the visible workspace. It does not clear the previous publisher. A missing
  identity fails closed. Data clearing affects only the active publisher's
  analytics and checkpoint. It does not clear preferences.
- **Basis:** The production Portal bundle separates `publisherId` from
  `publisherOrgId` and `defaultOrgId`. It uses `publisherId` for the Asset Store
  publisher profile. Analytics and packages belong to that publisher profile.
  Thus, `publisherId` is the appropriate ownership boundary.
- **Consequence:** A publisher can belong to an organization without using its
  lifecycle or selection for analytics ownership. Each write batch checks the
  active publisher before it commits data. Future durable data must use the
  same publisher boundary. Package groups are an example. This data must remain
  outside analytics clearing.
- **Migration:** None. This is unreleased development software. The extension
  cannot safely assign old unscoped records. The IndexedDB v2 upgrade discards
  them. It also ignores legacy global preference keys.
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
- **Risk:** New packages are absent. Renames can duplicate records. Historical
  category attribution becomes inconsistent. The sync also misses corrections.
- **Target decision:** Maintain a publisher-scoped package identity table with aliases and lifecycle dates. Bootstrap new packages, preserve unpublished history, define rename/category behavior, and use a deliberate correction window.

## D-014 — Match category metadata through several identifiers and names

- **Status:** Provisional.
- **Current behavior:** Prefer identifier matches across candidate fields. If no
  identifier matches, use a case-normalized exact package name. Accept scalar or
  nested category assignments.
- **Basis:** The original account required a nested live `category` assignment after simpler ID mapping failed. The 2026-08-18 fixture captured scalar-string `category` values on retained rows, so both shapes remain plausible while only the scalar shape is fixture-backed.
- **Risk:** Ambiguous names, multiple package versions, and ID namespaces can misclassify assets.
- **Target decision:** Retain the live response variants as fixtures, establish identifier precedence, and surface unresolved or conflicting mappings instead of silently choosing the last row.

## D-015 — Define reusable package groups by package ID

- **Status:** Accepted for the local workspace.
- **Current behavior:** One Performance Asset group menu contains the built-in
  **All assets** group, saved groups, and individual assets. It also contains a
  separate **Manage groups** action. This action opens pages for group creation,
  rename, membership changes, and deletion. A publisher-scoped local-storage key
  stores the groups. Each group has a generated ID and unique display name. It
  also has a deduplicated list of Unity `package_id` strings. **All assets** is
  built in. The extension does not store it, and users cannot edit it.
- **Selection rule:** Performance accepts the catalog group, saved groups, and
  individual assets at the same time. Each scope renders as one line. A saved
  group line aggregates its member packages. The first non-default scope replaces
  the initial **All assets** selection. The user can then add **All assets**
  again. A package remains in each matching selected scope. The open selector
  shows a notice when scopes overlap.
- **Input policy:** The extension trims group names and limits them to 40
  characters. Names must be unique without regard to letter case. A group name
  cannot be **All assets**. The extension rejects empty groups and duplicate
  memberships. An edit keeps missing or unavailable package IDs. Thus, temporary
  catalog or API changes do not silently delete configuration.
- **Clear-data policy:** Analytics clearing removes records and the sync checkpoint only. Package groups and preferences remain intact.
- **Basis:** `package_id` is the strongest observed package identity used by package discovery and per-package reporting. Names are presentation data and may change.
- **Review trigger:** Fixtures show that `package_id` changes across package lifecycle events or uses incompatible namespaces across endpoints.

## D-016 — Use a narrow page-world request bridge

- **Status:** Accepted.
- **Current behavior:** `api-client.js` runs in the Publisher Portal page world. It accepts only explicit message origins, methods, paths, query forms, and request bodies. It adds the active Portal request context and returns parsed results to `content.js`.
- **Basis:** A direct isolated-world request returned HTTP 400 in the earlier
  development task. The exact rejected request was not retained. In the later
  Chrome fixture task, safe browser evaluation could inspect the signed-in page.
  It could not execute the existing session-bearing request. A temporary
  page-world helper completed the capture after a manual extension reload.
- **Consequence:** A new source requires a narrow allowlist change and request validation. A generic proxy, arbitrary URL forwarding, or raw-header forwarding is not acceptable.
- **Review trigger:** The Portal provides a documented extension-safe API or a platform change prevents the page-world bridge from operating.

## D-017 — Keep capability state separate from source data

- **Status:** Accepted as an integration rule. No capability-limited source is
  implemented.
- **Current behavior:** The current data model has no general capability-state record. A future source must not use an empty analytics result to represent every unavailable, unauthorized, or failed state.
- **Basis:** A feature that is visible only to selected publishers can be unavailable, eligible but empty, active, historical, unauthorized, or changed. These states have different trust and retry behavior.
- **Consequence:** Before integration, define an explicit availability result.
  Define successful coverage as a separate state. An optional-source failure
  must not change the completion state of unrelated core history. The UI must
  not claim that a publisher has no data when eligibility or permission is
  unknown.
- **Review trigger:** Review this policy when you design the first
  capability-limited source. Use retained evidence to select its stored state,
  retry policy, sync ownership, clearing behavior, and publisher-facing terms.
