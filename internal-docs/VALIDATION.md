# Validation, shortcuts, and known issues

Status: reconstructed from repository history and the original Codex session on 2026-08-15; publisher-isolation status updated 2026-08-16; sanitized one-account API fixtures added 2026-08-18. The original session did not keep a formal test log, so this document is intentionally conservative.

## Validation scope

The implementation was developed against one publisher account. The session evidence shows:

- history beginning around March 2022;
- at least five assets represented in the pasted analytics export;
- both paid assets and a free asset;
- multiple price tiers for one paid asset in a monthly sales CSV;
- USD-formatted monetary values;
- zero refunds and chargebacks in the pasted monthly example; and
- a negative aggregate wishlist value in the analytics export.

The exact total catalog size, unpublished-package count, and number of metadata versions were not retained. The 2026-08-18 fixtures deliberately truncate publisher-specific arrays, so they do not reveal those values. Annual daily windows appear to have completed on this account, but timing, response sizes, and retry/rate-limit behavior were not measured.

## Behavior matrix

| Area | Status | Evidence and limits |
|---|---|---|
| Current endpoint paths and request shapes | **Fixture-backed on one account** | Sanitized responses retained for `/user` and all eight analytics endpoints; two earlier 400 variants remain undocumented |
| Package publication date | **Fixture-backed and implemented** | Published packages return `first_published_at`; `fetchPackages()` reads it and the earliest-date calculation includes it |
| Publisher identity and local isolation | **Implemented, second account unverified** | Official Portal bundle distinguishes `publisherId` from organization IDs; source checks cover namespace propagation, but no retained live switch test exists |
| Publisher-scoped package groups | **Implemented, manual UI validation pending** | Groups use `package_id`, survive analytics clearing, and render as independently aggregated comparison lines; multi-scope selection, overlap notices, and dedicated create/edit/manage pages still need an unpacked-extension smoke test |
| Chrome and Firefox support | **Validated** | Target manifests are generated from one canonical manifest; archive validation proves identical runtime payloads; Mozilla's linter reports no errors; and the temporary Firefox package operates successfully on the signed-in Publisher Portal. |
| Full sync across the original account's available history | **Observed once** | Dashboard populated over multi-year history; no persisted coverage report or independent reconciliation |
| Resumable checkpoint after page refresh | **Plausible prototype behavior** | Checkpoint is saved after each step; no explicit refresh-at-each-phase manual test was recorded |
| Automatic incremental refresh | **Observed once at UI level** | Used during iteration; correction depth and new-package behavior not validated |
| 365-day daily request | **Observed once** | Worked on the original account; no other account/catalog size tested |
| Daily end-date exclusivity | **Observed in one retained month** | Both catalog and package fixtures include `start_date` through `end_date - 1` and exclude `end_date`; paired boundary suite still missing |
| Explicit zero days versus omitted days | **Partially observed** | Retained package response includes explicit `{}` inactive dates and zero-valued metric objects; no omitted-date variant captured, and storage loses the distinction |
| Monthly/daily gross reconciliation | **Confirmed for one limited paid sample** | Catalog daily and selected-package daily totals match retained monthly sales; zero refunds/chargebacks, no claims, and no matching CSV export |
| Paid-only assets | **Observed once** | Pasted monthly and analytics examples include paid assets |
| Free-only assets and conversion | **Confirmed for the portal CSV example** | `$0`, 242 sales quantity, 598 views, and 40.47% conversion establish inclusion of claims in that export |
| Non-zero refunds | **Unverified** | Examples were zero |
| Non-zero chargebacks | **Unverified** | Examples were zero |
| Wishlist removals/net change | **Confirmed for the portal CSV example** | A selected-period value of `-1` was present; daily reconciliation remains unverified |
| Download events versus users | **Fixture-backed shape, semantics inferred** | Monthly fixture has distinct free/entitled download and user fields; portal definitions and daily equivalence remain unverified |
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
| Publisher account switching | **Implemented, second account unverified** | Storage, checkpoints, preferences, and records are publisher-namespaced and fail closed; no retained live two-account switch test |
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
- publisher isolation implemented from Portal-bundle evidence but not yet tested with a second live publisher;
- one-day incremental overlap;
- broad unfixture-backed aliases;
- “complete” based on request-loop completion;
- skipping newly discovered packages during incremental sync; and
- applying current package metadata directly to new historical records.

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
2. Extend pure normalizer tests to the remaining retained fields and unknown-shape failures.
3. Capture the missing empty, non-zero refund/chargeback, negative-wishlist, rating, category-object, pagination, and localized-value variants using [api-fixtures/README.md](api-fixtures/README.md).
4. Add paired daily boundary and omitted/empty/zero-day tests.
5. Reconcile representative complete months and document tolerances.
6. Run recent-data snapshot tests to determine the lag and overlap window.
7. Add catalog lifecycle tests for new, renamed, removed, and re-categorized packages.
8. Add integration coverage for resume, auth expiry, 400/401/403/429/500 responses, adaptive window splitting, and partial writes.
9. Add CI for syntax checks, manifest validation, fixture tests, and deterministic aggregations.
10. Run a manual matrix across at least two publishers, including one account with older history and a materially larger catalog.
11. Smoke-test package-group creation, overlapping membership, active-group edits/deletion, analytics clearing, unavailable members, and narrow-screen editing in the unpacked extension.

## Release evidence rule

New data behavior should be described in one of these categories in its pull request or commit notes:

- **Validated behavior:** fixture-backed or reproducibly reconciled.
- **Plausible prototype behavior:** worked in a limited manual scenario, with the limit stated.
- **Temporary shortcut:** deliberately bounded and entered in [DECISIONS.md](DECISIONS.md).
- **Planned work:** not represented to users as complete or trustworthy yet.

No UI polish should promote a plausible or temporary data state to a stronger claim.
