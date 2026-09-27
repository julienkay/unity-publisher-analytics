# Rendering architecture

Status: active. A modular ECharts bundle powers all analytics charts. These
charts include the Dashboard views, revenue timeline, lifetime-growth chart,
daily calendar, revenue-composition views, and package detail trends.

The package detail page draws a revenue line above rolling 12-month growth bars.
A compact tab header switches the line between cumulative revenue and revenue
by the selected interval. The growth bars remain visible in both views. The
selected interval also sets the growth sampling frequency. Each bar compares
the trailing 12 months at a complete interval boundary with the preceding 12
months. The calculation can use older records for its comparison baseline. It
stays unavailable until both comparison periods are complete. A partial current
interval does not produce a growth bar. Both tracks follow the selected time
range and use one shared visible time domain. Older records can supply the
growth baseline, but they do not extend the visible growth axis. The tooltip
shows the revenue and growth values together at the shared date. The metric
panel shows the latest completed growth value at or before the
end of the selected range. When free claims exist in the selected range, a
second chart shows paid sales and free claims separately. It uses the selected
interval. Otherwise, omit the second chart. A native table shows
the package's complete available monthly gross revenue history as a
year-by-month heatmap. The selected page range does not filter this table. It
distinguishes recorded zero revenue from months without available records. The
selected range supplies the metrics beside the charts. The page does not
combine package records with catalog-wide daily records.

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

## Workspace recalculation

The workspace builds record indexes once for each loaded records array. The
indexes group rows by type and reporting scope, sort them by date, and support
date-range selection with binary search. Replacing the records array rebuilds
the indexes. Current loading and sync paths replace the array after data
changes.

Date-range changes recalculate range-dependent summaries and charts. Lifetime,
package-history, and package revenue heatmap models do not depend on the
selected range. Keep these models cached for the current records array. The
calendar and asset heatmap depend on the selected range.

Analytics range-dependent models are refreshed for the selected view. Models
for other Analytics views keep their previous values until the publisher opens
those views. The view switch checks its model key and runs a synchronous render
when the key is stale. This keeps the complete saved history available before
any view is shown. The calendar model includes the selected date range. The
asset heatmap is built when its view is active. Do not show an empty placeholder
as if it were current data.

Do not cache a model without listing its inputs. Include every preference and
metadata source that can change the result. Keep caches scoped to the current
records array so a publisher switch, data clear, or completed sync cannot show
stale results.

### View freshness rules

A model is current only when its inputs match the current workspace state.
A freshness key records the inputs used to build a model. It does not record
the inputs from the most recent call to `renderWorkspace()`.

These rules apply to Dashboard, Analytics, and package details:

- Keep the selected range in shared preferences. Resolve its start and end
  dates with `selectedDateBounds()` for every dependent view.
- Include all model inputs in its freshness check. These can include resolved
  dates, interval, metric, scopes, groups, package metadata, and display options.
  Include the range preset when it changes labels or comparison periods.
- Keep a reused model's original freshness key. Assign a new key only after
  rebuilding that model. Never attach the current range key to previous data.
- Associate models with their source records array. Replace that array when
  data changes. In-place record changes bypass checks based on array identity.
- Check the destination before every navigation path displays it. Check both
  `switchAnalyticsView()` and `switchWorkspaceSection()`. A tab check alone
  does not protect navigation from Dashboard to Analytics or back.
- Rebuild a stale destination synchronously from the loaded records. Hidden
  views can retain old models until opened. Do not display those models first.
- Update charts, totals, tables, legends, labels, tooltips, and chart export
  metadata from the same inputs. A correct range label does not prove that
  the chart or table uses that range.
- Update header controls when changing views. Lifetime growth hides the range
  control. Returning to a range-dependent view restores it.
- Distinguish an unbuilt model from a current model with no results. Do not
  mark an empty placeholder as current data.

Only reuse a range-independent model if its calculation ignores the selected
range. Lifetime growth and the package revenue heatmap use complete history.
The daily calendar and asset heatmap use the selected range. Comparisons and
trailing metrics can use older records without changing the visible range.

Keep this mechanism small. Reuse the existing keys and synchronous render
fallback. Do not add background calculation, persistent caches, or validation
of every record to solve view freshness. Do not serialize the dataset to
compare model inputs.

### Navigation regression checks

For changes to ranges, navigation, or model reuse, test transitions with the
local fixture. Choose periods with different totals. Check values and dates,
not only control text or chart visibility.

1. Open Dashboard with All time. Open Analytics and select Last 7 days.
   Return to Dashboard. Check its charts, totals, and package table.
2. Change the range on Dashboard. Open each Analytics view. Return to a
   previously opened view. Check that every range-dependent result changes.
3. Repeat with a custom range and a range with no records. Return to All time.
   Check that empty results and previous results do not remain visible.
4. Switch between the daily calendar and asset heatmap. Change the range in
   another view. Return to each layout. Check dates, cells, and totals.
5. Open Lifetime growth, then Performance. Check range and interval controls.
   Check that lifetime results still use complete history.
6. Replace the records through refresh, publisher change, or data clearing.
   Revisit a previously opened view. Check that previous models are not reused.

For a regression fix, add a focused automated check for the failing transition.
Compare the result with fixture-derived expectations or a fresh render using
the same final state. A successful initial render does not test navigation.
Record which transitions were tested. This checklist does not establish that
the current implementation passes them.

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

- Line, bar, heatmap, and Sankey series.
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
