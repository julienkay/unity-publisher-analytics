# Unity data evidence and semantics

Status: evidence updated 2026-09-19.

This document records evidence about the undocumented Unity Publisher Portal
APIs that Publisher Analytics+ uses. It distinguishes prototype behavior from a
verified data contract.

Evidence comes from retained fixtures, Portal exports, live browser CDP tests,
the current source, and the loaded Portal application. Each fixture provenance
file records its source, changes, and limits.

## Executive assessment

- The endpoint paths, request shapes, response containers, and primary field names are now **fixture-backed on one account**.
- Published packages use `first_published_at`. The package normalizer reads this field as the publication date.
- Most camelCase variants and semantic synonyms accepted by `valueFrom()` are **defensive**, not demonstrated response variants.
- A retained month response includes `start_date` through `end_date - 1`. It
  excludes `end_date`. This response supports half-open handling for that one
  request. The paired boundary suite is still missing.
- In the retained package response, inactive dates were present as explicit empty objects `{}`. No omitted-day variant or explicit all-zero inactive object has been captured.
- The 2019 retention floor, two-day freshness delay, 365-day window, USD currency, and one-day incremental overlap are **provisional policies**, not verified platform contracts.
- Incremental sync starts a newly discovered package at its captured
  `first_published_at` value. Live new-package validation is still required.
- The Portal's `publisherId` defines publisher ownership. This value isolates
  records, sync checkpoints, and preferences. The extension requires this value
  before it activates a workspace. It does not poll identity during sync.
- “Complete history” currently means that all scheduled request loops finished without throwing. It does not mean that dates, scopes, or totals were reconciled.

## Endpoint inventory

All calls are same-origin requests to `https://publisher.unity.com`. They use the
signed-in Portal session. The page-world client sends credentials and the Portal
CSRF token. It also sends `Content-Type: application/json` and
`X-Source: publisher-portal`. Tests did not isolate the required headers.

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

## Monthly report query behavior

Browser CDP tests on 2026-09-19 used a signed-in publisher account.

| Request | Result |
|---|---|
| `monthly-sales?date=2024-07-01` | HTTP 200. The response contained July 2024 rows. |
| `monthly-downloads?date=2024-07-01` | HTTP 200. The response contained July 2024 rows. |
| Sales with `start_date=2024-07-01&end_date=2024-09-01` | HTTP 200 with an empty array. |
| Downloads with the same range fields | HTTP 200 with current-month data. The range fields were ignored. |
| Two `date` fields for July and August | Both endpoints returned July only. The first `date` value won. |

These tests show no multi-month request form. The demonstrated request shape is
one `date` field and one calendar month per request.

## Evidence limits

The tests did not isolate required request headers. The working client sends
the CSRF token, `Content-Type: application/json`, `X-Source: publisher-portal`,
and included credentials.

The Portal bundle contains `/publisher-v2-api/dashboard/package`. Its method,
body, response, and purpose are unknown. No bundle endpoint was observed.

## Publisher identity

The Publisher Portal production bundle inspected on 2026-08-16 requests
`GET /publisher-v2-api/user`. The retained one-account response contains `id`,
`name`, `locale`, `publisherId`, `defaultOrgId`, `publisherOrgId`,
`publisherOrgName`, `countries`, and `avatar`. The production bundle uses
`publisherId` for Asset Store publisher-profile URLs. It uses `publisherOrgId`
or `defaultOrgId` for Unity organization context.

Publisher Analytics+ uses a non-empty `publisherId` string as the local ownership
key. Organization IDs are only descriptive identity metadata. They do not select
analytics storage. Each normalized record includes its publisher ID. IndexedDB
queries and deletes require this ID. Sync metadata and preferences use the same
boundary. Page activation checks the identity before it loads or resumes a
workspace. A new full sync checks identity before it clears local analytics.
The analytics loops use the activated workspace ID. They do not request
identity between batches.

**Evidence limit:** the key distinction is now supported by both the production
bundle and a safe captured response. A second publisher account has not been
used to validate switching behavior or ID stability.

## Field-name provenance

`valueFrom()` compares keys after it converts letters to lowercase and removes
punctuation. It also accepts several aliases for many values. This tolerance is
not evidence that Unity emits every alias.

