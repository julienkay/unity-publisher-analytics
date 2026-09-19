# Unity data sources

Use this guide to test an undocumented Unity API or add a data source.

## Test an API request

Use browser CDP from a signed-in Publisher Portal tab. CDP means Chrome
DevTools Protocol.

Do not change, rebuild, or reload Publisher Analytics+ only to test an API
request.

### Prepare the browser

1. Enable **Settings > Browser > Developer mode > Full CDP access**.
2. Restart the browser after you enable this setting.
3. Open `https://publisher.unity.com` and sign in.
4. Bind the browser tool to the signed-in Portal tab.
5. Check the tab capabilities for `cdp`.

If `cdp` is absent, reset the browser-control session and bind the tab again.
The browser restart and the new binding are both necessary in some sessions.

### Run the request

Start with a known request from
[`api-fixtures/request-shapes.json`](api-fixtures/request-shapes.json). This
request is the control. Confirm that it succeeds before you test a candidate.

Use `Runtime.evaluate` through the tab's `cdp` capability. Run `fetch` in the
Portal page. Use the active session and the same headers as `api-client.js`.

```js
const cdp = await tab.capabilities.get("cdp");
const result = await cdp.send("Runtime.evaluate", {
  expression: `(async () => {
    const csrfPair = document.cookie
      .split("; ")
      .find(value => value.startsWith("_csrf="));
    const csrf = csrfPair ? decodeURIComponent(csrfPair.slice(6)) : "";
    const response = await fetch("/publisher-v2-api/ROUTE", {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Csrf-Token": csrf,
        "X-Source": "publisher-portal"
      }
    });
    return {
      status: response.status,
      ok: response.ok,
      body: await response.json()
    };
  })()`,
  awaitPromise: true,
  returnByValue: true
});
```

Do not return or record the CSRF token. Do not return cookies, authorization
values, or session headers.

Change one request property at a time. Record these items:

- method
- path and query
- JSON body, if present
- HTTP status
- response container
- required field names
- tested account and date conditions

Raw responses are valid development evidence. Authentication material is not.

Direct GET navigation can also work in the signed-in browser. Browser
automation can block that navigation before the request reaches Unity.
`ERR_BLOCKED_BY_CLIENT` is a browser-tool result, not a Unity response.

### Browser-plugin prompt

Use this prompt when an agent runs inside the ChatGPT browser extension:

> Use the current signed-in Publisher Portal tab. Use full CDP access. Run a
> read-only same-origin request to the specified `/publisher-v2-api/` route.
> Use the active Portal session and the headers used by the Portal. Return
> the HTTP status and parsed JSON. Do not return cookies, CSRF tokens,
> authorization values, or session headers.

## Record evidence

Read [`api-fixtures/AGENTS.md`](api-fixtures/AGENTS.md) before you add a fixture.

A captured fixture can be raw or sanitized. Every captured fixture requires:

1. A response JSON file.
2. A provenance sidecar.
3. An entry in `api-fixtures/manifest.json`.
4. A request shape in `api-fixtures/request-shapes.json`.
5. A focused fixture test.

Never retain authentication material or an unrelated HAR file.

## Add a source

Before implementation, define these properties:

- publisher ownership
- stable record identity
- package or catalog scope
- date range and time zone
- pagination
- empty, missing, null, and zero behavior
- units, currency, and signs
- snapshot, event, or cumulative semantics
- full-sync and incremental-sync coverage
- retry and resume behavior
- clear and export behavior

Then update every applicable layer:

- the allowlist in `api-client.js`
- the caller and validator in `content.js`
- normalization and record identity
- publisher-scoped storage
- sync scheduling and coverage
- aggregation and exports
- fixtures and validation
- `DATA-EVIDENCE.md`, `DECISIONS.md`, and `VALIDATION.md`

Do not add only a request path and parser.

## Finish

Run the checks in [`SCRIPTS.md`](SCRIPTS.md). Always run fixture tests after an
evidence or normalized-data change. Run publisher-isolation tests after an
identity, storage, sync, export, or clearing change.

Keep durable facts in these files:

| Fact | File |
|---|---|
| Runtime wiring | `ARCHITECTURE.md` |
| Endpoint and field evidence | `DATA-EVIDENCE.md` |
| Product and data policy | `DECISIONS.md` |
| Missing tests and known failures | `VALIDATION.md` |
| Stored and exported schema | `EXPORTS.md` |
| Commands and test coverage | `SCRIPTS.md` |
