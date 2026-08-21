# Repository scripts

This page is the command reference for maintainers. Run commands from the
repository root unless a section gives a different location.

## Setup

Install the pinned development dependencies before running the Node-based scripts:

```shell
npm install
```

The image-processing dependency requires Node.js 20.9 or newer. Marketing
screenshot capture also requires a Chromium-family browser. On Windows, the
default browser is Microsoft Edge at this location:

```text
C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe
```

Set `UPA_BROWSER_PATH` when the browser executable is elsewhere:

```powershell
$env:UPA_BROWSER_PATH = "C:\Path\To\chrome.exe"
npm run capture:marketing
```

## Command summary

| Command | Purpose | Output |
|---|---|---|
| `npm run build:charts` | Build the local ECharts runtime used by the extension. | `vendor/echarts.min.js` and its legal notice |
| `npm run test:fixtures` | Check the fixture-backed package publication-date mapping. | Console pass/fail result |
| `npm run test:isolation` | Check publisher ownership and package-group source invariants. | Console pass/fail result |
| `npm run test:chrome-smoke` | Load the unpacked extension in a temporary browser profile and exercise its background storage APIs. | Console pass/fail result |
| `npm run capture:marketing` | Render every Chrome Web Store feature screenshot in light mode from fictional data. | `marketing/screenshots/*.png` |
| `npm run capture:marketing -- [light\|dark] [png\|webp] [capture-name]` | Render all screenshots, or one named screenshot, in the selected theme and format. | Files in `marketing/screenshots/` |
| `npm run create:promos` | Compose the small and marquee promotional tiles. | `marketing/promos/*.png` |
| `npm run validate:manifests` | Validate the generated Chrome and Firefox manifests and their allowlisted differences. | Console pass/fail result |
| `npm run validate:packages` | Validate both packaged archives and compare their runtime payloads. | Console pass/fail result |
| `npm run package` | Rebuild charts and create both uploadable browser archives. | Chrome and Firefox ZIPs in `dist/` |
| `npm run package:chrome` | Rebuild charts and create only the Chrome archive. | `dist/publisher-analytics-chrome-<version>.zip` |
| `npm run package:firefox` | Rebuild charts and create only the Firefox archive. | `dist/publisher-analytics-firefox-<version>.zip` |

## Chart bundle

Source: [`scripts/echarts-entry.js`](../scripts/echarts-entry.js)

```shell
npm run build:charts
```

The entry file registers only the ECharts charts, components, features, and SVG renderer used by the extension. The command bundles it as a local minified IIFE because Manifest V3 runtime code must not come from a CDN.

Commit both generated files after changing the entry point or the ECharts version:

- `vendor/echarts.min.js`
- `vendor/echarts.min.js.LEGAL.txt`

## API fixture validation

Source: [`scripts/validate-api-fixtures.js`](../scripts/validate-api-fixtures.js)

```shell
npm run test:fixtures
```

This validation currently checks one mapping. It confirms that the package
publication-date aliases in `content.js` include `first_published_at`, and that
the mapping parses every publication date in
`once-published-packages.json`. It does not run the other normalizers. It does
not validate the fixture manifest, provenance files, boundary behavior, privacy,
or live Portal responses.

Extend this script, or add a focused validator, when a new fixture field,
response variant, or record type becomes part of normalized behavior. A passing
result does not prove that Unity's undocumented responses are unchanged.

## Publisher-isolation validation

Source: [`scripts/validate-publisher-isolation.js`](../scripts/validate-publisher-isolation.js)

```shell
npm run test:isolation
```

This lightweight source validation checks that:

- API forwarding still permits only the expected Unity paths and methods.
- Publisher IDs propagate through records, metadata, sync jobs, and preferences.
- IndexedDB ownership checks and publisher-qualified indexes remain present.
- Package groups remain publisher-scoped and outside analytics-data clearing.

This validation is not a browser integration test. It does not prove that
Unity's undocumented response shapes are unchanged.

## Chrome extension smoke test

Source: [`scripts/smoke-chrome.mjs`](../scripts/smoke-chrome.mjs)

```shell
npm run test:chrome-smoke
```

The smoke test starts Microsoft Edge with a temporary profile. It loads the
repository root as an unpacked extension. It checks the MV3 service worker,
session storage, and IndexedDB. It does not open the Publisher Portal. It does
not use an existing profile, credentials, or real publisher data. The marketing
preview tests the injected interface with fictional data. Set `UPA_BROWSER_PATH`
to another Chromium-family browser when Edge is unavailable.

## Marketing screenshots

Sources:

- [`scripts/capture-marketing.mjs`](../scripts/capture-marketing.mjs) starts a local preview server, drives a headless browser, and captures the pages.
- [`scripts/marketing-preview.html`](../scripts/marketing-preview.html) provides the browser and extension API stubs used by the preview.
- [`scripts/marketing-fixture.js`](../scripts/marketing-fixture.js) generates deterministic, fictional publisher history for Northstar Studio.

