# Vision

Unity Publisher Analytics+ should give every Asset Store publisher a clear, trustworthy, and configurable view of how their catalog performs over its full available lifetime—without spreadsheets, manual exports, or analytics infrastructure of their own.

## The problem

The official Publisher Portal is useful for checking recent activity, but too constrained for understanding a publishing business over time:

- Analytics are limited to a maximum one-year view.
- Charts use fixed daily data points instead of letting publishers group results by week, month, quarter, year, or another useful interval.
- The available charts and comparisons answer only a narrow set of questions.
- Long-term and package-lifetime questions require repeated exports and custom spreadsheet work.

The extension exists to retain the complete available history locally and turn it into a flexible analytics workspace. Publishers should be able to choose the time range, granularity, metrics, breakdowns, and visualization that fit the question they are asking.

## Who it serves

Independent publishers and small teams who use the Unity Publisher Portal to understand sales, revenue, reach, conversion, downloads, and package performance.

## Product principles

- **Publisher language first.** Describe sales, downloads, packages, dates, and progress—not requests, endpoints, or storage internals.
- **Complete by default.** Discover the signed-in publisher's packages and available history dynamically. Never assume a publisher ID, catalog, or start date.
- **Trustworthy numbers.** Preserve the meaning and precision of Unity's source data, make time ranges explicit, and avoid combining unlike metrics.
- **Flexible time.** Treat day, week, month, quarter, year, and lifetime as different valid ways to examine the same history.
- **Questions before charts.** Design analysis around decisions publishers want to make, then choose the visualization that explains the answer best.
- **Local and private.** Keep publisher data in the browser, contact only Unity, and add no telemetry or external service by default.
- **Effortless continuity.** Full-history collection must survive refreshes, clearly show what is happening, and keep recent data current afterward.
- **Useful before elaborate.** Prefer a small set of decision-supporting views over a dense dashboard of vanity metrics.

## Current product

The extension builds a local historical dashboard from the reporting data available to the signed-in Unity publisher. It combines monthly financial results, downloads, the revenue ledger, and daily portfolio and per-package performance.

The first experience should answer:

1. How much did I earn and how is that changing?
2. Which packages attract attention and convert?
3. How do sales, claims, downloads, refunds, and wishlists move over time?
4. Is my data complete and up to date?

As the product develops, it should also answer questions such as:

- What is the lifetime revenue, unit volume, refund rate, and download count of a package?
- How does this week, month, quarter, or year compare with the equivalent previous period?
- Which packages drive the largest share of revenue, traffic, and downloads?
- Where does the portfolio appear to lose momentum between views, wishlists, purchases or claims, and downloads?
- How have catalog growth, releases, and seasonality changed the business over its lifetime?

## Direction

Near-term work should improve confidence and analysis rather than add ingestion paths:

- Clear date, package, metric, and aggregation controls.
- Daily, weekly, monthly, quarterly, yearly, and lifetime views.
- Comparisons with previous periods and meaningful trend explanations.
- Package-level lifetime summaries and drill-downs.
- Additional chart types—including flow and Sankey diagrams—when the source metrics support an honest interpretation of those relationships.
- Visible data coverage, freshness, and recoverable sync failures.
- Exports that remain useful outside the extension.

## Non-goals

- Replacing the Unity Publisher Portal or payout records.
- Sending publisher data to a hosted analytics backend.
- Hardcoding behavior for one publisher's catalog or history.
- Treating undocumented implementation details as user-facing concepts.
- Adding fallback data sources until the primary source proves insufficient.
- Implying individual customer journeys or causal relationships when only aggregate data is available.

## Success

A publisher can install the extension, sync their complete available history without configuration, understand what is happening throughout the process, and answer long-term or package-level questions by changing the range, interval, breakdown, or visualization—without rebuilding the analysis in a spreadsheet.