The table below separates names present in the retained 2026-08-18 capture from compatibility aliases accepted by the implementation without retained evidence.

| Response | Present in retained capture | Other accepted or previously observed variants |
|---|---|---|
| Published package | `package_id`, `name`, `first_published_at`, `status` | `packageId`, generic `id`, `title`, `package_name`, `first_published_time`, `firstPublishedTime`, and `first_published` are accepted compatibility aliases |
| Category definition | `assetstore_name`, `id`, `multiple`, `name`, `status` | `category_id`, `categoryId`, `assetstoreName`, `title`, `category_name`, `categoryName` |
| Package metadata envelope | `package_versions`, `package_key_images`, `counts`, `total` | `packageVersions` |
| Package metadata identity | `id`, `package_id`, and `name`. Nested `vetting.id` and `vetting.genesis_vetting_id` also occurred. | `packageId`, `genesis_product_id`, `genesisProductId`, `product_id`, `productId`, and exact normalized package name |
| Category assignment | Each retained row had a scalar string under `category`. Redaction prevents identification as an ID, slug, or name. | An object under `category` fixed category mapping in the original live task. The raw shape was not retained. Scalar `category_id`, `categoryId`, and broad inner aliases remain defensive. |
| Monthly sales | `chargebacks`, `first`, `gross`, `last`, `name`, `package_id`, `price`, `refunds`, `revenue`, and `sales`. All numeric report values were strings. | `packageId`, `package_name`, `quantity`, and generic category aliases |
| Monthly downloads | Outer `name`, `package_id`, and `downloads`. Nested values are `free_downloads`, `entitled_downloads`, `free_users`, `entitled_users`, `free_first`, `free_last`, `entitled_first`, and `entitled_last`. Values can be null. | camelCase equivalents and package/category aliases |
| Revenue ledger | Direct `date`, `description`, `debit`, `credit`, and `balance` | None |
| Daily performance | Date-keyed object. Observed keys were `carted`, `chargebacks`, `downloads`, `free_obtained`, `gross`, `page_views`, `quick_looks`, `refunds`, `revenue`, `sales`, and `wishlisted`. Metrics were JSON numbers. | `rating` did not occur in the captured month. `paid_sales`, `paidSales`, `freeObtained`, `pageViews`, `ratingAvg`, and `quickLooks` remain unfixture-backed. |

The broad aliases were pragmatic prototype hardening. Before they become a maintained compatibility layer, each actual variant should have a fixture and an origin note. Unused aliases should then be removed. The package normalizer maps the captured `first_published_at` value to `firstPublished`.

## Date behavior and sync constants

### Daily end-date semantics

The implementation assumes a half-open range. The range includes `start_date`
and excludes `end_date`. The next cursor equals the previous request's
`end_date`. The visible range ends at `end_date - 1`.

**Evidence level: fixture-backed for one month request.** The safe catalog and
package fixtures cover `[2024-07-01, 2024-08-01)`. Both responses contain
`2024-07-01` through `2024-07-31`. They do not contain a `2024-08-01` key. This
supports the current half-open interpretation for this request. A stricter
three-request boundary test around one active date is still required.

### Missing and zero-activity days

The retained package response contains all 31 requested dates. Three inactive
dates are explicit empty objects `{}`. Other no-sale dates contain zero-valued
engagement fields. Thus, one package has at least two no-activity shapes. No
omitted-date variant occurred in this month. Other accounts, ranges, or endpoint
conditions can still omit dates.

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

Daily requests originally used 60-day windows. Commit `435c4eb` changed them to
365 days. Its message was `perf(sync): use annual daily windows`. The commit
contains no benchmark, retry data, limit discovery, or multi-account validation.

**Evidence level: observed once.** Annual windows worked sufficiently on the original account to remain in use. Reliability for larger catalogs, older accounts, slow connections, or different server limits is unverified.

### Full-sync interruption

A full-sync request failure keeps the last committed month or daily cursor. The
job becomes inactive and keeps the error message. Continue retries the failed
request and then processes the remaining schedule.

**Evidence level: source-tested.** Mock tests cover HTTP 401, 429, and 500
responses. They also cover a request timeout. No retained live failure confirms
this behavior against Unity.

### Incremental overlap and revisions

Incremental sync begins at the latest stored daily date for each existing scope, so it re-fetches that one date. It does not intentionally revisit a wider recent window.