Generate the complete screenshot set:

```shell
npm run capture:marketing
```

Light mode is the default. Generate the complete dark-mode set with:

```shell
npm run capture:marketing -- dark
```

Generate one screenshot by its capture name:

```shell
npm run capture:marketing -- 04-daily-calendar
```

Pass `light` or `dark` before the capture name to select a theme explicitly:

```shell
npm run capture:marketing -- dark 04-daily-calendar
```

PNG is the default output format. Pass `webp` to produce high-quality WebP files instead:

```shell
npm run capture:marketing -- webp
npm run capture:marketing -- dark webp 04-daily-calendar
```

Theme, format, and capture-name arguments may appear in any order. WebP output uses quality 95, effort 6, and smart chroma subsampling.

Available capture names:

| Name | Surface |
|---|---|
| `00-first-sync` | First-run welcome screen with mock sync progress |
| `01-dashboard` | Dashboard and revenue mix |
| `02-revenue` | Performance charts |
| `03-package-lifetime` | Lifetime growth |
| `04-daily-calendar` | Daily patterns calendar |
| `05-revenue-composition` | Category and package revenue flow |
| `06-packages` | Package ranking |
| `07-settings` | Data coverage and local storage settings |

The browser first renders at 3200×2000. Sharp uses Lanczos filtering to reduce
the image to 1280×800. It writes opaque RGB PNG or WebP files. Use PNG for the
Chrome Web Store. WebP is available for other marketing channels. Light-mode
files keep the base capture name. Dark-mode files add `-dark`, for example
`04-daily-calendar-dark.webp`. Thus, both sets can exist together.

Outputs under `marketing/screenshots/` are generated artifacts and are ignored by Git. The fixture and preview must never contain real publisher data, IDs, package names, or account-specific history.

## Promotional tiles

Source: [`scripts/create-promo-tiles.mjs`](../scripts/create-promo-tiles.mjs)

Tracked inputs:

- [`scripts/marketing-assets/promo-background.png`](../scripts/marketing-assets/promo-background.png) — reusable generated background artwork.
- `icons/publisher-analytics-128.png` — extension icon.

Generated input:

- `marketing/screenshots/01-dashboard.png` — synthetic dashboard shown in the marquee tile.

Generate the dashboard screenshot and both promotional tiles:

```shell
npm run capture:marketing -- 01-dashboard
npm run create:promos
```

The outputs are:

- `marketing/promos/small-promo-440x280.png`
- `marketing/promos/marquee-promo-1400x560.png`

Both files are opaque, 24-bit RGB PNGs at their exact Chrome Web Store dimensions. Outputs under `marketing/promos/` are ignored by Git.

To try a different background without changing the tracked default, pass its path directly:

```shell
node scripts/create-promo-tiles.mjs "C:\Path\To\background.png"
```

## Extension package

Sources:

- [`scripts/generate-manifest.mjs`](../scripts/generate-manifest.mjs) creates a target manifest from the canonical root manifest.
- [`scripts/package-extension.ps1`](../scripts/package-extension.ps1) creates one or both browser archives atomically.
- [`scripts/validate-manifests.mjs`](../scripts/validate-manifests.mjs) checks the canonical and generated manifests.
- [`scripts/validate-packages.ps1`](../scripts/validate-packages.ps1) checks archive contents and shared runtime hashes.

Recommended command:

```shell
npm run package
```

This command rebuilds the chart bundle and validates both target manifests. It
creates the Chrome and Firefox ZIP files in `dist/`. It then validates their
contents. Both packages contain the same runtime files. Chrome uses an extension
service worker. Firefox uses a non-persistent background script. The Firefox
manifest also contains its identity, minimum version, and data-collection
declaration.

Create one target only:

```shell
npm run package:chrome
npm run package:firefox
```

Run the packaging script without rebuilding charts only when deliberately testing packaging behavior:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/package-extension.ps1 -Target All
```

The package commands generate manifests only in temporary packaging files. They do not change the canonical `manifest.json` or bump the extension version.

## Required validation before finishing

The repository guidance requires rebuilding charts, checking every JavaScript file, and validating the manifest before finishing a change. On PowerShell:

```powershell
npm run build:charts
$files = @(rg --files -g '*.js' -g '*.mjs')
foreach ($file in $files) {
  node --check $file
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
node scripts/validate-manifests.mjs
npm run test:fixtures
npm run test:isolation
npm run test:chrome-smoke
npm run package
```

The package command validates both archive manifests and their exact file lists.
It also checks that shared runtime files have identical bytes. Run the isolation
check when a change can affect publisher isolation or package groups. Include
this inexpensive check in the normal validation pass.
