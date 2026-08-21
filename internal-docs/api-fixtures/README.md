# API fixtures

This directory contains safe evidence copies of Unity Publisher Portal API
responses. Each fixture started as a real response from one publisher account.
The fixtures show structures that occurred on that account. They do not define
an official Unity API contract.

These files are API evidence. They are not screenshot data. To sanitize a
fixture means to make a safe copy of a real response. The capture process removes
secrets. It replaces private identities and values. It keeps only the structure
and relationships that the evidence needs. The provenance file lists every
change and every evidence limit.

The extension does not sanitize live publisher data. It does not apply these
changes during sync, storage, charts, or export.

Marketing screenshots use the separate, fully fictional dataset in
[`scripts/marketing-fixture.js`](../../scripts/marketing-fixture.js). They do not
use these API fixtures or real publisher data.

Agents must also read this directory's [`AGENTS.md`](AGENTS.md) and the
repository's [data-source workflow](../DATA-SOURCE-WORKFLOW.md) before capturing
or changing fixture material.

[manifest.json](manifest.json) is the authoritative fixture list. [request-shapes.json](request-shapes.json) contains request methods, paths, query parameters, and bodies. It does not contain authentication data.

Each response fixture has a provenance file. Read this file before you use the
fixture. It identifies the source request and the account state. It lists each
change to the captured response. It also states what the fixture cannot prove.

## Fixture set

The directory contains these response fixtures:

1. `user.json`
2. `once-published-packages.json`
3. `categories.json`
4. `package-metadata.json`
5. `monthly-sales.json`
6. `monthly-downloads.json`
7. `publisher-revenues.json`
8. `daily-catalog.json`
9. `daily-package.json`

The fixtures preserve these response properties:

- JSON types
- key spelling
- object and array structure
- null values
- positive, negative, and zero states
- relationships between selected values

The fixtures do not contain the original private account values. Some arrays
contain fewer rows than the source responses. The provenance file identifies
each reduction.

## Observed response structures

| Response | Observed structure |
|---|---|
| Active publisher | An object with `id`, `name`, `locale`, `publisherId`, `defaultOrgId`, `publisherOrgId`, `publisherOrgName`, `countries`, and `avatar` |
| Published packages | An array of objects with `first_published_at`, `name`, `package_id`, and `status` |
| Categories | An array of objects with `assetstore_name`, `id`, `multiple`, `name`, and `status` |
| Package metadata | An object with `package_versions`, `package_key_images`, `counts`, and `total` |
| Package version | An object that can contain `unitypackages`, `vetting`, and `packmanpackages` |
| Monthly sales | An array with string values for `chargebacks`, `gross`, `package_id`, `price`, `refunds`, `revenue`, and `sales` |
| Monthly downloads | An array with `name`, `package_id`, and a `downloads` object |
| Download values | Nullable free and entitled counts, user counts, and first and last timestamps |
| Revenue ledger | An array with numeric `debit`, `credit`, and `balance` values, plus `date` and `description` |
| Daily performance | An object that uses dates as keys and numbers as metric values |

Publisher Analytics+ uses `first_published_at` as the package publication date. A full-history sync compares the earliest package publication date with the earliest revenue date. It uses the earlier date as its start date. The `2019-01-01` minimum date still applies.

The daily fixtures use a half-open request interval. Each response contains the start date and the dates before the end date. The response does not contain the end date. The package fixture contains an empty object for some inactive dates.

These observations apply only to the retained fixtures. They do not prove that Unity uses the same structure for all accounts and all dates.

## Evidence limits

The fixture set does not contain evidence for these cases:

- an empty publisher account
- an empty report period
- a nonzero refund
- a nonzero chargeback
- a negative daily wishlist value
- a daily rating value
- all package metadata pages
- all category value forms
- localized number values
- a different reporting currency
- a second publisher account

The daily fixtures show one complete month interval. They do not replace a paired boundary test.

The catalog daily fixture, package daily fixture, and monthly sales fixture have
matching values for their shared period. The matching values are gross revenue,
net revenue, and paid quantity. This comparison does not include every package
daily response. It does not include a matching Portal CSV export.

## Capability-limited fixtures

For a feature that is available only to selected publishers, do not use one
fixture to represent every absence state. Capture each state that the available
accounts can demonstrate:

