# Runtime architecture

This document maps the extension and the boundaries that a change must preserve.
It describes the current implementation. [`VISION.md`](../VISION.md) describes
product intent. [`DATA-EVIDENCE.md`](DATA-EVIDENCE.md) describes data semantics.
[`DECISIONS.md`](DECISIONS.md) records accepted and provisional policies.

## Runtime contexts

Publisher Analytics+ is a Manifest V3 extension with four runtime contexts:

| Context | Files | Responsibility |
|---|---|---|
| Publisher Portal page world | `api-client.js` | Performs allowlisted same-origin requests with the signed-in Portal session. |
| Publisher Portal content-script world | `portal-bridge.js`, `portal-launcher.css` | Shows the Analytics launcher and relays requests between the extension page and the Portal page world. |
| Extension page | `analytics.html`, bundled `content.js`, `styles.css`, `vendor/echarts.min.js` | Owns workspace loading, sync, preferences, groups, aggregation, rendering, and exports. It reads saved rows from IndexedDB directly. |
| Extension background context | `background.js` | Owns IndexedDB writes, package icon downloads and caching, sync metadata persistence, and toolbar-driven opening behavior. |

`content-src/` holds the content script source in nine focused files. `publisher-workspace.js` owns publisher identity, preferences, workspace initialization, and recovery. `local-storage.js` owns IndexedDB reads. `publisher-api.js` owns Portal requests and response normalization. `sync.js` owns scheduling and checkpoints. The build
joins them into `content.js`. The extension loads that one bundled file. Edit
the source files. Do not edit the generated bundle directly. Run
`npm run build:content` to rebuild it.

`manifest.json` is the canonical declaration of these contexts. Packaging uses
the same runtime files for Chrome and Firefox. The packaging scripts generate
the target-specific manifest differences.

## Request path

```text
analytics extension page API definition and caller
  -> UPA_PORTAL_API runtime message
  -> background checks the Portal tab and relays the request
  -> portal-bridge.js UPA_API_REQUEST window message
  -> api-client.js allowedRequest()
  -> same-origin publisher.unity.com fetch
  -> UPA_API_RESPONSE window message
  -> portal-bridge.js runtime response
  -> analytics page validation and normalization
```

The page-world bridge exists because requests use the active Publisher Portal
session. `api-client.js` is also a security boundary: it rejects origins,
methods, paths, query forms, and request bodies outside its explicit allowlist.
A new endpoint requires an updated caller and a narrow allowlist. Tests must
cover both changes.

The Portal content script also adds a small fixed launcher. Its click sends
`UPA_OPEN_ANALYTICS_FROM_PORTAL` to the background context. The background
checks the sender tab origin before opening `analytics.html` with that Portal
tab ID. Keep the Portal injection limited to this launcher and the request
bridge; analytics rendering belongs to the extension page.

Analytics API requests depend on the Portal tab passed to the extension page.
If that tab closes, the current request fails. Full sync saves each completed
step. When the bridge confirms that the Portal tab is unavailable, Continue
opens a new Portal tab. The Portal launcher then opens Analytics with the new
tab ID, and the page resumes the saved full-sync checkpoint. After that page
loads the publisher workspace, the background closes the old Analytics tab.
A failure during initial preparation repeats preparation. Incremental refresh
keeps saved rows and can be run again after the Portal is available.

Authentication material belongs only to the live page request. Do not put
cookies, CSRF values, authorization values, or session headers in retained
artifacts. Raw API responses can be retained as development evidence.

To sanitize a fixture means to make an evidence copy of a real response with
selected values changed or removed. Never retain authentication material or
unrelated sensitive data. Public package IDs, names, and icon URLs may remain
when they preserve API behavior and cross-fixture relationships. This process
is outside the runtime data path. The extension does not apply fixture changes,
date changes, or array limits to live or stored publisher data.

## Data path

```text
Unity JSON response
  -> endpoint-specific normalizer in content.js
  -> publisher-owned normalized record
  -> UPA_DB_PUT_MANY extension message
  -> ownership check in background.js
  -> IndexedDB records store
  -> direct publisher-indexed IndexedDB query from analytics.html
  -> aggregation and rendering in content.js
  -> optional local JSON export
```

