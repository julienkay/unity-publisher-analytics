# Unity Publisher Analytics+

A Chrome extension that turns Unity Publisher Portal data into a clearer historical dashboard.

See [VISION.md](VISION.md) for the product direction and guiding principles.
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

Progress is saved as the history is synced. If the page is refreshed, the extension continues from where it left off. Once the full history is ready, recent results are refreshed automatically whenever the Publisher Portal is visited.

## Storage and privacy

Your analytics data and preferences stay in this browser. The extension communicates only with the Unity Publisher Portal and has no telemetry, remote scripts, or external server.

Removing the extension or selecting **Clear data** deletes the locally synced dashboard. Use **Export data** to create a local JSON backup.

## Technical notes

The extension uses the signed-in portal session and the reporting endpoints already used by the Unity Publisher Portal. Normalized data is stored in an extension-owned IndexedDB database; preferences and the resumable checkpoint use `chrome.storage.local`.

Daily history is collected for the complete portfolio and for each package in date windows supported by the portal. The available account history is discovered dynamically and is limited only by Unity's own analytics retention boundary.

There is no build step or third-party dependency. These endpoints are implementation details and can change without notice. The extension deliberately trusts this single source instead of maintaining alternate ingestion paths.
