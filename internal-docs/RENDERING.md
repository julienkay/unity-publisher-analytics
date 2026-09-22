# Rendering architecture

Status: active. A modular ECharts bundle powers all analytics charts. These
charts include the Dashboard views, revenue timeline, lifetime-growth chart,
daily calendar, revenue-composition views, and package detail trends.

The package detail page draws a gross-revenue line chart from the selected
package's daily records. When free claims exist in the selected range, a second
chart shows paid sales and free claims separately. Otherwise, omit the second
chart. A native table shows monthly gross revenue as a year-by-month heatmap.
It distinguishes recorded zero revenue from months
without selected-range records. The same selected range supplies the metrics
beside the charts. The page does not combine package records with catalog-wide
daily records.

Daily Patterns has two heatmap layouts. The year calendar uses the ECharts
calendar coordinate system. The asset heatmap uses category axes. It shows one
row for each asset and one column for each day. The horizontal data zoom starts
with the complete selected range. The color scale uses the square root of each
value. Tooltips show the exact value. The asset heatmap uses the shared violet
scale. It does not draw cell borders. This style keeps dense daily slices
visually continuous.
The date axis shows months for short windows. It shows quarters for medium
windows and years for long windows. The labels update when the zoom changes.

## Decision

Use three deliberately separate layers:

1. **Native DOM and CSS** for the application shell, controls, KPI cards, tables, empty states, and accessible text summaries.
2. **Apache ECharts 6** is the primary engine for interactive charts and
   diagrams. It supports time series, bars, areas, scatter plots, heatmaps,
   treemaps, funnels, graphs, and Sankey diagrams.
3. **Small custom SVG components** support only simple product-specific visuals.
   Examples include a small sparkline or coverage strip.

Do not introduce a general UI framework. The current interface is small enough
for native DOM rendering. Chart redraws can remain isolated from the other UI.

## Why ECharts

ECharts provides the required chart coverage in one runtime. It includes more
than 20 chart types and supports Sankey diagrams, data transforms, and responsive
configuration. It also supports accessibility, progressive rendering, Canvas,
and SVG.

Use SVG by default for ordinary dashboard charts. SVG output remains crisp,
inspectable, and styleable. Use Canvas when dense views make SVG expensive.
Each chart adapter must select its renderer explicitly.

## Alternatives considered

- **Observable Plot:** It has good defaults and concise exploratory charts. It
  overlaps the standard chart layer and gives less control over specialized
  diagrams. It would also add D3 as a second large runtime.
- **Vega-Lite:** It has a strong grammar for conventional statistical graphics.
  Sankey and custom interactions are not first-class features. Its compile and
  runtime stack is larger than this extension needs.
- **D3:** It supports custom visualizations but is too low-level for the default
  dashboard engine. Use individual D3 modules only when an ECharts custom series
  cannot express a required visualization.
- **Fully custom Canvas or SVG:** Use this option for small visuals, not for a
  growing chart catalog. Custom code would need axes, scales, tooltips,
  selection, accessibility, resizing, and export. This work could also create
  inconsistent behavior.

## Packaging

Manifest V3 does not permit remotely hosted executable code. Pin ECharts to an
exact version. Generate a local modular bundle with only the required charts,
components, and renderers. Commit the bundle and its license notice. Do not load
chart code from a CDN.

The modular build includes:

- Line, heatmap, and Sankey series.
- Tooltip, grid, data zoom, calendar, visual-map, and accessibility components.
- The SVG renderer.

Add other series, components, and the Canvas renderer only when a shipped visualization needs them. Rebuild and commit `vendor/echarts.min.js` and its legal notice after changing the entry point.

## Data boundary

Charts receive view models, never raw database records. A pure aggregation layer should own:

- Time bucketing by day, ISO week, calendar month, quarter, year, and lifetime.
- Range and package filtering.
- Previous-period comparisons.
- Currency, missing-data, and partial-period semantics.
- Sankey node and edge construction that never implies user-level journeys from aggregate data.

This keeps analytical meaning testable and independent of the rendering library.

## Performance rules

- Aggregate once per filter change and share immutable view models across charts.
- Update existing ECharts instances instead of recreating them on every render.
- Observe container size and resize charts only when dimensions change.
- Dispose chart instances when their view is removed.
- Disable or reduce animation for large datasets and honor `prefers-reduced-motion`.
- Use progressive rendering or Canvas when mark counts justify it. Do not
  optimize by guesswork.

## Accessibility

Each visualization needs a useful title and a concise text summary. It also
needs keyboard-reachable controls, non-color-only encoding, and a tabular data
export. ECharts accessibility output does not replace these requirements.

## References

- [Apache ECharts features](https://echarts.apache.org/en/feature.html)
- [Apache ECharts API](https://echarts.apache.org/en/api.html)
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Observable Plot design tradeoffs](https://observablehq.com/plot/why-plot)
- [Vega-Lite documentation](https://vega.github.io/vega-lite/docs/)