For a newly discovered package, incremental sync starts at the package's
`first_published_at` value. The current `2019-01-01` floor still applies. The
retained package fixture supports the field and date parsing. It does not prove
the behavior during a live package release.

**Evidence level: implementation fact. Unity revision behavior is unknown.** No
retained snapshot shows whether Unity revises recent data. The data includes
gross revenue, refunds, ratings, downloads, and wishlists. The revision period
is also unknown. Thus, evidence cannot yet define the correct overlap.

Monthly sales and downloads refresh only the current month, while the revenue ledger is fetched in full. Earlier monthly corrections are therefore missed unless a full resync is run.

## Metric semantics

### Monthly sales and daily gross

The original monthly CSV sample has columns `Package name`, `Price`, `Qty`,
`Refunds`, `Chargebacks`, `Gross`, `First`, and `Last`. The retained API fixture
contains the string fields `price`, `sales`, `refunds`, `chargebacks`, `gross`,
and `revenue`. It also contains `first` and `last`. Thus, the normalizer's
`revenue` to net mapping reads a real API field. The Portal meaning of that field
remains inferred from the retained 70% relationship. An API contract does not
confirm that meaning.

Daily `gross` is stored in the confusing normalized field `sales` and displayed as gross revenue. Monthly `gross` is also displayed as gross revenue.

**Equivalence: reconciled for the retained paid sample.** The safe catalog daily
`gross` and `sales` totals match the two retained monthly sales rows. The
selected package daily totals also match its monthly row. The fixtures contain
daily `revenue` and `chargebacks` keys. `normalizeDaily()` does not store these
fields. This sample is limited. It has zero refunds and chargebacks, no claims,
and no matching retained CSV export.

### Paid sales, free claims, and conversion

The daily endpoint exposes separate candidate fields `sales` and `free_obtained`. The extension interprets them as paid units and free claims, then defines:

```text
sales quantity = paid units + free claims
conversion = min(100%, sales quantity / pageviews × 100)
```

This product rule reproduces the Portal's aggregate analytics. The task's
analytics CSV includes a free asset with `$0.00` sales. It also shows `242`
sales, `598` pageviews, and `40.47%` conversion. The calculation
`242 / 598 = 40.47%` includes free claims. This is strong evidence for that one
export.

The meaning of daily `sales` remains unconfirmed. It could mean paid
transactions or paid units. Repeated acquisitions are also unconfirmed. Unity
could apply other filters before it calculates Portal conversion. The extension
defines its own defensive 100% limit.

### Refunds and chargebacks

The monthly CSV presents refunds and chargebacks alongside quantity, so they are most plausibly counts there. Daily `refunds` is also treated as a count.

**Evidence level: fixture-backed zero case only.** Both monthly and daily fixtures contain numeric/count-like zero `refunds` and `chargebacks`, but no non-zero response was captured. Endpoint-dependent amount semantics have not been excluded.

### Wishlists

The analytics CSV includes a package with `Wishlisted = -1` for the selected period. That proves the portal's aggregate wishlist metric can be negative and therefore represents a net change, not gross additions alone.

Daily `wishlisted` is assumed to be the additive daily component of that net change. This mapping has not been reconciled against an export.

### Downloads and users

The retained monthly response distinguishes nullable `free_downloads` from
`free_users`. It also distinguishes `entitled_downloads` from `entitled_users`.
Each pair has first and last timestamps. The extension sums the download fields
as events. It sums the user fields as users.

The distinct fields support the inference that downloads are events, not unique
users. The daily endpoint exposes only `downloads`. Its event definition remains
unconfirmed. The retained monthly array has a deliberate limit. Thus, it cannot
support a catalog-total download reconciliation.

### Currency

All sales, daily, and revenue-ledger records are stamped `currency: "USD"`, and all money is formatted as USD. The normalizers do not read a currency field from Unity.

The original account's CSV exports used `$`, so USD was **observed once on one publisher account**. There is no evidence of a platform-wide USD guarantee, settlement-currency rule, or behavior for publishers in other countries. Fixed USD is a potentially serious semantic error until verified or made data-driven.

## Publisher identity and isolation

