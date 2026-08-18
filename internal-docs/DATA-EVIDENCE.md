# Unity data evidence and semantics

Status: evidence audit updated 2026-08-18.

This document records what is known about the undocumented Unity Publisher Portal APIs used by Publisher Analytics+. It deliberately distinguishes working prototype behavior from a verified data contract.

The evidence available for this audit was:

1. The repository and its commit history from the initial implementation onward.
2. The original Codex session history, including the publisher's pasted CSV exports and troubleshooting messages.
3. Successful use of the extension on the original signed-in publisher account.
4. A fresh signed-in capture of the active-publisher response and all eight analytics endpoints, sanitized in the browser before retention under [api-fixtures](api-fixtures/README.md).

The original session retained no API responses. On 2026-08-18, a temporary opt-in local capture helper repeated the requests on the original account and sanitized parsed responses in the page before emitting them. Authentication material and raw account responses were never logged or saved. The retained fixtures therefore provide direct key/type/nesting evidence from one account, with the row truncation and value transformations described in each provenance sidecar.

## Executive assessment

- The endpoint paths, request shapes, response containers, and primary field names are now **fixture-backed on one account**.
- The capture exposed an implementation mismatch: published packages returned `first_published_at`, which the current normalizer does not read.
- Most camelCase variants and semantic synonyms accepted by `valueFrom()` are **defensive**, not demonstrated response variants.
- A retained month response includes `start_date` through `end_date - 1` and excludes `end_date`, directly supporting half-open handling for that request. The stricter paired boundary suite is still missing.
- In the retained package response, inactive dates were present as explicit empty objects `{}`. No omitted-day variant or explicit all-zero inactive object has been captured.
- The 2019 retention floor, two-day freshness delay, 365-day window, USD currency, and one-day incremental overlap are **provisional policies**, not verified platform contracts.
- Publisher ownership is derived from the Portal's `publisherId`. Records, sync checkpoints, and preferences are isolated by that value; a missing identity fails closed.
- “Complete history” currently means that all scheduled request loops finished without throwing. It does not mean that dates, scopes, or totals were reconciled.

## Endpoint inventory

All calls are same-origin requests to `https://publisher.unity.com`, using the signed-in portal session. The page-world client sends credentials, the portal CSRF token, `Content-Type: application/json`, and `X-Source: publisher-portal`. Which headers are strictly required was not isolated experimentally.

| Purpose | Request used | Expected response container | Evidence |
|---|---|---|---|
| Active publisher identity | `GET /publisher-v2-api/user` | Object containing publisher, organization, locale, country, and avatar fields | **Fixture-backed on one account** |
| Published package discovery | `GET /publisher-v2-api/proxy?path=/management/once-published-packages&type=array` | Array of package objects | **Fixture-backed on one account** |
| Category definitions | `GET /publisher-v2-api/proxy?path=/management/categories&type=array` | Array of category objects | **Fixture-backed on one account** |
| Package metadata and category assignments | `POST /publisher-v2-api/management/packages` with string-valued `limit`, optional `offset`, `order_by: name`, and `order: asc` | Object containing `package_versions`, `package_key_images`, `counts`, and `total` | **Fixture-backed first-page sample on one account** |
| Monthly sales | `GET /publisher-v2-api/monthly-sales?date=YYYY-MM-01` | Array of package/price rows | **Fixture-backed non-empty month on one account** |
| Monthly downloads | `GET /publisher-v2-api/monthly-downloads?date=YYYY-MM-01` | Array of package rows with a nested `downloads` object | **Fixture-backed non-empty month on one account** |
| Revenue ledger | `GET /publisher-v2-api/publisher-revenues` | Array of ledger entries | **Fixture-backed non-empty sample on one account** |
| Daily performance | `POST /publisher-v2-api/dashboard/daily` with ISO-midnight `start_date`, `end_date`, and `package_ids` containing zero or one string ID | Object keyed by date | **Fixture-backed catalog and paid-package month on one account** |

The original session also records two rejected variants:

- A request routed through `/publisher-v2-api/proxy` returned HTTP 400. The exact rejected target and parameters were not retained.
- `/publisher-v2-api/dashboard/daily` returned HTTP 400 before the working request form was reached. The response body and precise change that resolved it were not retained.

These failures establish that routing and payload shape matter, but they are not sufficient to document Unity's full validation rules.

## Publisher identity

The official Publisher Portal production bundle inspected on 2026-08-16 requests `GET /publisher-v2-api/user`. The retained one-account response contains `id`, `name`, `locale`, `publisherId`, `defaultOrgId`, `publisherOrgId`, `publisherOrgName`, `countries`, and `avatar`. In the production bundle, `publisherId` is used for Asset Store publisher-profile URLs, while `publisherOrgId` or `defaultOrgId` represents Unity organization context.

