# Undocumented data-source workflow

Use this workflow for a Unity Publisher Portal data source that lacks retained
evidence. A data source can be an endpoint, field, metric, report, or account
capability. This workflow also covers features that only selected publishers
can access.

A successful request is only one requirement. The result must also have a
traceable origin and safe retained evidence. It must define semantic limits,
publisher isolation, absence behavior, and proportionate validation.

## 1. Establish the question

Before browser investigation, state:

- The publisher question that the data could answer.
- The Portal surface or user action that could expose the data.
- Whether the data is catalog-wide, package-specific, time-based, or capability-based.
- The facts that repository evidence already supports.
- The account states that are available for tests.

Read [`ARCHITECTURE.md`](ARCHITECTURE.md),
[`DATA-EVIDENCE.md`](DATA-EVIDENCE.md),
[`DECISIONS.md`](DECISIONS.md), and [`VALIDATION.md`](VALIDATION.md). Search the
source and fixture manifest before assuming the route is new.

## 2. Discover without retaining credentials

Use an authorized, signed-in Publisher Portal session. Observe one controlled
Portal action at a time. This method separates the triggering request from
unrelated background traffic. Record only the information that reproduces and
assesses the behavior:

- Portal page and action.
- Request method, path, query, and JSON body.
- Response status and parsed JSON shape.
- Relevant timing, pagination, range, and scope behavior.
- The account state in which the request occurred.

Do not retain cookies, CSRF tokens, authorization or session headers, email
addresses, a general HAR export, or unrelated traffic. Before a browser agent
copies a response, it must make a safe evidence copy. It must remove secrets.
It must replace private identities and values. It must not copy the raw response
into the repository or an agent message.

Record failed request variants when they materially establish routing, payload,
authorization, or boundary behavior. A successful request alone does not prove
why it succeeded or how other accounts behave.

### Browser investigation sequence

Use this sequence for a new Portal surface:

1. Open the signed-in Portal page that shows the feature. Record the page, the
   visible controls, and the known account state.
2. Take a DOM snapshot or screenshot before the action. This records whether the
   feature is absent, disabled, empty, active, or historical in the UI.
3. In DevTools, clear the Network log. Select `Fetch/XHR`. Filter first for
   `publisher-v2-api`. Narrow the filter with the visible feature name or terms
   such as `dashboard`, `management`, `monthly`, `revenue`, `download`, or
   `package`.
4. Perform one Portal action. For example, open a feature tab or change one
   month. You can also change one date range, package, status filter, or page.
5. Save only the matching method, path, query, JSON body, status, and response
   shape. Do not save a general HAR file.
6. Repeat the action with one variable changed. Compare catalog and package
   scope, two adjacent date ranges, an active and inactive period, or two pages.
7. Search the loaded Portal scripts for the exact path only when the UI does not
   issue a visible request. Use the caller to find body construction, query
   serialization, feature gates, and pagination. A script literal is
   **Observed once** until a live request or a retained fixture confirms it.
8. Reproduce the request in the Portal page world. Use the extension bridge when
   its allowlist already covers the request. Use a temporary narrow helper when
   discovery or safe capture needs a route that is not yet integrated.

Keep the Network log while you repeat one comparison. Sort or compare requests
by path and initiator. Disable the cache only for a loaded-script comparison.
Portal background polling can appear related. Use the action time and initiator
chain to identify the request that the action caused.

Do not interpret failure from the wrong execution context as endpoint evidence.
An isolated content-script request, a top-level API navigation, or a browser
control evaluation can fail because it does not have the Portal page-world
context. Record the execution context with every failed reproduction.

## 3. Separate capability from data

For publisher-selective features, distinguish these states instead of mapping
all absence to an empty result:

