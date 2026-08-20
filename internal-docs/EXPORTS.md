# Analytics exports

This document describes the JSON file created by **Settings > Data management > Export data**. It documents the normalized export format, not Unity's raw API responses. Source-data evidence and metric semantics are in [DATA-EVIDENCE.md](DATA-EVIDENCE.md).

## Export operation

The export downloads `publisher-analytics-YYYY-MM-DD.json` with the media type `application/json`. It contains every analytics record stored for the active publisher. The selected view, date range, interval, asset scope, and chart filters do not limit the export.

The file does not contain raw API responses, charts, preferences, package groups, or sync progress. The extension has no JSON import or restore action. The file is a copy of analytics data, not a restorable workspace.

The file contains the publisher name and publisher ID. Treat it as private publisher data and sanitize it before sharing.

## Top-level format

```json
{
  "version": 2,
  "exportedAt": "2026-08-20T12:00:00.000Z",
  "publisher": {
    "id": "PUBLISHER_ID",
    "name": "Example Publisher"
  },
  "records": []
}
```

| Field | Meaning |
|---|---|
| `version` | Export-schema version. Its value is `2`. |
| `exportedAt` | UTC time when the file was created, in ISO 8601 format. |
| `publisher.id` | Publisher ID that owns every exported record. |
| `publisher.name` | Display name of the active publisher. |
| `records` | All stored normalized analytics records for this publisher. |

## Common record fields

All record types contain these internal fields in addition to their data fields:

| Field | Meaning |
|---|---|
| `publisherId` | Publisher ownership key. It matches `publisher.id`. |
| `id` | Stable local record key derived from record identity fields. |
| `source` | Normalized source label. Its value is `publisher-api`. |
| `capturedAt` | UTC time when the normalized record was last written locally. It is not the event date. |

Select records by `type`. Fields are not uniform across record types.

## `daily` records

Daily records contain catalog-wide or per-asset performance. `scope` distinguishes the two forms:

- `all`: combined catalog result; `packageId` is `null`.
- `package`: one asset; `packageId` identifies it.

Adding `all` records to `package` records counts the same activity twice. Package rows do not always sum to the catalog row because scopes can be missing and catalog or sync coverage can differ.

Sanitized per-asset example:

```json
{
  "type": "daily",
  "period": "2026-07",
  "date": "2026-07-15",
  "scope": "package",
  "packageId": "12345",
  "package": "Example Asset",
  "category": "Tools",
  "sales": 120,
  "salesQty": 4,
  "paidQty": 4,
  "freeQty": 0,
  "pageViews": 150,
  "conversionRate": 2.6666666666666665,
  "downloads": 8,
  "wishlisted": 3,
  "refunds": 0,
  "ratingAvg": 4.8,
  "quickLooks": 2,
  "carted": 5,
  "currency": "USD",
  "publisherId": "PUBLISHER_ID",
  "id": "LOCAL_RECORD_ID",
  "source": "publisher-api",
  "capturedAt": "2026-08-20T12:00:00.000Z"
}
```

| Field | Meaning |
|---|---|
| `period` | Calendar month derived from `date`, formatted `YYYY-MM`. |
| `date` | Activity date, formatted `YYYY-MM-DD`. |
| `scope` | `all` for the catalog or `package` for one asset. |
| `packageId` | Unity package ID for a package scope; `null` for the catalog scope. |
| `package` | Asset or catalog display label captured during sync. |
| `category` | Asset category captured during sync; it can be empty. |
| `sales` | **Gross revenue**, despite the field name. It is derived from daily `gross`. |
| `salesQty` | `paidQty + freeQty`. |
| `paidQty` | Paid quantity derived from daily `sales`. |
| `freeQty` | Free claims derived from daily `free_obtained`. |
| `pageViews` | Daily page views. |
| `conversionRate` | Extension-calculated `(salesQty / pageViews) * 100`, capped at 100%. |
| `downloads` | Daily downloads. Its equivalence to the monthly event count is not confirmed. |
| `wishlisted` | Daily net wishlist movement; it can be negative. |
| `refunds` | Daily refund value, treated as a count. |
| `ratingAvg` | Daily rating value when returned; otherwise normalized to zero. |
| `quickLooks` | Daily quick-look count. |
| `carted` | Daily cart-addition count. |
| `currency` | Value set to `USD` by the extension. |

The daily API also returns `revenue` and `chargebacks` in the retained fixture. The normalizer does not store or export them. The JSON export therefore has daily gross revenue per asset, but not daily net revenue per asset.

## `sales` records

Sales records contain one monthly asset-and-price row. One asset can have more than one row in a month if Unity returns more than one price row.

