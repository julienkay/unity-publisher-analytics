# Validation, shortcuts, and known issues

This document uses repository history, the original Codex task, and safe API
response fixtures from one account. The original task did not keep a formal test
log. The document therefore marks missing evidence as Unknown.

## Validation scope

Development used one publisher account. The task evidence shows these account
properties:

- History begins around March 2022.
- The pasted analytics export contains at least five assets.
- The export contains paid assets and a free asset.
- One paid asset has multiple price tiers in a monthly sales CSV.
- Monetary values use USD formatting.
- The pasted monthly example has zero refunds and chargebacks.
- The analytics export has a negative aggregate wishlist value.

The exact catalog size and unpublished-package count were not retained. The
number of metadata versions was also not retained. The 2026-08-18 fixtures limit
publisher-specific arrays. Thus, they do not reveal these values. Annual daily
windows appear to have completed on this account. The task did not measure
timing, response sizes, retries, or rate limits.

## Behavior matrix

| Area | Status | Evidence and limits |
|---|---|---|
| Current endpoint paths and request shapes | **Fixture-backed on one account** | Safe response fixtures are retained for `/user` and all eight analytics endpoints. The exact forms of two earlier HTTP 400 requests were not retained. |
| Package publication date | **Fixture-backed and implemented** | Published packages return `first_published_at`. `fetchPackages()` reads it, and the earliest-date calculation includes it. |
| Publisher identity and local isolation | **Implemented, second account unverified** | The Portal bundle distinguishes `publisherId` from organization IDs. Source checks cover namespace propagation. No retained live switch test exists. |
| Publisher-scoped package groups | **Implemented, manual UI validation pending** | Groups use `package_id`, survive analytics clearing, and render separate aggregate lines. Multi-scope selection, overlap notices, and group-management pages still need an unpacked-extension smoke test. |
| Chrome and Firefox support | **Validated** | One canonical manifest produces both target manifests. Archive validation confirms identical runtime files. Mozilla's linter reports no errors. The temporary Firefox package works on the signed-in Portal. |
| Full sync across the original account's available history | **Observed once** | The dashboard showed multi-year history. No persisted coverage report or independent reconciliation exists. |
| Resumable checkpoint after page refresh | **Plausible prototype behavior** | Each step saves the checkpoint. No manual test refreshed each phase. |
| Automatic incremental refresh | **Observed once at UI level** | The task used it during iteration. Correction depth and new-package behavior remain unverified. |
| 365-day daily request | **Observed once** | It worked on the original account. No test used another account or catalog size. |
| Daily end-date exclusivity | **Observed in one retained month** | Catalog and package fixtures include `start_date` through `end_date - 1`. They exclude `end_date`. The paired boundary suite is still missing. |
| Explicit zero days versus omitted days | **Partially observed** | The retained package response includes `{}` inactive dates and zero-valued metric objects. No omitted-date fixture exists. Storage loses the distinction. |
| Monthly/daily gross reconciliation | **Confirmed for one limited paid sample** | Catalog and selected-package daily totals match retained monthly sales. The sample has zero refunds and chargebacks. It has no claims or matching CSV export. |
| Paid-only assets | **Observed once** | Pasted monthly and analytics examples include paid assets |
| Free-only assets and conversion | **Confirmed for the portal CSV example** | `$0`, 242 sales quantity, 598 views, and 40.47% conversion establish inclusion of claims in that export |
| Non-zero refunds | **Unverified** | Examples were zero |
| Non-zero chargebacks | **Unverified** | Examples were zero |
| Wishlist removals/net change | **Confirmed for the portal CSV example** | A selected-period value of `-1` was present. Daily reconciliation remains unverified. |
| Download events versus users | **Fixture-backed shape, semantics inferred** | The monthly fixture has separate download and user fields. Portal definitions and daily equivalence remain unverified. |
| Localized API number strings | **Defensive only** | `toNumber()` accepts comma, period, and currency variants. No localized raw API response was retained. |
| USD across publishers | **Unverified** | Only the original dollar-denominated account was seen |
| Empty publisher account | **Unverified** | No empty catalog/ledger account tested |
| Large catalog | **Unverified** | The exact original size is unknown. No scale matrix or performance budget exists. |
| History older than 2019 | **Unverified and currently impossible** | Code clamps daily history to 2019-01-01 |
| Newly published package during incremental sync | **Known broken** | A scope without an existing daily record is skipped |
| Rename/unpublish/category change | **Unverified with known design flaws** | Current identity and record-ID behavior can duplicate or leave inconsistent history |
| Historical corrections | **Unverified** | Only one daily date and the current month overlap |
| Authentication expiry during sync | **Unverified** | No expiry/re-authentication test retained |
| Rate limiting and server timeout | **Unverified** | Fixed delays exist. No test covers HTTP 429, backoff, or adaptive window splitting. |
| Browser refresh during active API call | **Unverified** | Resume starts from the last saved checkpoint. No test explicitly covers an active request. |
| Publisher account switching | **Implemented, second account unverified** | Storage, checkpoints, preferences, and records are publisher-scoped. A missing identity fails closed. No retained live two-account switch test exists. |
| Extension move/reinstall | **Observed** | A separately loaded unpacked extension used a different origin and appeared to have empty storage. The project deliberately did not add migration. |
| Desktop visual behavior | **Manually iterated** | Dashboard, charts, filters, legends, menus, tooltips, and sync states were repeatedly reviewed in the original browser session |
| Mobile-width layout | **CSS implemented, not formally validated** | Responsive rules exist. No retained viewport matrix or screenshots exist. |
| Keyboard-only behavior | **Partially implemented, unverified** | Labels, focus styles, and Escape handling exist. No keyboard test pass was retained. |
| Screen-reader chart interpretation | **Unverified** | ARIA labels and ECharts accessibility are present, but no assistive-technology test |

