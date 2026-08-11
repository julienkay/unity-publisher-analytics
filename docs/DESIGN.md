# Interface design

This is the shared visual contract for every Analytics+ surface. New views should reuse these rules before introducing a new pattern.

## Principles

- **Readable before dense.** Publishers should understand the hierarchy without leaning in or hunting for context.
- **One question per view.** Keep each analytics page focused; use tabs to switch questions instead of stacking unrelated charts.
- **Quiet structure.** Prefer spacing, type, and subtle borders over heavy decoration.
- **Consistent meaning.** A color, label, metric, or interaction should mean the same thing everywhere.
- **Progressive detail.** Keep common controls visible and place advanced choices in an anchored popover or focused panel.

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
- Use weight and color to create hierarchy; do not shrink important text to make it fit.

## Layout and surfaces

- Build spacing from 4px increments; prefer 8, 12, 16, 24, and 32px.
- Keep page gutters responsive with the existing `clamp(24px, 4vw, 58px)` pattern.
- Use white cards on the neutral workspace background, a subtle border, and restrained shadow.
- Keep the page title and global controls in the header. Place the time range at the top right and preserve it across views.
- Show one analytics view at a time. Dashboard may combine headline metrics with one general overview visualization.
- On narrow screens, stack content and controls before reducing text size.

## Components

- Controls are 38–42px high, use a 9px uppercase label, and expose a visible focus state.
- Menus and advanced editors open beneath their trigger and dismiss with outside click or Escape.
- Primary actions use the violet accent; destructive actions require explicit wording and confirmation.
- Cards begin with an eyebrow, title, one-sentence explanation, and optional tools aligned on the right.
- Dense package tables use a strong identity column, paired primary/secondary values, and horizontal scrolling instead of compressed text.
- Empty, loading, error, and success states use publisher-facing language and keep the next action obvious.

## Charts

- Start with the question the chart answers, then choose the visualization.
- Use the shared semantic colors: violet for revenue, cyan for pageviews, amber for downloads, green for positive performance/status, and rose for negative movement.
- Keep axes and legends at 10px or larger when space allows; tooltips use at least 11px.
- Put units in labels or tooltips, format values consistently, and make the active date range explicit near the chart.
- Avoid visual noise: hide meaningless zero hover states, soften grid lines, and keep legends separated from plotted data.
- Preserve zoom, pan, export, and share behavior where those interactions are useful.

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
