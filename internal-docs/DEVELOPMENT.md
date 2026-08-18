# Development and packaging

This document contains repository setup and packaging notes for maintainers. Product direction lives in [VISION.md](../VISION.md); data and interface constraints are indexed in the [maintainer documentation](README.md).

## Runtime architecture

Publisher Analytics+ is a Manifest V3 Chrome extension limited to `publisher.unity.com`. It uses the signed-in Portal session and the reporting endpoints already used by the Unity Publisher Portal.

Normalized analytics and the resumable sync checkpoint are stored in an extension-owned IndexedDB database. Preferences, publisher presentation details, and package groups use `chrome.storage.local`. Each publisher ID selects an independent local workspace.

Apache ECharts is bundled with the extension. Runtime dependencies must never be loaded from a CDN.

## Local installation

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select the repository root.
4. Open or refresh a page under `https://publisher.unity.com/` while signed in.
5. Click the **Publisher Analytics+** button or the extension toolbar icon.

After changing extension files, reload the unpacked extension and refresh the Publisher Portal. Do not automate the `chrome://extensions` reload.

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
3. Parse and validate `manifest.json`.
4. Run `npm run test:isolation` when publisher isolation or package groups may be affected.

## Chrome Web Store package

Run the following command to rebuild the chart bundle and create a versioned ZIP in `dist/`:

```shell
npm run package
```

The archive contains only extension runtime files and bundled license notices. Upload it through the Chrome Web Store developer dashboard.
