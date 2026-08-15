# Unity data evidence and semantics

Status: evidence audit completed 2026-08-15.

This document records what is known about the undocumented Unity Publisher Portal APIs used by Publisher Analytics+. It deliberately distinguishes working prototype behavior from a verified data contract.

The evidence available for this audit was:

1. The repository and its commit history from the initial implementation onward.
2. The original Codex session history, including the publisher's pasted CSV exports and troubleshooting messages.
3. Successful use of the extension on the original signed-in publisher account.

No raw API response was retained. An attempt during this audit to obtain response shapes through the constrained browser-control surface was intentionally stopped rather than inspect authentication material or expose publisher data. Consequently, there are no genuine sanitized response fixtures yet; [api-fixtures](api-fixtures/README.md) tracks that gap.

## Executive assessment

- The endpoint paths and current request shapes are **observed once**: they have worked on the original account and are enforced by `api-client.js`.
- The response containers and likely primary field names are **observed once**, inferred from the earliest working normalizers and the category-debug sequence. They are not backed by retained raw responses.
- Most camelCase variants and semantic synonyms accepted by `valueFrom()` are **defensive**, not demonstrated response variants.
- Daily `end_date` is treated as exclusive, but exclusivity is **not confirmed** by a retained boundary test.
- Whether inactive days are omitted or returned as explicit zero-valued objects is **unknown**. The normalizer does not synthesize missing dates.
- The 2019 retention floor, two-day freshness delay, 365-day window, USD currency, and one-day incremental overlap are **provisional policies**, not verified platform contracts.
- The dashboard is not publisher-isolated. Switching the active publisher can mix or display another publisher's local data. This is a high-priority correctness issue.
- “Complete history” currently means that all scheduled request loops finished without throwing. It does not mean that dates, scopes, or totals were reconciled.

## Endpoint inventory

All calls are same-origin requests to `https://publisher.unity.com`, using the signed-in portal session. The page-world client sends credentials, the portal CSRF token, `Content-Type: application/json`, and `X-Source: publisher-portal`. Which headers are strictly required was not isolated experimentally.

| Purpose | Request used | Expected response container | Evidence |
|---|---|---|---|
| Published package discovery | `GET /publisher-v2-api/proxy?path=/management/once-published-packages&type=array` | Array of package objects | **Observed once** |
| Category definitions | `GET /publisher-v2-api/proxy?path=/management/categories&type=array` | Array of category objects | **Observed once** during category work |
| Package metadata and category assignments | `POST /publisher-v2-api/management/packages` with string-valued `limit`, optional `offset`, `order_by: name`, and `order: asc` | Object containing a `package_versions` array and apparently `total` | **Observed once** during category work |
| Monthly sales | `GET /publisher-v2-api/monthly-sales?date=YYYY-MM-01` | Array of package/price rows | **Observed once** |
| Monthly downloads | `GET /publisher-v2-api/monthly-downloads?date=YYYY-MM-01` | Array of package rows with a nested `downloads` object | **Observed once** |
| Revenue ledger | `GET /publisher-v2-api/publisher-revenues` | Array of ledger entries | **Observed once** |
| Daily performance | `POST /publisher-v2-api/dashboard/daily` with ISO-midnight `start_date`, `end_date`, and `package_ids` containing zero or one string ID | Object keyed by date | **Observed once** |

The original session also records two rejected variants:

- A request routed through `/publisher-v2-api/proxy` returned HTTP 400. The exact rejected target and parameters were not retained.
- `/publisher-v2-api/dashboard/daily` returned HTTP 400 before the working request form was reached. The response body and precise change that resolved it were not retained.

These failures establish that routing and payload shape matter, but they are not sufficient to document Unity's full validation rules.

## Field-name provenance

`valueFrom()` compares keys after lowercasing and removing punctuation. It also accepts several aliases for many values. That tolerance should not be mistaken for evidence that Unity emitted every alias.

The table below classifies names by repository provenance. “Consumed from the initial implementation” means the name was present in the first committed working normalizer; without a fixture it remains **observed once**, not confirmed. “Defensive alternatives” means there is no retained evidence that those exact variants occurred.