Each analytics record and sync checkpoint must include a non-empty
`publisherId`. Page activation assigns that ID to the local workspace. A sync
job keeps the same ID and workspace generation for its full lifetime. Each
batch checks the local generation before it writes data.

## Storage ownership

| Data | Owner | Boundary |
|---|---|---|
| Normalized analytics records | IndexedDB `records` store in `background.js` | Indexed and queried by `publisherId` |
| Current package icon bytes | IndexedDB `icons` store in `background.js` | Publisher and package key; URL changes refresh the cached image; clearing analytics removes that publisher's icons |
| Resumable sync checkpoint | IndexedDB `meta` store in `background.js` | Composite identity derived from publisher ID and metadata key |
| Preferences | Extension local storage from `content.js` | Publisher-qualified key |
| Publisher presentation details | Extension local storage from `content.js` | Publisher-qualified key |
| Package groups | Extension local storage from `content.js` | Publisher-qualified key and deliberately separate from analytics clearing |
| Toolbar open-on-load request | Extension session storage from `background.js` | Tab-qualified, short-lived key |

Changing storage ownership requires checking publisher switching, in-flight
sync, clearing, export, and browser-profile behavior together.

Workspace activation confirms identity through the Portal API before opening
the publisher index in IndexedDB. One `getAll` request returns the full history
to the analytics page. This avoids JSON size measurement, page cursors, and
large runtime messages for reads. The page still waits for the full history
before rendering analytics. A generation change discards a result if the
active workspace changes. The read is not a cross-tab snapshot. Writes reject
records whose `publisherId` does not match the requested publisher.

Workspace activation loads the checkpoint before the records. Failure stages
separate identity, preferences, checkpoint, record loading, and rendering.
The recovery screen does not calculate analytics. It permits Settings, appearance
changes, report download, retry, and return to the Portal. It does not permit
analytics export, clearing, or sync before the workspace is ready.