Publisher Analytics+ therefore uses the non-empty string form of `publisherId` as the local ownership key. Organization IDs are retained only as descriptive identity metadata and never select analytics storage. Every normalized record includes its publisher ID; IndexedDB queries and deletes require that ID; sync metadata and preferences use the same boundary. The extension rechecks the active identity before committing each fetched batch. If identity cannot be established, it does not load or sync a publisher workspace.

**Evidence limit:** the key distinction is now supported by both the production bundle and a retained sanitized response, but a second publisher account has not yet been used to validate switching behavior or ID stability.

## Field-name provenance

`valueFrom()` compares keys after lowercasing and removing punctuation. It also accepts several aliases for many values. That tolerance should not be mistaken for evidence that Unity emitted every alias.

The table below separates names present in the retained 2026-08-18 capture from compatibility aliases accepted by the implementation without retained evidence.

| Response | Present in retained capture | Other accepted or previously observed variants |
|---|---|---|
| Published package | `package_id`, `name`, `first_published_at`, `status` | `packageId`, generic `id`, `title`, `package_name`, `first_published_time`, `firstPublishedTime`, `first_published` are accepted, but none matches the captured publication-date key |
| Category definition | `assetstore_name`, `id`, `multiple`, `name`, `status` | `category_id`, `categoryId`, `assetstoreName`, `title`, `category_name`, `categoryName` |
| Package metadata envelope | `package_versions`, `package_key_images`, `counts`, `total` | `packageVersions` |
| Package metadata identity | `id`, `package_id`, `name`; nested `vetting.id` and `vetting.genesis_vetting_id` also occurred | `packageId`, `genesis_product_id`, `genesisProductId`, `product_id`, `productId`, and exact normalized package name |
| Category assignment | Scalar string under `category` in every retained row; contents were redacted, so ID versus slug/name is unresolved | An object under `category` fixed category mapping in the original live session, but that raw shape was not retained; scalar `category_id`/`categoryId` and broad inner aliases remain defensive |
| Monthly sales | `chargebacks`, `first`, `gross`, `last`, `name`, `package_id`, `price`, `refunds`, `revenue`, `sales`; all numeric report values were strings | `packageId`, `package_name`, `quantity`; generic category aliases |
| Monthly downloads | Outer `name`, `package_id`, and `downloads`; nested `free_downloads`, `entitled_downloads`, `free_users`, `entitled_users`, `free_first`, `free_last`, `entitled_first`, `entitled_last`, with nullable values | camelCase equivalents and package/category aliases |
| Revenue ledger | Direct `date`, `description`, `debit`, `credit`, and `balance` | None |
| Daily performance | Date-keyed object; observed metric keys were `carted`, `chargebacks`, `downloads`, `free_obtained`, `gross`, `page_views`, `quick_looks`, `refunds`, `revenue`, `sales`, and `wishlisted`; metrics were JSON numbers | `rating` did not occur in the captured month; `paid_sales`, `paidSales`, `freeObtained`, `pageViews`, `ratingAvg`, `quickLooks` remain unfixture-backed |

The broad aliases were pragmatic prototype hardening. Before they become a maintained compatibility layer, each actual variant should have a fixture and an origin note. Unused aliases should then be removed. In particular, the current package normalizer omits the captured `first_published_at` key, so `firstPublished` is empty for this response shape.

## Date behavior and sync constants

### Daily end-date semantics

The implementation assumes a half-open range: `start_date` is included and `end_date` is excluded. It advances the next cursor directly to the previous request's `end_date` and labels the visible range through `end_date - 1`.

**Evidence level: fixture-backed for one month request.** The sanitized catalog and package requests cover `[2024-07-01, 2024-08-01)`. Both responses contain `2024-07-01` through `2024-07-31` and no `2024-08-01` key. This directly supports the current half-open interpretation. The stricter three-request boundary suite around one active date is still needed to guard against range-length- or activity-dependent behavior.

### Missing and zero-activity days

The retained package response contains all 31 requested dates. Three inactive dates are explicit empty objects `{}`, while other no-sale dates contain zero-valued engagement fields. This confirms at least two distinct no-activity shapes on one package. No omitted-date variant was observed in this month, but omission is not excluded for other accounts, ranges, or endpoint conditions.

`normalizeDaily()` currently turns an empty object into a stored all-zero daily record and does not store a “reported empty” marker. It would skip only an omitted key. Therefore:

- an omitted response key,
- an explicit empty object,
- a legitimate object with returned zero-valued metrics, and
- a failed or incomplete slice that happened not to throw but omitted keys

cannot be distinguished after normalization.

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