| State | Minimum evidence to seek |
|---|---|
| Feature unavailable | Record the absent or disabled UI and any explicit capability response. No request after an action is not sufficient proof by itself. |
| Eligible but empty | Record the available UI and successful request. Confirm that the response has the valid empty container for a known empty filter or period. |
| Active participation | Retain a successful non-empty response with stable identifiers, lifecycle state, dates, and relationships. |
| Historical or expired participation | Test an expired item or historical filter. Record whether the UI and API preserve history and how the lifecycle state is represented. |
| Authentication failure | Compare the candidate request with a known working Portal request in the same tab. Record 401, session redirect, or equivalent evidence. |
| Permission failure | Record a distinct 403 or explicit permission result while another signed-in request works. Do not convert it to an empty result. |
| Endpoint or schema change | Confirm that the known page and session still work. Record the changed status or shape and make normalization fail visibly. |
| Legitimate empty response | Confirm success status and the expected empty container. When possible, repeat the same request shape for a non-empty period or eligible account. |

Do not infer non-participating behavior from a participating account. If only
one state can be tested, record the others as unknown and design the integration
to fail closed. Do not encode these states as synthetic zero-valued analytics
records. If you integrate the source, store its availability separately from
its data rows. Also store the last successful coverage separately.

## 4. Define semantics before storage

For every candidate field or record type, establish or explicitly leave unknown:

- Stable identity and its namespace.
- Publisher ownership.
- Package or catalog relationship.
- Event date, reporting period, time zone, and range boundaries.
- Lifecycle states and pagination.
- Meanings of units, currency, signs, nulls, empty values, omitted values, and zeros.
- Whether values are snapshots, events, cumulative totals, or revisions.
- Whether current metadata is safe to apply to historical data.
- Values that another Portal view or export can reconcile.

Field names and UI labels are clues, not contracts. Use the evidence labels in
[`README.md`](README.md): Confirmed, Observed once, Inferred, and Unknown.

## 5. Retain safe evidence

Before editing fixtures, read
[`api-fixtures/AGENTS.md`](api-fixtures/AGENTS.md) and
[`api-fixtures/README.md`](api-fixtures/README.md).

To sanitize a response means to make a safe evidence copy. Remove secrets.
Replace private identities and values. Preserve only the response structure and
relationships that the evidence needs. Record every change in the provenance
file.

This process applies only to evidence files in the repository. It is not an
ingestion rule. It must not change dates, values, or identities in live
publisher data. Marketing screenshots use separate fictional data. They are not
part of this capture workflow.

For a captured source, normally add or update:

1. A captured response fixture that is safe to retain.
2. Its `<fixture>.provenance.json` sidecar.
3. `api-fixtures/manifest.json`.
4. `api-fixtures/request-shapes.json`.
5. Fixture-driven validation for fields that the implementation will consume.

Use `api-fixtures/provenance.template.json` as a structural starting point. A
synthetic example may test defensive behavior but cannot establish Unity
behavior.

## 6. Design the integration across boundaries

Use the change map in [`ARCHITECTURE.md`](ARCHITECTURE.md). A typical new source
requires deliberate decisions in each applicable layer:

- Narrowly allowlisted request shape in `api-client.js`.
- API declaration and caller in `content.js`.
- Response validation and normalization.
- Stable record identity and publisher ownership.
- Full and incremental sync scheduling, retry, resume, and coverage behavior.
- Storage clearing and schema compatibility.
- Aggregation, export, and publisher-facing availability states.
- Fixture, isolation, and integration tests.
- Evidence, decision, validation, and export documentation.

If the source is optional, its failure must not corrupt or overstate the
completion of unrelated core history. Decide whether it is required,
best-effort, separately resumable, or explicitly unsupported before adding it
to the sync job.

## 7. Update durable knowledge by type

| Knowledge | Destination |
|---|---|
| Runtime wiring and files that change together | `ARCHITECTURE.md` |
| Reusable discovery and integration procedure | `DATA-SOURCE-WORKFLOW.md` |
| Observed endpoint, field, boundary, and metric facts | `DATA-EVIDENCE.md` and fixtures |
| Accepted or provisional product/data policy | `DECISIONS.md` |
| Untested states, known failures, and evidence backlog | `VALIDATION.md` |
| Normalized stored or exported schema | `EXPORTS.md` |
| Commands and test coverage | `SCRIPTS.md` |