| Response | Consumed from the initial implementation or later live fix | Defensive alternatives currently accepted |
|---|---|---|
| Published package | `package_id`, `name`, `first_published_time` are the leading candidates | `packageId`, generic `id`, `title`, `package_name`, `firstPublishedTime`, `first_published` |
| Category definition | Later code expects `id` and a display name such as `assetstore_name` | `category_id`, `categoryId`, `assetstoreName`, `name`, `title`, `category_name`, `categoryName` |
| Package metadata envelope | `package_versions` and `total` were used by the live category diagnostic flow | `packageVersions` |
| Package metadata identity | `package_id` was tried first; live matching was broadened when it did not resolve the original account | `packageId`, `genesis_product_id`, `genesisProductId`, `product_id`, `productId`, generic `id`, and exact normalized package name |
| Category assignment | The category work established that a live assignment can be nested under `category` as an object | Scalar `category_id`/`categoryId`; object IDs and names through `id`, `category_id`, `categoryId`, `assetstore_name`, `assetstoreName`, `name`, `title`, or `label`. The exact inner keys seen live were not retained. |
| Monthly sales | Direct properties `price`, `refunds`, `chargebacks`, `gross`, `revenue`, `first`, and `last`; likely `package_id`, `name`, and `sales` | `packageId`, `package_name`, `quantity`; generic category aliases |
| Monthly downloads | Direct outer `name` and `downloads`; likely nested snake-case names `free_downloads`, `entitled_downloads`, `free_users`, `entitled_users`, and corresponding `*_first`/`*_last` | camelCase equivalents and package/category aliases |
| Revenue ledger | Direct `date`, `description`, `debit`, `credit`, and `balance` | None |
| Daily performance | Date-keyed object; likely `gross`, `sales`, `free_obtained`, `page_views`, `downloads`, `wishlisted`, `refunds`, `rating`, `quick_looks`, and `carted` | `paid_sales`, `paidSales`, `freeObtained`, `pageViews`, `ratingAvg`, `quickLooks` |

The broad aliases were pragmatic prototype hardening. Before they become a maintained compatibility layer, each actual variant should have a fixture and an origin note. Unused aliases should then be removed.

## Date behavior and sync constants

### Daily end-date semantics

The implementation assumes a half-open range: `start_date` is included and `end_date` is excluded. It advances the next cursor directly to the previous request's `end_date` and labels the visible range through `end_date - 1`.

**Evidence level: inferred.** There is no retained request pair proving that an active date is present when used as `start_date` and absent when used as `end_date`. If Unity treats the end as inclusive, adjacent windows overlap; record IDs may overwrite many duplicates, but the behavior would still be semantically wrong and could duplicate rows whose identity changed.

### Missing and zero-activity days

**Unknown.** `normalizeDaily()` iterates only over keys Unity returned. It does not generate a row for every requested calendar date and it stores no “reported zero” marker. Therefore:

- an omitted response key,
- a legitimate day with zero activity, and
- a failed or incomplete slice that happened not to throw

cannot be distinguished in the stored data.

### `DAILY_API_MIN_DATE = 2019-01-01`

This floor was present in the initial commit. No session note, error response, portal statement, or cross-account test explains it.

**Evidence level: unknown.** It may have been a conservative guess at Unity's retention boundary. It can truncate an older publisher even though the product promises dynamically discovered history. It should not be treated as a platform contract.

### Two-day freshness delay

`latestCompleteDailyDate()` returns two UTC calendar days before the current date.

**Evidence level: unknown.** No snapshot comparison establishes when Unity finalizes a day or whether results continue to change. The delay is a safety heuristic. It also means the user-facing “up to date” state deliberately excludes yesterday and today without explaining that policy.

### 365-day request window

Daily requests originally used 60-day windows. Commit `435c4eb` changed them to 365 days solely as `perf(sync): use annual daily windows`; it contains no benchmark, retry data, limit discovery, or multi-account validation.

**Evidence level: observed once.** Annual windows worked sufficiently on the original account to remain in use. Reliability for larger catalogs, older accounts, slow connections, or different server limits is unverified.

