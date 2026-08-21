# Runtime architecture

This document maps the extension and the boundaries that a change must preserve.
It describes the current implementation. [`VISION.md`](../VISION.md) describes
product intent. [`DATA-EVIDENCE.md`](DATA-EVIDENCE.md) describes data semantics.
[`DECISIONS.md`](DECISIONS.md) records accepted and provisional policies.

## Runtime contexts

Publisher Analytics+ is a Manifest V3 extension with three runtime contexts:

| Context | Files | Responsibility |
|---|---|---|
| Publisher Portal page world | `api-client.js` | Performs explicitly allowlisted same-origin requests with the signed-in Portal session and returns parsed responses through `window.postMessage`. |
| Extension content-script world | `content.js`, `styles.css`, `vendor/echarts.min.js` | Owns identity activation, API orchestration, normalization, sync, preferences, package groups, aggregation, rendering, and exports. |
| Extension background context | `background.js` | Owns publisher-scoped IndexedDB access, sync metadata persistence, and toolbar-driven opening behavior. |

`manifest.json` is the canonical declaration of these contexts. Packaging uses
the same runtime files for Chrome and Firefox. The packaging scripts generate
the target-specific manifest differences.

## Request path

```text
content.js API definition and caller
  -> UPA_API_REQUEST window message
  -> api-client.js allowedRequest()
  -> same-origin publisher.unity.com fetch
  -> UPA_API_RESPONSE window message
  -> content.js validation and normalization
```

The page-world bridge exists because requests use the active Publisher Portal
session. `api-client.js` is also a security boundary: it rejects origins,
methods, paths, query forms, and request bodies outside its explicit allowlist.
A new endpoint requires an updated caller and a narrow allowlist. Tests must
cover both changes.

Authentication material belongs only to the live page request. Do not put
cookies, CSRF values, session headers, or raw private responses in retained
artifacts. Retained artifacts include fixtures, logs, commits, and exports.

To sanitize a fixture means to make a safe evidence copy of a real response. The
capture process removes secrets and replaces private values in that copy. This
process is outside the runtime data path. The extension does not apply fixture
replacements, date changes, or array limits to live or stored publisher data.

## Data path

```text
Unity JSON response
  -> endpoint-specific normalizer in content.js
  -> publisher-owned normalized record
  -> UPA_DB_PUT_MANY extension message
  -> ownership check in background.js
  -> IndexedDB records store
  -> publisher-scoped query
  -> aggregation and rendering in content.js
  -> optional local JSON export
```

Each analytics record and sync checkpoint must include a non-empty
`publisherId`. The extension checks the active identity before it commits a
fetched batch. A publisher change replaces the visible workspace. It also
invalidates work from the previous workspace generation.

## Storage ownership

| Data | Owner | Boundary |
|---|---|---|
| Normalized analytics records | IndexedDB `records` store in `background.js` | Indexed and queried by `publisherId` |
| Resumable sync checkpoint | IndexedDB `meta` store in `background.js` | Composite identity derived from publisher ID and metadata key |
| Preferences | Extension local storage from `content.js` | Publisher-qualified key |
| Publisher presentation details | Extension local storage from `content.js` | Publisher-qualified key |
| Package groups | Extension local storage from `content.js` | Publisher-qualified key and deliberately separate from analytics clearing |
| Toolbar open-on-load request | Extension session storage from `background.js` | Tab-qualified, short-lived key |

Changing storage ownership requires checking publisher switching, in-flight
sync, clearing, export, and browser-profile behavior together.

## Sync ownership

The full-history path currently does these tasks:

1. Discovers the active publisher and current packages.
2. Fetches the revenue ledger to help select the account start date.
3. Schedules monthly sales and download requests.
4. Schedules catalog-wide and per-package daily requests in date windows.
5. Stores normalized batches and a resumable checkpoint.
6. Marks the job complete after the scheduled request loops finish.

The incremental path refreshes the current monthly reports and revenue ledger,
then resumes each existing daily scope from its latest stored date. Known
coverage and lifecycle limits are recorded in
[`DATA-EVIDENCE.md`](DATA-EVIDENCE.md) and
[`VALIDATION.md`](VALIDATION.md). This architecture description does not prove
that the resulting history is complete.

## File ownership and change map

| Concern | Primary files | Also inspect |
|---|---|---|
| Request route, method, query, or body | `content.js`, `api-client.js` | `internal-docs/api-fixtures/request-shapes.json`, `scripts/validate-publisher-isolation.js` |
| Response fields and normalization | `content.js` | fixtures, provenance, `scripts/validate-api-fixtures.js`, `EXPORTS.md` |
| Sync scheduling, coverage, or resume | `content.js`, `background.js` | `DATA-EVIDENCE.md`, `DECISIONS.md`, `VALIDATION.md` |
| Publisher identity or ownership | `content.js`, `background.js`, `api-client.js` | `scripts/validate-publisher-isolation.js`, fixture evidence |
| Stored or exported schema | `content.js`, `background.js` | `EXPORTS.md`, migration and clearing behavior |
| Analytics interpretation | `content.js` | `DATA-EVIDENCE.md`, `DECISIONS.md`, reconciliation fixtures |
| Charts and presentation | `content.js`, `styles.css`, `scripts/echarts-entry.js` | `DESIGN.md`, `RENDERING.md`, marketing fixture |
| Browser packaging | `manifest.json`, packaging scripts | `DEVELOPMENT.md`, `SCRIPTS.md` |

Follow [`DATA-SOURCE-WORKFLOW.md`](DATA-SOURCE-WORKFLOW.md) for a new endpoint or
previously unseen account capability. Do not treat adding a constant to the
`API` object as a complete integration.

## Invariants

- Runtime network access remains limited to `publisher.unity.com`.
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

The content script runs in an isolated extension world. An early direct request
from that world returned HTTP 400. The exact rejected proxy target, parameters,
and response body were not retained. This is **Observed once**. It does not prove
which session rule caused the rejection.

The working design puts `api-client.js` in the Publisher Portal page world. It
uses the page origin and the active Portal session. The content script sends a
request description through `window.postMessage`. The page-world script accepts
only known request shapes and returns the parsed result.

The Chrome control investigation confirmed a second boundary. The control tool
could select the signed-in tab and inspect safe page state. Its safe evaluation
layer did not permit arbitrary page scripts or session-data access. Direct use
of the existing message bridge did not capture a response. The available
browser capabilities did not provide a suitable read-only network log.
Therefore, the task used a temporary, opt-in page-world capture helper. The task
removed the helper after it retained the safe fixtures.

Do not use a top-level API URL, a direct isolated-world `fetch`, or arbitrary
browser evaluation as proof that an endpoint does not exist. These methods can
fail before Unity evaluates the endpoint. Reproduce the request in the same page
world as the Portal, through the narrow bridge or an equivalent temporary
allowlisted helper.

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