- Unavailable or not eligible.
- Eligible with an empty result.
- Active with a non-empty result.
- Expired or historical.
- Authentication failure.
- Permission failure.
- Changed or malformed response.

Record the visible Portal state and the successful or failed request state in
the provenance file. Do not create a response for an account state that was not
observed. Use `Unknown` in [VALIDATION.md](../VALIDATION.md) for every missing
state. A synthetic fixture can test error handling, but it cannot prove how
Unity represents that state.

## Capture procedure

1. Open the signed-in Publisher Portal and confirm the account and feature state.
2. Use the browser Network panel to identify the exact method, path, query, body, and action. Do not save a general HAR file.
3. Parse and sanitize the response in the Portal page when possible. Remove secrets and replace private values before you log, copy, or send any response object to an agent.
4. If browser control cannot execute the existing bridge, add a temporary query-flagged block to `api-client.js`. Allow only the required read-only requests. Ask the maintainer to reload the unpacked extension.
5. Do not emit cookies, CSRF tokens, session headers, email addresses, raw response text, or unrelated network data.
6. Replace publisher IDs, package IDs, product IDs, names, profile data, ledger descriptions, URLs, and exact financial values.
7. Use stable replacement values across related fixtures. Replace related totals together.
8. Change dates only when the exact dates are private. First, identify the
   calendar properties that the evidence needs. These properties can include
   order, interval length, month, weekday, leap day, season, time-of-day, and
   request boundaries. Preserve each required property. Do not use the fixture
   as evidence for a property that the change does not preserve.
9. Preserve JSON types, key spelling, nesting, null values, signs, zero states, and required value relationships.
10. Preserve safe semantic values only when they are necessary. Examples are a currency code, lifecycle status, and zero.
11. Record each removed row, shortened array, shifted date, replaced identity, and transformed value in the provenance file.
12. Write repository files only from the safe evidence copy. If you must use raw data, keep it outside the repository and agent messages. Delete it after the safety check.
13. Remove the temporary capture block and clear its query flag. Ask the maintainer to reload the unpacked extension again.
14. Check the final diff for the flag, capture log marker, temporary code, raw files, and private values.

If you change a monetary value, change all related totals. The fixture must remain internally consistent.

The 2026-08-18 capture followed this page-world method. It emitted only safe
`{request, response}` objects. The temporary helper replaced identities with
stable fictional tokens. It changed related dates and numbers together. It also
limited some arrays. These changes affected only the evidence files. They never
became extension behavior. The helper was removed before the fixture commit.
The raw responses and original private values were not retained.

## Provenance file

Use the name `<fixture>.provenance.json` for the provenance file. Start from
[`provenance.template.json`](provenance.template.json), remove its template
notice, and include this information:

- capture date
- Portal page
- endpoint and method
- request body after private values were replaced, when applicable
- account, catalog, and period characteristics
- capture method
- each change made to protect private data
- tested boundary behavior

Set the fixture status to `captured` in [manifest.json](manifest.json). Add the response file name and the provenance file name to the manifest entry.

## Daily boundary fixtures

Use one catalog scope and one date `D`. Use a date that has a returned record. Retain these three responses:

- a range that contains `D`
- the range `[D - 1 day, D]`
- the range `[D, D + 1 day]`

Record if `D` occurs as a start date. Record if `D` occurs as an end date. Also capture one inactive date. Record if Unity returns an empty object, a zero-value object, or no key for that date.

## Reconciliation fixtures

For one complete month, retain these files:

- the catalog daily response
- each package daily response
- the monthly sales response
- the monthly downloads response
- the Portal CSV export

Compare gross revenue, net revenue, paid quantity, free claims, refunds, and downloads. Record an exact match or a defined tolerance in the provenance file. Do not record private totals in the provenance file.

## Safety check

Before you commit a fixture, search all fixture files for this private data:

- publisher names
- package names
- real IDs
- email addresses
- URLs that contain identifiers
- unchanged financial totals

Ask another maintainer to review the sanitized fixture when possible.

Use the suffix `*.synthetic.json` for synthetic examples. Do not use a synthetic example as evidence of Unity response behavior.

Add or update normalizer tests before you change a field alias or a field mapping.