### Incremental overlap and revisions

Incremental sync begins at the latest stored daily date for each existing scope, so it re-fetches that one date. It does not intentionally revisit a wider recent window.

**Evidence level: implementation fact; Unity revision behavior unknown.** No retained snapshots show whether Unity revises recent gross revenue, refunds, ratings, downloads, or wishlists, nor for how long. The correct overlap cannot yet be chosen empirically.

Monthly sales and downloads refresh only the current month, while the revenue ledger is fetched in full. Earlier monthly corrections are therefore missed unless a full resync is run.

## Metric semantics

### Monthly sales and daily gross

The original monthly CSV sample has columns `Package name`, `Price`, `Qty`, `Refunds`, `Chargebacks`, `Gross`, `First`, and `Last`. This confirms those report concepts for the original account. The API normalizer additionally reads `revenue` into `net`, but no raw fixture or CSV sample establishes its exact portal label.

Daily `gross` is stored in the confusing normalized field `sales` and displayed as gross revenue. Monthly `gross` is also displayed as gross revenue.

**Equivalence: inferred, not confirmed.** No month has been reconciled by summing catalog-wide daily `gross` and comparing it with all monthly sales rows, including price tiers, refunds, and chargebacks.

### Paid sales, free claims, and conversion

The daily endpoint exposes separate candidate fields `sales` and `free_obtained`. The extension interprets them as paid units and free claims, then defines:

```text
sales quantity = paid units + free claims
conversion = min(100%, sales quantity / pageviews × 100)
```

This was a deliberate product choice to reproduce the portal's aggregate analytics. The session's analytics CSV includes a free asset with `$0.00` sales, `242` sales quantity, `598` pageviews, and `40.47%` conversion. `242 / 598 = 40.47%`, which is strong evidence that the portal includes free claims in “Sales qty” and conversion for that export.

What remains unconfirmed is whether daily `sales` always means paid transactions rather than paid units, whether repeated acquisitions are possible, and whether Unity applies any additional filtering before calculating its portal conversion. The extension's 100% clamp is its own defensive product rule.

### Refunds and chargebacks

The monthly CSV presents refunds and chargebacks alongside quantity, so they are most plausibly counts there. Daily `refunds` is also treated as a count.

**Evidence level: inferred.** The examples contained only zero refunds and zero chargebacks. No non-zero raw response or monthly-to-daily reconciliation was retained, so endpoint-dependent amount semantics have not been excluded.

### Wishlists

The analytics CSV includes a package with `Wishlisted = -1` for the selected period. That proves the portal's aggregate wishlist metric can be negative and therefore represents a net change, not gross additions alone.

Daily `wishlisted` is assumed to be the additive daily component of that net change. This mapping has not been reconciled against an export.

### Downloads and users

The monthly downloads shape distinguishes `free_downloads` from `free_users` and `entitled_downloads` from `entitled_users`. The extension sums the download fields as download events and the user fields as users.

This is a strong naming-based inference that downloads are events rather than distinct users. The daily endpoint exposes only `downloads`, so whether daily downloads use exactly the same event definition is unconfirmed.

### Currency

All sales, daily, and revenue-ledger records are stamped `currency: "USD"`, and all money is formatted as USD. The normalizers do not read a currency field from Unity.

The original account's CSV exports used `$`, so USD was **observed once on one publisher account**. There is no evidence of a platform-wide USD guarantee, settlement-currency rule, or behavior for publishers in other countries. Fixed USD is a potentially serious semantic error until verified or made data-driven.

## Publisher identity and isolation

The interface reads the currently active publisher name and icon, but identity is not part of the data boundary:

- IndexedDB uses one global database name and one `records` store.
- Records contain no publisher ID.
- The sync checkpoint and preferences use global `chrome.storage.local` keys.
- `PUBLISHER_KEY` stores presentation identity, not a storage namespace or ownership assertion.
- Changing publisher accounts does not automatically clear, migrate, or hide existing records.

**Current behavior:** switching publishers can display the previous publisher's records and can combine new rows with old rows. Starting a full sync clears the entire database, but merely switching the portal publisher does not.

