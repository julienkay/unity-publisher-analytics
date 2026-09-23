# Interface design

This is the shared visual contract for every Publisher Analytics+ surface. New views should reuse these rules before introducing a new pattern.

## Principles

- **Readable before dense.** Publishers should understand the hierarchy without leaning in or hunting for context.
- **One question per view.** Keep each analytics page focused. Use tabs to
  switch questions instead of stacking unrelated charts.
- **Quiet structure.** Prefer spacing, type, and subtle borders over heavy decoration.
- **Consistent meaning.** A color, label, metric, or interaction should mean the same thing everywhere.
- **Progressive detail.** Keep common controls visible and place advanced choices in an anchored popover or focused panel.
- **No duplicate answers.** Show a metric once at the strongest useful level.
  Repeat it only when the second presentation adds a different comparison or
  decision. Review headings and headline values for repetition before release.

## Typography

The type tokens live on `#upa-root` in `styles.css`.

| Role | Token | Size | Use |
|---|---|---:|---|
| Page title | `--upa-font-page-title` | 31px | Dashboard or workspace title |
| Section title | `--upa-font-section-title` | 18px | Card and chart title |
| Lead | `--upa-font-lead` | 13px | Header descriptions |
| Body | `--upa-font-body` | 12px | Explanations and chart descriptions |
| Supporting | `--upa-font-support` | 11px | Secondary values and compact prose |
| Caption | `--upa-font-caption` | 10px | Hints, legends, badges, and chart axes |
| Label | `--upa-font-label` | 9px | Short uppercase metadata only |

- Use at least 1.4 line-height for prose.
- Never render explanatory prose below 10px.
- Reserve uppercase, tracking, and 9px labels for short categories such as `PERFORMANCE` or `FROM`.
- Use weight and color to create hierarchy. Do not shrink important text to make
  it fit.

## Layout and surfaces

- Build spacing from 4px increments. Prefer 8, 12, 16, 24, and 32px.
- Keep page gutters responsive with the existing `clamp(24px, 4vw, 58px)` pattern.
- Use white cards on the neutral workspace background, a subtle border, and restrained shadow.
- Keep the page title and global controls in the header. Place the time range at the top right and preserve it across views.
- Show one analytics view at a time. Dashboard may combine headline metrics with a small set of complementary overview visualizations.
- On narrow screens, stack content and controls before reducing text size.
- Performance charts use a two-column grid by default. Publishers can select
  one full-width column. Narrow screens always show one column.

## Components

- Controls are 38–42px high, use a 9px uppercase label, and expose a visible focus state.
- Menus and advanced editors open beneath their trigger and dismiss with outside click or Escape.
- Primary actions use the violet accent. Destructive actions require explicit
  wording and confirmation.
- Cards begin with an eyebrow, title, one-sentence explanation, and optional tools aligned on the right.
- Dense package tables use a strong identity column, single-line values, clear row separators, and horizontal scrolling instead of compressed text.
- A package name in the Dashboard table or a row in Analytics > Packages opens a package detail page. The main header names the package. Do not repeat the name or add a back link above the charts. The Dashboard navigation returns to the dashboard. The Analytics navigation returns to the last selected analytics view. The page keeps the selected time range and interval. It places a selected-range revenue-and-growth chart and a full-history monthly revenue heatmap on the left, with package-only metrics on the right. The heatmap is independent of the selected time range. Use a compact tab header above the chart to switch the revenue line between cumulative revenue and revenue by interval. Keep the rolling 12-month growth bars visible in both views. The interval controls both revenue aggregation and growth sampling. A chart tooltip shows revenue and growth together at the selected date. Show gross revenue and the latest rolling 12-month growth as two headline metric cards. Do not repeat these values above the chart. Calculate growth at complete interval boundaries. Require two complete 12-month comparison periods before showing a growth value. Show the acquisitions chart and free-claims metric only when the selected range has claims. Do not show a combined sales-and-claims total. Put the conversion definition in an info tooltip. Narrow screens stack the metrics above the charts. The heatmap scrolls horizontally rather than compressing month labels.
- On a package page, mention free claims in the conversion tooltip only when
  the selected time range includes them.
- Qualify Sales as paid units only when free claims are also visible.
- Put previous and next asset controls in the header with the other page-level
  controls. Use the stable alphabetical asset order. Wrap from the first asset
  to the last and from the last asset to the first. Keep the selected time range
  and interval when the publisher changes assets. Keep the controls in a fixed
  screen position when asset-name lengths differ. Disable both controls when
  only one asset exists.
- Keep metric comparisons secondary to the current value. State the preceding
  period. Omit the comparison when its baseline is incomplete or zero.
- Move calculation details into a focused, keyboard-accessible info tooltip when persistent helper text would repeat across a compact metric grid.
- Empty, loading, error, and success states use publisher-facing language and keep the next action obvious.
- Tooltips must add information or context. Do not use them to repeat the
  visible label or value.

## Charts

- Start with the question the chart answers, then choose the visualization.
- Use the shared semantic colors. Use violet for revenue and cyan for pageviews.
  Use amber for downloads, green for positive states, and rose for negative
  movement.
- Keep axes and legends at 10px or larger when space allows. Tooltips use at
  least 11px.
- Put units in labels or tooltips, format values consistently, and make the active date range explicit near the chart.
- Avoid visual noise: hide meaningless zero hover states, soften grid lines, and keep legends separated from plotted data.
- Preserve zoom, pan, export, and share behavior where those interactions are useful.
- Daily Patterns has two views. Year calendar shows seasonality across years.
  Asset heatmap shows one asset per row and one day per column. The asset
  heatmap opens the complete selected range. Its timeline can reduce the
  visible range.

## Responsive and accessible behavior

- Keep interactive targets at least 38px high and provide keyboard-visible focus rings.
- Preserve logical tab order, semantic labels, and Escape dismissal for overlays.
- Never communicate meaning by color alone.
- At mobile widths, allow charts to scroll when compression would damage readability.
- Respect reduced-motion preferences.

## Review checklist

Before shipping an interface change, check that it:

1. Reuses the type, spacing, color, card, and control patterns above.
2. Contains no explanatory prose below 10px.
3. Works at desktop and mobile widths without clipped controls or unreadable charts.
4. Has clear hover, focus, empty, loading, and error behavior where applicable.
5. Uses publisher language and introduces no publisher-specific assumptions.
6. Does not repeat a heading, metric, or explanation without adding new value.