Diagnostics retain at most 60 events in page memory. A failed full sync also
stores a failure summary and 12 recent events in its publisher-scoped checkpoint.
Publisher changes reset the event list. Stale requests do not add events to the
new workspace. See [EXPORTS.md](EXPORTS.md#support-reports) for the report fields.

The resumable sync job also stores the discovered package list and each current
icon URL. The sync reads the icon from `package_key_images` by published version
ID, then joins it to the discovered package ID. When an icon is shown, the
background context downloads its bytes from the observed Asset Store CDN and
stores them in the publisher-scoped `icons` store. The interface reads the
stored image and uses the package initial if no icon is available. Icon bytes do
not enter analytics records or JSON exports. Clearing a publisher's analytics
also clears that publisher's icon cache.

## Sync ownership

The full-history path currently does these tasks:

1. Discovers the active publisher and current packages.
2. Fetches the revenue ledger to help select the account start date.
3. Schedules monthly sales and download requests.
4. Schedules catalog-wide and per-package daily requests in date windows.
5. Stores normalized batches and a resumable checkpoint.
6. Marks the job complete after the scheduled request loops finish.

The incremental path refreshes the current monthly reports and revenue ledger.
It starts each existing daily scope at its latest stored date. It starts a newly
discovered package at its publication date. [`DATA-EVIDENCE.md`](DATA-EVIDENCE.md)
and [`VALIDATION.md`](VALIDATION.md) record known coverage and lifecycle limits.
This architecture description does not prove that the resulting history is complete.

The content script does not poll the publisher identity. Page activation checks
the identity before it loads or resumes a workspace. A new full sync checks the
identity before it clears local analytics. Sync loops do not request identity
between analytics batches.

A full-sync request failure makes the job inactive. The saved job keeps its
phase, cursor, scope, and completed-step count. The Continue action retries the
failed request. It does not clear committed records or start a new job. An
incremental refresh does not run while this checkpoint is incomplete.

## File ownership and change map

| Concern | Primary files | Also inspect |
|---|---|---|
| Request route, method, query, or body | `content-src/publisher-api.js`, `api-client.js` | `internal-docs/api-fixtures/request-shapes.json`, `scripts/validate-publisher-isolation.js` |
| Response fields and normalization | `content-src/publisher-api.js` | fixtures, provenance, `scripts/validate-api-fixtures.js`, `EXPORTS.md` |
| Sync scheduling, coverage, or resume | `content-src/sync.js`, `background.js` | `DATA-EVIDENCE.md`, `DECISIONS.md`, `VALIDATION.md` |
| Publisher identity or ownership | `content-src/publisher-workspace.js`, `background.js`, `api-client.js` | `scripts/validate-publisher-isolation.js`, fixture evidence |
| Stored or exported schema | `content-src/local-storage.js`, `content-src/publisher-api.js`, `background.js` | `EXPORTS.md`, migration and clearing behavior |
| Analytics interpretation | `content-src/analytics-models.js` | `DATA-EVIDENCE.md`, `DECISIONS.md`, reconciliation fixtures |
| Charts and presentation | `content-src/charts.js`, `content-src/workspace-ui.js`, `styles.css`, `scripts/echarts-entry.js` | `DESIGN.md`, `RENDERING.md`, marketing fixture |
| Browser packaging | `manifest.json`, packaging scripts | `DEVELOPMENT.md`, `SCRIPTS.md` |

Follow [`DATA-SOURCES.md`](DATA-SOURCES.md) for a new endpoint or
previously unseen account capability. Do not treat adding a constant to the
`API` object as a complete integration.

## Invariants

- API requests remain limited to `publisher.unity.com`. Image loads may use
  `assetstorev1-prd-cdn.unity3d.com` for public package icons. No other runtime
  network access is allowed.
- The request bridge remains narrowly allowlisted.
- Every local analytics read and write remains publisher-scoped and fails
  closed without identity.
- Current package names, categories, or eligibility must not replace stable
  identifiers or be projected backward without an explicit evidence-backed
  policy.
- Unknown response shapes must not silently become trustworthy zero values.
- User-facing claims must not be stronger than retained evidence.
- Dependencies remain bundled locally.

## Why the page-world bridge exists

The analytics page cannot read the Portal page's session cookies or DOM. Portal
requests need the active page session. `portal-bridge.js` relays requests from
the extension page to `api-client.js`, which runs in the Portal page world.
The page-world script accepts only known request shapes and returns parsed
responses through the bridge.

Live API investigation uses browser CDP from a signed-in Portal tab. It does not
require an extension change. Follow [`DATA-SOURCES.md`](DATA-SOURCES.md).

## Coupling that is easy to miss

Some changes look local in the source but affect several owners:

| Change | Coupled work |
|---|---|
| Request path, method, query, or body | Update the `content.js` caller and the `api-client.js` allowlist. Update the request-shape record, provenance, and request validation. |
| New package or capability scope | Define discovery, stable identity, full-sync scheduling, incremental bootstrap, progress totals, resume state, and absence behavior. |
| New response field or container | Validate the shape before normalization. Then check record identity, storage, aggregation, export, UI labels, and fixture tests. |
| Package name or category mapping | Check record IDs and history. Current record IDs include the package name. Thus, a rename can create a second record for the same event. Each new row receives current category metadata. Thus, a category change can split historical attribution. |
| New normalized record type | Define publisher ownership, clear behavior, queries, coverage, aggregation, exports, and compatibility with existing IndexedDB data. |
| Optional source | Keep its availability and completion state separate from core history. A missing capability, an empty result, and a failed request are different states. |
| Identity or database change | Check active-publisher switching, in-flight writes, checkpoints, preferences, groups, clearing, and exports together. |

Package discovery controls the earliest known publication date. It also controls
the set of daily package scopes. Thus, a package-field change can change data
labels and the requested history range. The same start-date calculation uses
the revenue ledger, although the ledger uses a different record type.

## Deliberate and accidental boundaries

The first implementation also tried Portal DOM data, CSV input, and passive
page-response interception. These paths were removed when the project selected
the Publisher Portal API as its single source. This was a deliberate reduction
of duplicate normalization and provenance paths. Do not add one of these paths
as a silent fallback.

The broad response aliases, fixed sync constants, presentation fields in record
IDs, and loop-based completion state were the first forms that worked. They are
not demonstrated Unity contracts. Their evidence and risks are owned by
[`DATA-EVIDENCE.md`](DATA-EVIDENCE.md), [`DECISIONS.md`](DECISIONS.md), and
[`VALIDATION.md`](VALIDATION.md).
