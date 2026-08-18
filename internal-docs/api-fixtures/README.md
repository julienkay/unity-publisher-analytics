# API fixtures

This directory contains sanitized response fixtures for Unity Publisher Portal API calls. The fixtures show response structures that occurred on one publisher account. The fixtures do not define an official Unity API contract.

[manifest.json](manifest.json) is the authoritative fixture list. [request-shapes.json](request-shapes.json) contains request methods, paths, query parameters, and bodies. It does not contain authentication data.

Each response fixture has a provenance file. Read the provenance file before you use the response fixture. The provenance file identifies the source request, the account context, the sanitization changes, and the evidence limits.

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

The fixtures do not preserve private account values. Some publisher data arrays contain fewer rows than the source responses. The provenance file identifies each reduction.

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

The catalog daily fixture, the package daily fixture, and the monthly sales fixture have matching gross revenue, net revenue, and paid quantity for their shared period. This comparison does not include every package daily response. It does not include a matching Portal CSV export.

## Capture procedure

1. Open the signed-in Publisher Portal.
2. Use the browser network tools or an approved local capture tool.
3. Capture only the request URL, the request body, and the JSON response.
4. Do not save cookies, CSRF tokens, session headers, email addresses, or unrelated network data.
5. Put the source response in a temporary location outside the repository.
6. Replace publisher IDs, package IDs, product IDs, names, profile data, ledger descriptions, and exact financial values.
7. Use stable replacement values across related fixtures.
8. Preserve JSON types, key spelling, nesting, null values, signs, and required value relationships.
9. Preserve safe semantic values when they are necessary. Examples are a currency code and a zero value.
10. Record each removed row or shortened array in the provenance file.
11. Delete the source response after the safety check.

If you change a monetary value, change all related totals. The fixture must remain internally consistent.

## Provenance file

Use the name `<fixture>.provenance.json` for the provenance file. Include this information:

- capture date
- Portal page
- endpoint and method
- sanitized request body, when applicable
- account, catalog, and period characteristics
- capture method
- each sanitization change
- tested boundary behavior
- commit that adds the fixture

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

Ask another maintainer to review the sanitization when possible.

Use the suffix `*.synthetic.json` for synthetic examples. Do not use a synthetic example as evidence of Unity response behavior.

Add or update normalizer tests before you change a field alias or a field mapping.