The original session contains no evidence that multi-publisher use was consciously designed or tested. It should be treated as not considered in the prototype, not as a deliberate automatic-clear policy.

Until namespacing exists, the extension should not claim trustworthy multi-publisher behavior. The preferred future design is to obtain a stable publisher identifier, namespace records/meta/preferences by it, and make publisher switching explicit. If a stable identifier cannot be obtained, fail closed on identity changes rather than mix data.

## Meaning of “complete history”

Today, a full sync is marked complete when:

1. Package discovery and the revenue ledger succeeded.
2. Every scheduled monthly sales and download request returned without throwing.
3. Every scheduled daily request for the catalog and the package snapshot returned without throwing.
4. The loops reached their end cursors.

It does **not** verify:

- that every expected package scope was returned;
- that every requested date is represented or explicitly zero;
- that package history starts at the true earliest retained date;
- that monthly and daily gross, sales, or refunds reconcile;
- that partial current months are distinguishable from complete months;
- that an endpoint returned a plausible non-empty shape;
- that records belong to the active publisher; or
- that Unity did not silently omit a range.

There is no persisted coverage manifest or gap map. The UI's “complete” and “up to date” language therefore describes request-loop completion, not audited data completeness.

A trustworthy definition should require a publisher namespace, an expected scope manifest, half-open window verification, explicit missing-versus-zero semantics, persisted request coverage, and selected monthly/daily reconciliation checks. Partial current months and the deliberate daily freshness lag should be visible to users.

## Incremental sync and catalog changes

The incremental path discovers the current catalog, then looks for the last daily record of each scope. If none exists, it skips that scope. Consequences:

- **New package:** skipped entirely until a full resync because it has no last daily record.
- **Renamed package:** matching by package ID can find the cursor, but new daily record IDs include the new package name. An overlapped date can coexist with the old-name record and be double-counted. Older rows keep the old name.
- **Unpublished/removed package:** no longer refreshed because it is absent from the current catalog; historical rows remain.
- **Category change:** new or overwritten recent rows can receive the new category while older history keeps the previous category. No effective-date model exists.
- **Historical correction:** only the latest daily date and current monthly report are refreshed. Older corrections are missed.
- **Package identifier change or metadata mismatch:** may create a new logical package or lose its category mapping.

No intended policy for these cases was recorded in the original session. They are prototype gaps, not validated behavior.

## Category-mapping evidence

The category implementation evolved through several live troubleshooting steps:

1. Read a category or category ID from the once-published package response.
2. Fetch `/management/categories` and map IDs to display names.
3. Fetch paginated `/management/packages` metadata and look for `package_id` plus `category_id`.
4. Broaden matching across package ID, genesis product ID, product ID, generic ID, and normalized package name.
5. Add temporary diagnostics for response keys, metadata keys, row counts, assignment counts, and category-definition counts.
6. Parse the live category assignment as an object under `category`, not only a scalar ID.
7. Remove diagnostics after the user reloaded and confirmed that categories appeared; category grouping then became the default.

The exact diagnostic output and raw category object were not retained. The only durable live-shape evidence is the code change showing that nested `category` objects resolved the original account.

Known remaining risks include ambiguous name matching, duplicate names, multiple metadata versions with different assignments, IDs from different namespaces, category renames, category changes over time, pagination changes, and packages without a category. No second account was tested for response variants.

## Required evidence work

Before treating the numbers as production-trustworthy:

1. Capture sanitized raw request/response fixtures for every endpoint using the protocol in [api-fixtures/README.md](api-fixtures/README.md).
2. Add fixture-driven normalizer tests and remove aliases not represented by a fixture or documented compatibility case.
3. Prove daily range boundaries and missing-day behavior with paired requests around known active and inactive dates.
4. Reconcile at least three complete months—paid-only, free-heavy, and refund-bearing—between daily, monthly, and portal-export totals.
5. Measure data revisions by snapshotting recent days and months over several weeks.
6. Validate currency and publisher identity across at least two publisher accounts before enabling account switching.
7. Replace request-loop “complete” with persisted, publisher-scoped coverage assertions.
