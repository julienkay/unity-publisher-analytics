# Development and packaging

This document contains repository setup and packaging notes for maintainers.
[VISION.md](../VISION.md) describes product direction. The
[maintainer documentation](README.md) indexes data and interface constraints.

For the complete command and script reference, see [SCRIPTS.md](SCRIPTS.md).

## Runtime architecture

Publisher Analytics+ is a Manifest V3 extension for Chrome and Firefox, limited to `publisher.unity.com`. It uses the signed-in Portal session and the reporting endpoints already used by the Unity Publisher Portal.

An extension-owned IndexedDB database stores normalized analytics and the sync
checkpoint. Local extension storage contains preferences, publisher presentation
details, and package groups. Each publisher ID selects an independent local
workspace. Each browser profile has a separate extension origin. Thus, Chrome
and Firefox do not automatically share analytics, preferences, or package
groups.

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

Firefox 140 or newer is required. The application APIs are available from
Firefox 128. Firefox also requires a built-in no-data-collection declaration.
This declaration sets the package minimum to Firefox 140 on desktop and 142 on
Android. Firefox removes temporary add-ons when it exits. Mozilla must sign
permanently installed builds.

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
4. Run `npm run test:fixtures`.
5. Run `npm run test:isolation`.
6. Package both targets and validate their archive contents.

## Browser packages

Run the following command to rebuild the chart bundle and create a versioned ZIP in `dist/`:

```shell
npm run package
```

This produces Chrome and Firefox archives from the same runtime files and a generated target manifest:

- `dist/publisher-analytics-chrome-<version>.zip` for the Chrome Web Store.
- `dist/publisher-analytics-firefox-<version>.zip` for Mozilla Add-ons.

The archives contain only extension runtime files and bundled license notices. Mozilla reviewers may also require the repository source and the documented chart build command because the submitted archive contains a minified generated ECharts bundle.