Avoid chronological session notes when a durable statement fits one of these
owners. Preserve chronology only when it explains evidence provenance or why a
decision cannot be reconstructed otherwise.

## 8. Completion standard

A data-source change is ready for review only when:

- the source request is reproducible without retained credentials.
- consumed response fields have a safe captured fixture or an explicit
  synthetic test fixture.
- semantics and untested states are labeled honestly.
- publisher ownership and absence behavior are defined.
- the request allowlist is no broader than the demonstrated request shape.
- normalization and unknown-shape behavior are tested.
- sync and coverage consequences are documented.
- exports and UI do not overstate the evidence.
- the applicable repository checks pass.

## Earlier route-discovery sequence

The earlier development task used this sequence before response fixtures
existed. These steps are **Observed once** from the task history:

1. It inspected the signed-in Sales page and its month control, table, and CSV
   action.
2. It opened the Analytics, Downloads, and Revenue pages one at a time. It
   compared their date controls, package scope, tables, and export actions.
3. The first prototype read Portal DOM and CSV data. This established the user
   concepts, but it created several source and normalization paths.
4. The task inspected the loaded Portal scripts and their callers. This exposed
   the request paths and request builders that the API-only prototype used.
5. Direct isolated-world reproduction failed. The task added the narrow
   page-world bridge and then reproduced the working request shapes there.
6. The project removed the DOM, CSV, and passive response-interception paths. It
   kept one Portal API source and a new local database so old prototype records
   could not mix with API-normalized records.

The exact Network filters, every script filename, the rejected proxy request,
the first rejected daily body, and their response bodies were not retained.
Use the browser investigation sequence in this document for a reproducible new
investigation. Use the current fixtures, not this chronology, as evidence for
the integrated endpoint shapes.

## Lessons from the retained Chrome investigation

The 2026-08-18 fixture investigation used this sequence:

1. The agent connected to the signed-in Chrome session, listed open tabs, and
   selected the existing `/sales` tab.
2. It inspected a safe DOM snapshot to confirm the page and account context.
3. It tried to call the existing `UPA_API_REQUEST` message bridge from the
   browser control evaluation layer. A second attempt changed only the request
   ID generator. Both attempts stopped before they produced response-shape
   evidence.
4. It checked the available browser and tab capabilities. No suitable
   read-only network or debug capability was available.
5. It added a temporary query-flagged block to `api-client.js`. The maintainer
   manually reloaded the unpacked extension.
6. The helper made only the documented read-only requests in the Portal page
   world. It parsed each response and made a safe copy in that world. It emitted
   only the changed request object and the changed response object.
7. The fixtures and provenance were written from the safe copy. The
   helper was removed, the query flag was cleared, and the maintainer reloaded
   the unpacked extension again.

This full sequence is **Observed once** in the task history. The repository does
not retain the complete browser-control transcript. The fixtures and provenance
confirm that the page changed private values before output. They also confirm
that raw responses and authentication material were not retained. They do not
confirm every tool step or a general capability of every Chrome control version.

The helper used stable fictional tokens for related identifiers and names. It
shifted related dates by one constant offset. It transformed related counts and
money together. It preserved nulls, signs, zeros, JSON types, keys, nesting, and
cross-fixture relationships. It recorded each array limit. It did not emit
cookies, CSRF values, headers, email addresses, or raw response JSON.

The first safe-evaluation attempts were useful failures. They showed that a
control tool can inspect a signed-in page without being authorized to execute
session-bearing page code. The temporary helper was not product code. It was an
opt-in capture instrument, and its complete removal was part of the capture
procedure.

For the current endpoints, retained fixtures now own response-shape evidence.
Older task observations that have no fixture remain **Observed once** or
**Unknown** in [`DATA-EVIDENCE.md`](DATA-EVIDENCE.md) and
[`VALIDATION.md`](VALIDATION.md).
