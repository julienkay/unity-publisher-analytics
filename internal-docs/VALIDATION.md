# Validation, shortcuts, and known issues

Status: reconstructed from repository history and the original Codex session on 2026-08-15. The original session did not keep a formal test log, so this document is intentionally conservative.

## Validation scope

The implementation was developed against one publisher account. The session evidence shows:

- history beginning around March 2022;
- at least five assets represented in the pasted analytics export;
- both paid assets and a free asset;
- multiple price tiers for one paid asset in a monthly sales CSV;
- USD-formatted monetary values;
- zero refunds and chargebacks in the pasted monthly example; and
- a negative aggregate wishlist value in the analytics export.

The exact total catalog size, unpublished-package count, and number of metadata versions were not retained. Annual daily windows appear to have completed on this account, but timing, response sizes, and retry/rate-limit behavior were not measured.

## Behavior matrix

| Area | Status | Evidence and limits |
|---|---|---|
| Current endpoint paths and request shapes | **Observed once** | Working extension on one signed-in account; two earlier 400 responses recorded, but no raw fixtures |
| Full sync across the original account's available history | **Observed once** | Dashboard populated over multi-year history; no persisted coverage report or independent reconciliation |
| Resumable checkpoint after page refresh | **Plausible prototype behavior** | Checkpoint is saved after each step; no explicit refresh-at-each-phase manual test was recorded |
| Automatic incremental refresh | **Observed once at UI level** | Used during iteration; correction depth and new-package behavior not validated |
| 365-day daily request | **Observed once** | Worked on the original account; no other account/catalog size tested |
| Daily end-date exclusivity | **Unverified** | Assumed by cursor logic; no paired boundary fixture |
| Explicit zero days versus omitted days | **Unverified** | Raw date keys were not retained; storage cannot distinguish them |
| Monthly/daily gross reconciliation | **Unverified** | No complete month comparison retained |
| Paid-only assets | **Observed once** | Pasted monthly and analytics examples include paid assets |
| Free-only assets and conversion | **Confirmed for the portal CSV example** | `$0`, 242 sales quantity, 598 views, and 40.47% conversion establish inclusion of claims in that export |
| Non-zero refunds | **Unverified** | Examples were zero |
| Non-zero chargebacks | **Unverified** | Examples were zero |
| Wishlist removals/net change | **Confirmed for the portal CSV example** | A selected-period value of `-1` was present; daily reconciliation remains unverified |
| Download events versus users | **Inferred** | Monthly response handling distinguishes download and user fields; no raw fixture or portal definition retained |
| Localized API number strings | **Defensive only** | `toNumber()` accepts comma/dot/currency variants; no localized raw API response was retained |
| USD across publishers | **Unverified** | Only the original dollar-denominated account was seen |
| Empty publisher account | **Unverified** | No empty catalog/ledger account tested |
| Large catalog | **Unverified** | Exact original size unknown; no scale matrix or performance budget |
| History older than 2019 | **Unverified and currently impossible** | Code clamps daily history to 2019-01-01 |
| Newly published package during incremental sync | **Known broken** | A scope without an existing daily record is skipped |
| Rename/unpublish/category change | **Unverified with known design flaws** | Current identity and record-ID behavior can duplicate or leave inconsistent history |
| Historical corrections | **Unverified** | Only one daily date and the current month overlap |
| Authentication expiry during sync | **Unverified** | No expiry/re-authentication test retained |
| Rate limiting and server timeout | **Unverified** | Fixed sleeps exist; no 429/backoff or adaptive split test |
| Browser refresh during active API call | **Unverified** | Resume starts from last saved checkpoint; in-flight behavior not explicitly exercised |
| Publisher account switching | **Known unsafe** | Storage and records are not publisher-namespaced |
| Extension move/reinstall | **Observed** | Moving to a separately loaded unpacked extension produced a different extension origin and apparently empty storage; migration was deliberately not added |
| Desktop visual behavior | **Manually iterated** | Dashboard, charts, filters, legends, menus, tooltips, and sync states were repeatedly reviewed in the original browser session |
| Mobile-width layout | **CSS implemented, not formally validated** | Responsive rules exist; no retained viewport matrix or screenshots |
| Keyboard-only behavior | **Partially implemented, unverified** | Labels, focus styles, and Escape handling exist; no keyboard test pass retained |
| Screen-reader chart interpretation | **Unverified** | ARIA labels and ECharts accessibility are present, but no assistive-technology test |

## Deliberately deferred

The original session explicitly deferred:

- alternate data sources and CSV fallbacks;
- a hosted backend or telemetry;
- automatic migration from the previously loaded unpacked-extension origin; and
- automating `chrome://extensions` reloads.

The product direction also deliberately avoids implying individual customer journeys from aggregate data.

## Prototype shortcuts without recorded approval

These appear to have been expedient implementation choices rather than consciously accepted product contracts:

- the 2019 daily-history floor;
- the two-day daily freshness lag;
- annual request windows;
- fixed USD;
- one global publisher namespace;
- one-day incremental overlap;
- broad unfixture-backed aliases;
- “complete” based on request-loop completion;
- skipping newly discovered packages during incremental sync; and
- applying current package metadata directly to new historical records.

## Known issues by priority

### P0 — Trust and isolation

1. **Publisher data is not isolated.** Switching the active publisher can expose or combine another publisher's records.
2. **Completion is overstated.** There is no scope/date coverage manifest, gap detection, or reconciliation.
3. **Currency is assumed.** Every monetary value is shown as USD without a verified contract.

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
3. Daily/monthly gross, sales, and refund semantics are not reconciled.
4. Missing days and explicit zero days are indistinguishable.
5. Partial current months are not consistently identified in the interface.

## Test and evidence backlog

Work should proceed in this order:

1. Add publisher isolation or fail-closed publisher-change detection.
2. Capture all raw endpoint fixtures using [api-fixtures/README.md](api-fixtures/README.md).
3. Add pure normalizer tests using those fixtures, including unknown-shape failures.
4. Add paired daily boundary and zero-day tests.
5. Reconcile representative complete months and document tolerances.
6. Run recent-data snapshot tests to determine the lag and overlap window.
7. Add catalog lifecycle tests for new, renamed, removed, and re-categorized packages.
8. Add integration coverage for resume, auth expiry, 400/401/403/429/500 responses, adaptive window splitting, and partial writes.
9. Add CI for syntax checks, manifest validation, fixture tests, and deterministic aggregations.
10. Run a manual matrix across at least two publishers, including one account with older history and a materially larger catalog.

## Release evidence rule

New data behavior should be described in one of these categories in its pull request or commit notes:

- **Validated behavior:** fixture-backed or reproducibly reconciled.
- **Plausible prototype behavior:** worked in a limited manual scenario, with the limit stated.
- **Temporary shortcut:** deliberately bounded and entered in [DECISIONS.md](DECISIONS.md).
- **Planned work:** not represented to users as complete or trustworthy yet.

No UI polish should promote a plausible or temporary data state to a stronger claim.
