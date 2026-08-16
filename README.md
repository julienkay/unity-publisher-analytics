# Publisher Analytics+

A Chrome extension that turns Unity Publisher Portal data into a clearer historical dashboard.

See [VISION.md](VISION.md) for the product direction and guiding principles.

Maintainer documentation, including the interface system, rendering architecture,
data evidence, and decision log, lives in [internal-docs](internal-docs/README.md).

## Install locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open or refresh any page under `https://publisher.unity.com/` while signed in.
5. Click the **A+** button or the extension toolbar icon.

After updating an existing unpacked installation, click **Reload** on its `chrome://extensions` card and refresh the Publisher Portal.

## Getting started

Click **Sync full history** to build your dashboard. The extension finds the packages and available history for the signed-in publisher automatically—there is no fixed publisher ID, package list, or publisher-specific start date.

The dashboard brings together:

- Monthly sales, units, refunds, chargebacks, gross revenue, and publisher revenue.
- Downloads and users.
- Debits, credits, payouts, and current balance.
- Daily sales, purchases and claims, pageviews, conversion, downloads, wishlist changes, refunds, ratings, quick looks, and cart activity.
- Catalog-wide and per-package performance.

The main revenue chart supports automatic or explicit daily, weekly, monthly, quarterly, and yearly intervals. Choose a preset or exact start and end dates, then scroll or pinch to zoom, drag to pan, or use the navigator handles to focus on a precise window.

Additional views reveal patterns that are hard to see in a timeline:

- A lifetime growth chart compares cumulative gross revenue, sales quantity, downloads, or pageviews by package. It defaults to a calendar-time stacked area view of asset composition; publishers can switch to separate lines, align packages at their first activity to compare trajectories, and toggle series directly from the legend.
- A stacked calendar compares daily revenue, purchases, pageviews, or downloads across every available year.
- A filterable Sankey diagram groups total gross revenue by the Asset Store categories assigned in the Publisher Portal, then splits each category into package contributions. Publishers can switch to a direct package split.
- Every chart can be saved as a high-resolution PNG or shared through the device's native share surface when available.

The left navigation separates a general Dashboard from the deeper Analytics workspace. Its top summary pairs selected-range asset allocation and revenue concentration with six headline metrics; when enough earlier data exists, selected-range metrics include a comparison with the preceding equivalent period. Aligned revenue, pageview, and download timelines and a ranked package table follow below. Within Analytics, focused tabs switch between Revenue, Lifetime growth, Daily patterns, Revenue composition, and Packages. Lifetime growth always uses all available history; the selected date range remains shared across the other views.

The publisher block at the bottom of the navigation follows the publisher currently active in the signed-in portal. It uses the store profile name and picture when available. Its upward menu opens Settings or returns to the Publisher Portal; data coverage, JSON export, and local-data clearing are kept separate from the analytics workspace.

Progress is saved as the history is synced. If the page is refreshed, the extension continues from where it left off. Once the full history is ready, recent results are refreshed automatically whenever the Publisher Portal is visited.

## Storage and privacy

Your analytics data and preferences stay in this browser. The extension communicates only with the Unity Publisher Portal and has no telemetry, remote scripts, or external server.

Removing the extension or selecting **Clear data** deletes the locally synced dashboard. Use **Export data** to create a local JSON backup.

The current prototype does not isolate local records by publisher account. Clear the local data before switching to another publisher; otherwise the previous publisher's records can remain visible or be combined with new data. Maintainers should treat publisher isolation as required before broader release.

## Technical notes

The extension uses the signed-in portal session and the reporting endpoints already used by the Unity Publisher Portal. Normalized data is stored in an extension-owned IndexedDB database; preferences and the resumable checkpoint use `chrome.storage.local`.

Daily history is requested for the complete catalog and for each package. The start is derived from the earliest package-publication or ledger date, but the current prototype clamps daily collection to `2019-01-01`. Unity's actual retention boundary, date semantics, revision behavior, currency contract, and completeness guarantees remain undocumented and are tracked in [internal-docs/DATA-EVIDENCE.md](internal-docs/DATA-EVIDENCE.md).

Apache ECharts is bundled locally with the extension; no runtime code is loaded from a CDN. To rebuild the committed chart bundle after changing `scripts/echarts-entry.js`, run `npm install` and `npm run build:charts`.

## Package for the Chrome Web Store

Run `npm run package` to rebuild the chart bundle and create a versioned ZIP in
`dist/`. Upload that ZIP to the Chrome Web Store developer dashboard. The archive
contains only the extension's runtime files and bundled license notices.

The Publisher Portal endpoints are implementation details and can change without notice. The extension deliberately trusts this single source instead of maintaining alternate ingestion paths.
