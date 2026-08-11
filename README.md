# Unity Publisher Analytics+

A Chrome extension that turns Unity Publisher Portal data into a clearer historical dashboard.

See [VISION.md](VISION.md) for the product direction and guiding principles.
See [docs/DESIGN.md](docs/DESIGN.md) for the shared interface system.
See [docs/RENDERING.md](docs/RENDERING.md) for the visualization architecture.

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
- Portfolio-wide and per-package performance.

The main revenue chart supports automatic or explicit daily, weekly, monthly, quarterly, and yearly intervals. Choose a preset or exact start and end dates, then scroll or pinch to zoom, drag to pan, or use the navigator handles to focus on a precise window.

Additional views reveal patterns that are hard to see in a timeline:

- A stacked calendar compares daily revenue, purchases, pageviews, or downloads across every available year.
- A filterable Sankey diagram shows how package revenue is distributed across price tiers without implying customer-level journeys that the aggregate source data cannot support.
- Every chart can be saved as a high-resolution PNG or shared through the device's native share surface when available.

The left navigation separates a general Dashboard from the deeper Analytics workspace. Dashboard combines the four headline metrics with aligned revenue, pageview, and download timelines. Within Analytics, focused tabs switch between Revenue, Daily patterns, Revenue flow, and Packages while the selected date range remains shared across the workspace.

Progress is saved as the history is synced. If the page is refreshed, the extension continues from where it left off. Once the full history is ready, recent results are refreshed automatically whenever the Publisher Portal is visited.

## Storage and privacy

Your analytics data and preferences stay in this browser. The extension communicates only with the Unity Publisher Portal and has no telemetry, remote scripts, or external server.

Removing the extension or selecting **Clear data** deletes the locally synced dashboard. Use **Export data** to create a local JSON backup.

## Technical notes

The extension uses the signed-in portal session and the reporting endpoints already used by the Unity Publisher Portal. Normalized data is stored in an extension-owned IndexedDB database; preferences and the resumable checkpoint use `chrome.storage.local`.

Daily history is collected for the complete portfolio and for each package in date windows supported by the portal. The available account history is discovered dynamically and is limited only by Unity's own analytics retention boundary.

Apache ECharts is bundled locally with the extension; no runtime code is loaded from a CDN. To rebuild the committed chart bundle after changing `scripts/echarts-entry.js`, run `npm install` and `npm run build:charts`.

The Publisher Portal endpoints are implementation details and can change without notice. The extension deliberately trusts this single source instead of maintaining alternate ingestion paths.