The interface requires `publisherId` before it opens a local workspace.
IndexedDB uses one physical database. Each record contains the publisher ID, and
each record query uses the publisher index. Sync checkpoints use
publisher-qualified keys. Local preferences and cached presentation metadata
also use publisher-qualified keys.

Page activation increments the workspace generation. It loads only the active
publisher's records. A sync captures the publisher ID and generation when it
starts. Each batch checks the local generation before it writes data.

The extension does not poll the Portal identity. A new full sync checks the
identity before it clears local analytics. If this check fails, the active
workspace and its local data remain visible.

Clearing local data first invalidates active sync work. It then deletes only the
active publisher's records and sync checkpoint. It does not clear preferences
or package groups. The empty workspace shows the full-sync action.

This behavior is implemented but has not yet been exercised against a second live publisher account. Until that test is retained, the endpoint-derived boundary is supported by Portal-bundle evidence rather than multi-account observation.

## Meaning of “complete history”

Today, a full sync is marked complete when:

1. Package discovery and the revenue ledger succeeded.
2. Every scheduled monthly sales and download request returned without throwing.
3. Every scheduled daily request for the catalog and the package snapshot returned without throwing.
4. The loops reached their end cursors.

It does **not** verify:

- That every expected package scope was returned.
- That every requested date is present or explicitly zero.
- That package history starts at the true earliest retained date.
- That monthly and daily gross, sales, or refunds reconcile.
- That partial current months are distinguishable from complete months.
- That an endpoint returned a plausible non-empty shape.
- That records belong to the active publisher.
- That Unity did not silently omit a range.

There is no persisted coverage manifest or gap map. The UI's “complete” and “up to date” language therefore describes request-loop completion, not audited data completeness.

A trustworthy definition must require a publisher namespace and an expected
scope manifest. It must verify half-open windows and define missing values and
zero values. It must persist request coverage and include selected reconciliation
checks. Users must see partial current months and the daily freshness lag.

## Incremental sync and catalog changes

The incremental path discovers the current catalog. It starts an existing scope
at its last daily record. It starts a newly discovered package at its recorded
publication date. If a new package has no publication date, the refresh fails
instead of reporting completion. Consequences:

- **New package:** daily sync starts at `first_published_at`. The current
  `2019-01-01` floor and two-day freshness delay still apply.
- **Renamed package:** matching by package ID can find the cursor, but new daily record IDs include the new package name. An overlapped date can coexist with the old-name record and be double-counted. Older rows keep the old name.
- **Unpublished/removed package:** The extension no longer refreshes it because
  the current catalog does not contain it. Historical rows remain.
- **Category change:** new or overwritten recent rows can receive the new category while older history keeps the previous category. No effective-date model exists.
- **Historical correction:** only the latest daily date and current monthly report are refreshed. Older corrections are missed.
- **Package identifier change or metadata mismatch:** may create a new logical package or lose its category mapping.

The repository now defines the new-package start policy. Live release behavior
is not validated. The other cases remain prototype gaps.

## Category-mapping evidence

The retained metadata fixture uses a scalar string under `category`. The value
can be an ID, slug, or name because the fixture replaces private values.

One earlier live response used a nested `category` object. No fixture retains
that shape. This variant is **Observed once**.

The implementation matches several identifier fields. It uses an exact
normalized package name as a fallback. Duplicate names, identifier namespaces,
metadata versions, pagination, and category changes remain risks.

## Required evidence work

Before treating the numbers as production-trustworthy:

1. Extend fixture-driven normalizer tests to the remaining canonical fields and unknown-shape failures before changing their mappings.
2. Capture the missing empty account and empty period variants. Also capture
   non-zero refunds, chargebacks, and negative daily wishlist movement. Capture
   rating values, multiple price rows, later metadata pages, and nested category
   objects. Capture each localized number or currency form.
3. Complete the three-request daily boundary suite around known active and inactive dates.
4. Reconcile at least three complete months. Use a paid-only month, a free-heavy
   month, and a refund-bearing month. Compare all package and catalog daily
   responses. Also compare monthly reports and Portal CSV exports.
5. Validate new-package bootstrap during a live release. Measure data revisions
   by snapshotting recent days and months over several weeks.
6. Validate currency and `publisherId` stability across at least two publisher accounts, including a live switch with separate local histories.
7. Replace request-loop “complete” with persisted, publisher-scoped coverage assertions.