## Capability-limited source matrix

No retained account exposes the proposed Asset Store bundles feature. No bundle
request or response is retained. All bundle endpoint details are **Unknown**.
The following matrix is the minimum validation set for bundles or another
publisher-selective feature:

| Account or request state | Current evidence | Required proof before integration |
|---|---|---|
| Maintainer account has no known participation data | **Observed once** from the maintainer report. Eligibility, UI visibility, request behavior, and the reason for no data are **Unknown**. | On an account with no participation data, record the UI state and any explicit capability result. Confirm whether the state means unavailable, eligible but empty, or another condition. |
| Eligible but empty | **Unknown** | Capture a successful request and the valid empty response container from an eligible account. |
| Active participation | **Unknown** | Capture a non-empty response and identify stable IDs, dates, lifecycle state, pagination, and package relationships. |
| Expired or historical participation | **Unknown** | Test an expired item or historical filter and record whether data remains available. |
| Authentication failure | **Unknown for this source** | Compare with a known endpoint in the same tab. Retain a safe copy of the status or redirect response. Remove or replace all private values. |
| Permission failure | **Unknown** | Retain a distinct permission result while the user remains signed in and another Portal request works. |
| Endpoint or schema change | **Unknown** | Verify the page and session, then retain the changed status or response shape. The normalizer must fail visibly. |
| Legitimate empty response | **Unknown** | Confirm success status, the expected container, and, when possible, a matching non-empty request from another period or account. |

Do not use the maintainer account to infer the route or eligible response. A
contributor whose account exposes the feature must follow
[DATA-SOURCE-WORKFLOW.md](DATA-SOURCE-WORKFLOW.md) and retain a safe captured fixture.

## Task observations without fixtures

The following details remain weaker than the fixture-backed inventory:

- **Observed once:** an earlier Portal script bundle contained
  `/publisher-v2-api/dashboard/package`. Its caller, method, body, response, and
  purpose were not retained. It is not evidence for bundles.
- **Observed once:** a live category assignment used a nested `category` object
  during the original development task. The retained metadata fixture contains
  only scalar string values.
- **Observed once:** an isolated-world proxy request and an early daily request
  returned HTTP 400. The exact rejected forms and response bodies were not
  retained.
- **Confirmed as a tool boundary:** the Chrome fixture task could inspect the
  signed-in tab but its safe evaluation layer did not produce API responses.
  This does not establish Unity request behavior.