The original monthly CSV sample has columns `Package name`, `Price`, `Qty`, `Refunds`, `Chargebacks`, `Gross`, `First`, and `Last`. The retained API fixture contains the direct string-valued fields `price`, `sales`, `refunds`, `chargebacks`, `gross`, and `revenue`, plus `first` and `last`. This confirms that the normalizer's `revenue` → net mapping reads a real API field, although the portal-facing meaning of that field is still inferred from the retained 70% relationship rather than an API contract.

Daily `gross` is stored in the confusing normalized field `sales` and displayed as gross revenue. Monthly `gross` is also displayed as gross revenue.

**Equivalence: reconciled for the retained paid sample.** The sanitized catalog-wide daily `gross` and `sales` totals match the two retained monthly sales rows, and the selected package daily totals match its monthly row. The fixtures also show daily `revenue` and `chargebacks` keys, which `normalizeDaily()` currently discards. This is not yet a representative reconciliation suite: the period had zero refunds and chargebacks, did not exercise claims, and has no matching retained CSV export.

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

**Evidence level: fixture-backed zero case only.** Both monthly and daily fixtures contain numeric/count-like zero `refunds` and `chargebacks`, but no non-zero response was captured. Endpoint-dependent amount semantics have not been excluded.

### Wishlists

The analytics CSV includes a package with `Wishlisted = -1` for the selected period. That proves the portal's aggregate wishlist metric can be negative and therefore represents a net change, not gross additions alone.

Daily `wishlisted` is assumed to be the additive daily component of that net change. This mapping has not been reconciled against an export.

### Downloads and users

The retained monthly downloads response distinguishes nullable `free_downloads` from `free_users` and `entitled_downloads` from `entitled_users`, with corresponding first/last timestamps. The extension sums the download fields as download events and the user fields as users.

The distinct captured fields strengthen the naming-based inference that downloads are events rather than distinct users. The daily endpoint exposes only `downloads`, so whether daily downloads use exactly the same event definition remains unconfirmed. The retained monthly array was deliberately truncated, so it cannot support a catalog-total download reconciliation.

### Currency

All sales, daily, and revenue-ledger records are stamped `currency: "USD"`, and all money is formatted as USD. The normalizers do not read a currency field from Unity.

The original account's CSV exports used `$`, so USD was **observed once on one publisher account**. There is no evidence of a platform-wide USD guarantee, settlement-currency rule, or behavior for publishers in other countries. Fixed USD is a potentially serious semantic error until verified or made data-driven.

## Publisher identity and isolation

The interface requires `publisherId` before opening a local workspace. IndexedDB remains one physical database, but every record contains the publisher ID and all record queries are filtered through its index. Sync checkpoints use publisher-qualified keys, and local extension-storage preferences and cached presentation metadata are keyed per publisher.

Changing publishers increments a workspace generation, hides the previous workspace immediately, and loads only the new publisher's records. In-flight sync work checks both the generation and the current Portal identity before committing a batch. Identity lookup failure hides local analytics until ownership can be established again.

Clearing local data deletes records and the sync checkpoint only for the active publisher. It deliberately does not clear preferences; future package groups must likewise use a separate durable key or store that the analytics-clear operation does not touch.

This behavior is implemented but has not yet been exercised against a second live publisher account. Until that test is retained, the endpoint-derived boundary is supported by Portal-bundle evidence rather than multi-account observation.

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

The exact diagnostic output and raw category object from the original session were not retained. The 2026-08-18 package-metadata fixture adds a second observed shape: `category` was a scalar string in every retained row. Its value was redacted before retention, so the fixture does not distinguish an ID from a slug or display name. The nested-object variant remains supported only by the earlier code change and session outcome.

Known remaining risks include ambiguous name matching, duplicate names, multiple metadata versions with different assignments, IDs from different namespaces, category renames, category changes over time, pagination changes, and packages without a category. No second account was tested for response variants.

## Required evidence work

Before treating the numbers as production-trustworthy:

1. Add fixture-driven normalizer tests, including an assertion for the captured `first_published_at` key and unknown-shape failures, before changing aliases.
2. Capture the still-missing variants: empty account/period, non-zero refunds and chargebacks, negative daily wishlist movement, rating-bearing days, multi-price packages, later metadata pages, nested category objects, and any localized number/currency form.
3. Complete the three-request daily boundary suite around known active and inactive dates.
4. Reconcile at least three complete months—paid-only, free-heavy, and refund-bearing—between all package daily responses, catalog daily, monthly reports, and portal CSV exports.
5. Measure data revisions by snapshotting recent days and months over several weeks.
6. Validate currency and `publisherId` stability across at least two publisher accounts, including a live switch with separate local histories.
7. Replace request-loop “complete” with persisted, publisher-scoped coverage assertions.
