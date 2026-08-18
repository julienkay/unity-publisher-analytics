# Development and packaging

This document contains repository setup and packaging notes for maintainers. Product direction lives in [VISION.md](../VISION.md); data and interface constraints are indexed in the [maintainer documentation](README.md).

For the complete command and script reference, see [SCRIPTS.md](SCRIPTS.md).

## Runtime architecture

Publisher Analytics+ is a Manifest V3 extension for Chrome and Firefox, limited to `publisher.unity.com`. It uses the signed-in Portal session and the reporting endpoints already used by the Unity Publisher Portal.

Normalized analytics and the resumable sync checkpoint are stored in an extension-owned IndexedDB database. Preferences, publisher presentation details, and package groups use local extension storage. Each publisher ID selects an independent local workspace. Every browser profile has a separate extension origin, so Chrome and Firefox do not automatically share analytics, preferences, or package groups.

Apache ECharts is bundled with the extension. Runtime dependencies must never be loaded from a CDN.

## Local Chrome installation

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the repository root.
4. Open or refresh a page under `https://publisher.unity.com/` while signed in.
5. Click the **Publisher Analytics+** button or the extension toolbar icon.

After changing extension files, reload the unpacked extension and refresh the Publisher Portal. Do not automate the `chrome://extensions` reload.

## Local Firefox installation

1. Run `npm run package:firefox`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and select the generated Firefox ZIP in `dist/`.
4. Open or refresh `https://publisher.unity.com/` while signed in.

Firefox 140 or newer is required. The application APIs are available from Firefox 128, while Firefox's required built-in no-data-collection declaration sets the distributable package floor to Firefox 140 on desktop and 142 on Android. Temporary add-ons are removed when Firefox exits; permanently installed builds must be signed by Mozilla.

## Charts

After changing `scripts/echarts-entry.js`, install dependencies and rebuild the committed chart bundle:

```shell
npm install
npm run build:charts
```

## Validation

Before finishing a change:

1. Run `npm run build:charts`.
2. Run `node --check` on every JavaScript file.
3. Run `npm run validate:manifests`.
4. Run `npm run test:isolation`.
5. Package both targets and validate their archive contents.

## Browser packages

Run the following command to rebuild the chart bundle and create a versioned ZIP in `dist/`:

```shell
npm run package
```

This produces Chrome and Firefox archives from the same runtime files and a generated target manifest:

- `dist/publisher-analytics-chrome-<version>.zip` for the Chrome Web Store.
- `dist/publisher-analytics-firefox-<version>.zip` for Mozilla Add-ons.

The archives contain only extension runtime files and bundled license notices. Mozilla reviewers may also require the repository source and the documented chart build command because the submitted archive contains a minified generated ECharts bundle.