```json
{
  "type": "sales",
  "period": "2026-07",
  "date": "2026-07-01",
  "packageId": "12345",
  "package": "Example Asset",
  "category": "Tools",
  "price": 30,
  "qty": 4,
  "refunds": 0,
  "chargebacks": 0,
  "gross": 120,
  "net": 84,
  "first": "2026-07-03",
  "last": "2026-07-28",
  "currency": "USD",
  "publisherId": "PUBLISHER_ID",
  "id": "LOCAL_RECORD_ID",
  "source": "publisher-api",
  "capturedAt": "2026-08-20T12:00:00.000Z"
}
```

| Field | Meaning |
|---|---|
| `period` | Report month, formatted `YYYY-MM`. |
| `date` | First calendar day of `period`; it is not a sale date. |
| `packageId`, `package`, `category` | Asset identity and category captured during sync. |
| `price` | Price for this monthly row. |
| `qty` | Monthly paid quantity derived from monthly `sales`. |
| `refunds` | Monthly refunds, treated as a count. |
| `chargebacks` | Monthly chargebacks, treated as a count. |
| `gross` | Monthly gross revenue. |
| `net` | Monthly value derived from Unity's `revenue` field. Its publisher-facing net interpretation is inferred, not a documented Unity contract. |
| `first`, `last` | First and last activity dates returned for the row; either can be empty. |
| `currency` | Value set to `USD` by the extension. |

## `downloads` records

Download records contain one monthly row per asset.

```json
{
  "type": "downloads",
  "period": "2026-07",
  "date": "2026-07-01",
  "packageId": "12345",
  "package": "Example Asset",
  "category": "Tools",
  "downloads": 40,
  "users": 35,
  "freeDownloads": 10,
  "freeUsers": 8,
  "entitledDownloads": 30,
  "entitledUsers": 27,
  "freeFirst": "2026-07-02",
  "freeLast": "2026-07-25",
  "entitledFirst": "2026-07-01",
  "entitledLast": "2026-07-30",
  "publisherId": "PUBLISHER_ID",
  "id": "LOCAL_RECORD_ID",
  "source": "publisher-api",
  "capturedAt": "2026-08-20T12:00:00.000Z"
}
```

| Field | Meaning |
|---|---|
| `period` | Report month, formatted `YYYY-MM`. |
| `date` | First calendar day of `period`; it is not a download date. |
| `packageId`, `package`, `category` | Asset identity and category captured during sync. |
| `downloads` | `freeDownloads + entitledDownloads`. |
| `users` | `freeUsers + entitledUsers`. |
| `freeDownloads`, `freeUsers` | Monthly free download events and users. |
| `entitledDownloads`, `entitledUsers` | Monthly entitled download events and users. |
| `freeFirst`, `freeLast` | First and last free-download timestamps or dates returned for the row; either can be empty. |
| `entitledFirst`, `entitledLast` | First and last entitled-download timestamps or dates returned for the row; either can be empty. |

## `revenue` records

Revenue records contain account-level ledger entries. They are not assigned to assets.

```json
{
  "type": "revenue",
  "period": "2026-07",
  "date": "2026-07-31",
  "description": "Example account entry",
  "debit": 0,
  "credit": 84,
  "balance": 500,
  "currency": "USD",
  "publisherId": "PUBLISHER_ID",
  "id": "LOCAL_RECORD_ID",
  "source": "publisher-api",
  "capturedAt": "2026-08-20T12:00:00.000Z"
}
```

| Field | Meaning |
|---|---|
| `period` | Calendar month derived from `date`, formatted `YYYY-MM`. |
| `date` | Ledger-entry date. |
| `description` | Description returned for the ledger entry. |
| `debit`, `credit`, `balance` | Account-level ledger values. |
| `currency` | Value set to `USD` by the extension. |

## Coverage limits

The export does not fetch data. It copies records already stored for the active publisher. Its date coverage therefore depends on the last successful sync and any existing gaps.

A full sync starts at the earlier of the first known package publication and the earliest ledger entry, then clamps that date to `2019-01-01`. Daily sync stops two days before the date when the sync runs. These rules are extension policies, not verified Unity retention or freshness contracts. See [DATA-EVIDENCE.md](DATA-EVIDENCE.md#date-behavior-and-sync-constants) and [DECISIONS.md](DECISIONS.md) for the complete limits.

## CSV availability

There is no native CSV export.

Per-asset daily gross revenue is stored in `daily` records with `scope: "package"`. The `sales` field contains gross revenue. No CSV file is generated.

Per-asset net revenue is stored by month in `sales` records under `net`. `revenue` records are account-level ledger entries and do not contain an asset split.
