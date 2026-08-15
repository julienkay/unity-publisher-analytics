# API fixture coverage

No sanitized raw Unity response fixtures were captured during the original development session. Do not treat `content.js` aliases or this directory's request examples as response evidence.

[manifest.json](manifest.json) is the authoritative coverage list. Every endpoint is currently marked `missing`. [request-shapes.json](request-shapes.json) preserves the working non-sensitive request forms reconstructed from the implementation.

## Required fixture set

Capture at least one sanitized response for each endpoint:

1. `once-published-packages.json`
2. `categories.json`
3. `package-metadata.json`
4. `monthly-sales.json`
5. `monthly-downloads.json`
6. `publisher-revenues.json`
7. `daily-catalog.json`
8. `daily-package.json`

Additional variants should cover empty arrays/objects, a free-only asset, a paid asset, multiple price tiers, non-zero refunds and chargebacks, negative wishlist change, and category assignments with every genuinely observed shape.

## Capture protocol

1. Use Chrome DevTools Network on the signed-in Publisher Portal and trigger the corresponding portal view or extension sync.
2. Save only the request URL/body and JSON response. Never save cookies, CSRF tokens, authorization/session headers, user email, or unrelated network traffic.
3. Work on a copy outside the repository. Replace publisher IDs, package/product IDs, package names, ledger descriptions that identify the business, profile details, and exact financial values.
4. Preserve JSON types, key spelling, nesting, nullability, array cardinality patterns, signs, and relationships. Use stable tokens such as `publisher-1`, `package-1`, and `category-1` so cross-field joins remain testable.
5. Preserve semantically relevant safe values when necessary—for example a currency code, zero versus non-zero, positive versus negative wishlist movement, and relative date ordering. If a monetary value is changed, adjust related gross/net totals so fixture reconciliation remains internally consistent.
6. Add a sidecar `<fixture>.provenance.json` containing:
   - capture date;
   - portal page that initiated the request;
   - endpoint and method;
   - whether the account, catalog, or period was empty/paid/free/refund-bearing;
   - every sanitization transformation;
   - boundary semantics tested; and
   - the commit that added the fixture.
7. Update [manifest.json](manifest.json) from `missing` to `captured` and list the response and provenance files.
8. Add or update normalizer tests before changing an alias or field mapping.

## Boundary fixtures

To confirm daily date semantics, retain three responses for the same catalog scope where date `D` is known to have a returned record:

- a wider range containing `D`;
- `[D - 1 day, D]`; and
- `[D, D + 1 day]`.

Record whether `D` appears when used as the request end and start. Also capture a known inactive date to determine whether Unity returns an explicit all-zero object or omits its key.

## Reconciliation fixtures

For each selected complete month, retain:

- the catalog-wide daily response;
- all package daily responses;
- monthly sales;
- monthly downloads; and
- the corresponding portal CSV export.

The provenance note should record, without private totals, whether gross, paid quantity, claims, refunds, and downloads reconcile exactly or by a documented tolerance.

## Safety review

Before committing a fixture, search it for the real publisher name, package names, IDs, email addresses, URLs containing identifiers, and unmodified financial totals. Have another maintainer review the sanitization when possible.

Synthetic examples must be named `*.synthetic.json` and must never be used to claim Unity response behavior.
