# Unity data evidence and semantics

Status: evidence audit updated 2026-08-18.

This document records evidence about the undocumented Unity Publisher Portal
APIs that Publisher Analytics+ uses. It distinguishes prototype behavior from a
verified data contract.

The evidence available for this audit was:

1. The repository and its commit history from the initial implementation onward.
2. The original Codex task history, including the publisher's pasted CSV exports and troubleshooting messages.
3. Successful use of the extension on the original signed-in publisher account.
4. A fresh signed-in capture of the active-publisher response and all eight analytics endpoints. The browser removed secrets and replaced private values before the responses were retained under [api-fixtures](api-fixtures/README.md).

The original development task retained no API responses. On 2026-08-18, a temporary
opt-in local helper repeated the requests on the original account. The helper
parsed each response in the Portal page. It removed secrets and replaced private
values before output. It did not log or save authentication material or raw
responses. The retained fixtures therefore provide direct evidence for keys,
JSON types, and nesting on one account. Each provenance file records array
limits, changed values, and evidence limits.

## Executive assessment

- The endpoint paths, request shapes, response containers, and primary field names are now **fixture-backed on one account**.
- Published packages use `first_published_at`. The package normalizer reads this field as the publication date.
- Most camelCase variants and semantic synonyms accepted by `valueFrom()` are **defensive**, not demonstrated response variants.
- A retained month response includes `start_date` through `end_date - 1`. It
  excludes `end_date`. This response supports half-open handling for that one
  request. The paired boundary suite is still missing.
- In the retained package response, inactive dates were present as explicit empty objects `{}`. No omitted-day variant or explicit all-zero inactive object has been captured.
- The 2019 retention floor, two-day freshness delay, 365-day window, USD currency, and one-day incremental overlap are **provisional policies**, not verified platform contracts.
- The Portal's `publisherId` defines publisher ownership. This value isolates
  records, sync checkpoints, and preferences. A missing identity fails closed.
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

The original development task also records two rejected variants:

- A request routed through `/publisher-v2-api/proxy` returned HTTP 400. The exact rejected target and parameters were not retained.
- `/publisher-v2-api/dashboard/daily` returned HTTP 400 before the working request form was reached. The response body and precise change that resolved it were not retained.

These failures establish that routing and payload shape matter, but they are not sufficient to document Unity's full validation rules.

## Request provenance and session-only observations

The current request inventory has two evidence layers:

- **Confirmed:** The request-shape file, captured fixtures, provenance files, and
  current allowlist agree. They support the methods, paths, query forms, and
  bodies in the endpoint inventory. The retained daily request also
  confirms string package IDs, ISO UTC midnight values without milliseconds,
  and one half-open month response on one account.
- **Unknown:** the investigation did not isolate which request headers are
  required. The current page-world client sends the CSRF token,
  `Content-Type: application/json`, `X-Source: publisher-portal`, and included
  credentials as one working set. Do not remove or generalize a header based on
  its name alone.

The earlier development task contains one **Observed once** script-bundle
reference to `/publisher-v2-api/dashboard/package`. No exact caller, method,
request body, response, UI purpose, or live request was retained. The route was
never integrated. It is not part of the current endpoint inventory and must be
rediscovered before use.

The Chrome fixture task also records failed browser-control attempts to send an
`UPA_API_REQUEST` message from its safe evaluation layer. The attempts did not
produce an HTTP status or response body. They show a browser-control execution
boundary, not a Unity endpoint failure. A capability check found no suitable
read-only network interface. It also found no suitable debug interface in that
tool version. Thus, the task used the temporary page-world capture method in
[DATA-SOURCE-WORKFLOW.md](DATA-SOURCE-WORKFLOW.md#lessons-from-the-retained-chrome-investigation).

No endpoint for Asset Store bundles was observed in either retained fixture
evidence or the Chrome fixture task. Its path, method, eligibility model,
response shape, and empty-state behavior are **Unknown**.

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
boundary. The extension checks the active identity before it commits a fetched
batch. It does not load or sync a workspace when it cannot identify the
publisher.

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

### Incremental overlap and revisions

Incremental sync begins at the latest stored daily date for each existing scope, so it re-fetches that one date. It does not intentionally revisit a wider recent window.

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

A publisher change increments the workspace generation. It immediately hides
the previous workspace and loads only the new publisher's records. An active
sync checks the generation and current Portal identity before it commits a
batch. An identity lookup failure hides local analytics until the extension can
identify the owner again.

Clearing local data deletes only the active publisher's records and sync
checkpoint. It does not clear preferences. Future package groups must also use a
durable key or store that the analytics-clear operation does not change.

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

The incremental path discovers the current catalog, then looks for the last daily record of each scope. If none exists, it skips that scope. Consequences:

- **New package:** skipped entirely until a full resync because it has no last daily record.
- **Renamed package:** matching by package ID can find the cursor, but new daily record IDs include the new package name. An overlapped date can coexist with the old-name record and be double-counted. Older rows keep the old name.
- **Unpublished/removed package:** The extension no longer refreshes it because
  the current catalog does not contain it. Historical rows remain.
- **Category change:** new or overwritten recent rows can receive the new category while older history keeps the previous category. No effective-date model exists.
- **Historical correction:** only the latest daily date and current monthly report are refreshed. Older corrections are missed.
- **Package identifier change or metadata mismatch:** may create a new logical package or lose its category mapping.

The original development task recorded no intended policy for these cases. They
are prototype gaps, not validated behavior.

## Category-mapping evidence

The category implementation evolved through several live troubleshooting steps:

1. Read a category or category ID from the once-published package response.
2. Fetch `/management/categories` and map IDs to display names.
3. Fetch paginated `/management/packages` metadata. Find `package_id` and
   `category_id`.
4. Broaden matching across package ID, genesis product ID, product ID, generic ID, and normalized package name.
5. Add temporary diagnostics for response keys, metadata keys, row counts, assignment counts, and category-definition counts.
6. Parse the live category assignment as an object under `category`, not only a scalar ID.
7. Remove diagnostics after the user reloads the extension and confirms the
   categories. Then make category grouping the default.

The original development task did not retain the diagnostic output or raw
category object. The 2026-08-18 package-metadata fixture adds a second observed
shape. Each retained row had a scalar string under `category`. Redaction prevents
identification as an ID, slug, or display name. Only the earlier code change and
task result support the nested-object variant.

Known risks include ambiguous name matching and duplicate names. Other risks
include multiple metadata versions, different ID namespaces, and category
changes. Pagination changes and packages without a category are also risks. No
test used a second account to find response variants.

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
5. Measure data revisions by snapshotting recent days and months over several weeks.
6. Validate currency and `publisherId` stability across at least two publisher accounts, including a live switch with separate local histories.
7. Replace request-loop “complete” with persisted, publisher-scoped coverage assertions.