- **Unknown:** Daily date keys can be omitted. Inactive objects in other periods
  can contain only zeros. Empty monthly reports and ledgers are also unknown.
  Later metadata pages and each capability-limited state remain unknown.

## Deliberately deferred

The original development task deferred:

- Alternate data sources and CSV fallbacks.
- A hosted backend or telemetry.
- Automatic migration from the previously loaded unpacked-extension origin.
- Automated `chrome://extensions` reloads.

The product direction also deliberately avoids implying individual customer journeys from aggregate data.

## Prototype shortcuts without recorded approval

These appear to have been expedient implementation choices rather than consciously accepted product contracts:

- The 2019 daily-history floor.
- The two-day daily freshness lag.
- Annual request windows.
- Fixed USD.
- Publisher isolation without a test on a second live publisher.
- One-day incremental overlap.
- Broad aliases without fixtures.
- A **complete** state based on request-loop completion.
- Omission of newly discovered packages during incremental sync.
- Direct use of current package metadata on new historical records.

## Known issues by priority

### P0 — Trust and isolation

1. **Completion is overstated.** There is no scope/date coverage manifest, gap detection, or reconciliation.
2. **Currency is assumed.** Every monetary value is shown as USD without a verified contract.
3. **Publisher isolation lacks a second-account test.** The code namespaces and fails closed by `publisherId`, but stability and switching have only Portal-bundle evidence.

### P1 — Freshness and lifecycle

1. New packages are skipped by incremental daily sync.
2. Renames can create separate record IDs and double-count an overlapped date.
3. Removed packages stop refreshing without a lifecycle marker.
4. Category changes can split one package's history across categories.
5. Corrections outside the latest day/current month remain stale.
6. The daily retention floor and freshness lag are not evidence-based.

### P2 — Schema resilience and semantics

1. Unknown response shapes often normalize to empty strings or zero rather than fail visibly.
2. Defensive aliases lack fixtures and may hide API changes.
3. Captured daily `revenue` and `chargebacks` fields are discarded by `normalizeDaily()`.
4. Daily/monthly gross, sales, and refund semantics are not reconciled beyond one limited paid sample.
5. Explicit empty days, explicit zero-valued days, and omitted days are indistinguishable after normalization.
6. Partial current months are not consistently identified in the interface.

## Test and evidence backlog

Work should proceed in this order:

1. Validate publisher isolation and fail-closed switching with two live publisher accounts.
2. For the first capability-limited source, capture each available state in the capability matrix. Keep unavailable states marked Unknown.
3. Extend pure normalizer tests to the remaining retained fields and unknown-shape failures.
4. Use [api-fixtures/README.md](api-fixtures/README.md) to capture the missing
   variants. Include empty results, non-zero refunds, chargebacks, and negative
   wishlists. Include rating values, category objects, pagination, and localized
   values.
5. Add paired daily boundary and omitted/empty/zero-day tests.
6. Reconcile representative complete months and document tolerances.
7. Run recent-data snapshot tests to determine the lag and overlap window.
8. Add catalog lifecycle tests for new, renamed, removed, and re-categorized packages.
9. Add integration coverage for resume, auth expiry, 400/401/403/429/500 responses, adaptive window splitting, and partial writes.
10. Add CI for syntax checks, manifest validation, fixture tests, and deterministic aggregations.
11. Run a manual matrix across at least two publishers, including one account with older history and a materially larger catalog.
12. Smoke-test package-group creation, overlapping membership, active-group edits/deletion, analytics clearing, unavailable members, and narrow-screen editing in the unpacked extension.

## Release evidence rule

New data behavior should be described in one of these categories in its pull request or commit notes:

- **Validated behavior:** fixture-backed or reproducibly reconciled.
- **Plausible prototype behavior:** worked in a limited manual scenario, with the limit stated.
- **Temporary shortcut:** deliberately bounded and entered in [DECISIONS.md](DECISIONS.md).
- **Planned work:** not represented to users as complete or trustworthy yet.

No UI polish should promote a plausible or temporary data state to a stronger claim.
