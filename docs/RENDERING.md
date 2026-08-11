# Rendering architecture

Status: active. A modular ECharts bundle powers the Dashboard portfolio pulse, revenue timeline, daily calendar, and revenue-flow views.

## Decision

Use three deliberately separate layers:

1. **Native DOM and CSS** for the application shell, controls, KPI cards, tables, empty states, and accessible text summaries.
2. **Apache ECharts 6** as the primary engine for interactive charts and diagrams, including time series, bars, areas, scatter plots, heatmaps, treemaps, funnels, graphs, and Sankey diagrams.
3. **Small custom SVG components** only for product-specific micro-visuals that would be simpler than configuring a chart engine, such as a tiny sparkline or coverage strip.

Do not introduce a general UI framework. The current interface is small enough for native DOM rendering, and chart redraws can remain isolated from the rest of the surface.

## Why ECharts

ECharts offers the broadest useful coverage in one runtime for this product. It provides more than 20 built-in chart types, Sankey support, datasets and transforms, responsive configuration, accessibility features, progressive rendering, and interchangeable Canvas and SVG renderers.

Use SVG by default for ordinary dashboard charts because it remains crisp, inspectable, and styleable. Use Canvas for dense heatmaps, scatter plots, or other views with enough marks to make SVG expensive. Each chart adapter chooses its renderer explicitly.

## Alternatives considered

- **Observable Plot:** excellent defaults and concise exploratory charts, but it overlaps the standard chart layer while offering less control over specialized interactive diagrams. It would also bring D3 as a second substantial runtime.
- **Vega-Lite:** a strong declarative grammar for conventional statistical graphics, but Sankey and bespoke interaction are not first-class, and the compile/runtime stack is more machinery than this extension needs.
- **D3:** unmatched for bespoke visualization, but too low-level as the default dashboard engine. Consider individual D3 modules only if a future visualization cannot be expressed well as an ECharts custom series.
- **Fully custom Canvas or SVG:** appropriate for tiny visuals, not for a growing catalog of charts. Rebuilding axes, scales, tooltips, selection, accessibility, resizing, and export would consume product time and create inconsistent behavior.

## Packaging

Manifest V3 does not permit remotely hosted executable code. Pin ECharts to an exact version, generate a local modular bundle containing only the chart types, components, and renderers in use, and commit the distributable bundle with its license notice. Do not load chart code from a CDN.

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
- Use progressive rendering or Canvas when mark counts justify it; do not optimize by guesswork.

## Accessibility

Every visualization needs a useful title, a concise textual takeaway or summary, keyboard-reachable controls, non-color-only encodings, and a tabular export of the represented data. ECharts accessibility output supplements these requirements rather than replacing them.

## References

- [Apache ECharts features](https://echarts.apache.org/en/feature.html)
- [Apache ECharts API](https://echarts.apache.org/en/api.html)
- [Chrome Manifest V3](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3)
- [Observable Plot design tradeoffs](https://observablehq.com/plot/why-plot)
- [Vega-Lite documentation](https://vega.github.io/vega-lite/docs/)
