  function renderLifetimeChart(viewModel) {
    const container = document.getElementById("upa-lifetime-chart");
    if (!container) return;
    if (!viewModel.series.length) { container.innerHTML = `<div class="upa-empty-chart">${viewModel.legend.length ? "Choose at least one package from the legend." : viewModel.metric.emptyLabel}</div>`; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const compactValue = value => new Intl.NumberFormat(undefined, viewModel.metric.currency
      ? { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }
      : { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const fullValue = value => new Intl.NumberFormat(undefined, viewModel.metric.currency
      ? { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }).format(value || 0);
    const dateLabel = timestamp => new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(timestamp);
    const axisLabel = value => viewModel.align === "age" ? `Month ${Math.round(value) + 1}` : dateLabel(value);
    const theme = chartTheme();
    const chart = createChart("lifetime", container); if (!chart) return;
    chart.setOption({
      animation: false,
      color: viewModel.series.map(item => item.color),
      aria: { enabled: true, description: `Cumulative ${viewModel.metric.label.toLowerCase()} for ${viewModel.series.length} packages, aligned by ${viewModel.align === "age" ? `months since ${viewModel.metric.ageDescription}` : "calendar month"}.` },
      grid: { left: 14, right: 20, top: 25, bottom: 72, containLabel: true },
      tooltip: {
        trigger: "axis", confine: true, axisPointer: { type: "line", lineStyle: { color: "#a9afbc" } }, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 },
        formatter: parameters => {
          const visible = parameters.filter(parameter => Array.isArray(parameter.data)).sort((a, b) => b.data[1] - a.data[1]);
          if (!visible.length) return "";
          return `<strong>${axisLabel(visible[0].data[0])}</strong>${visible.map(parameter => `<br/><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${parameter.color};margin-right:6px"></span>${escapeHtml(parameter.seriesName)}&nbsp;&nbsp;${fullValue(parameter.data[1])}`).join("")}`;
        }
      },
      xAxis: viewModel.align === "age"
        ? { type: "value", min: 0, minInterval: 1, axisLine: { lineStyle: { color: theme.axisLine } }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, formatter: value => `${Math.round(value) + 1}m` }, splitLine: { show: false } }
        : { type: "time", boundaryGap: false, axisLine: { lineStyle: { color: theme.axisLine } }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, hideOverlap: true }, splitLine: { show: false } },
      yAxis: { type: "value", min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, formatter: compactValue }, splitLine: { lineStyle: { color: theme.grid } } },
      dataZoom: [
        { type: "inside", filterMode: "none", zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true, preventDefaultMouseMove: true },
        { type: "slider", filterMode: "none", height: 20, bottom: 16, borderColor: "transparent", backgroundColor: theme.zoom, fillerColor: "rgba(108,92,231,.18)", dataBackground: { lineStyle: { color: theme.zoomLine }, areaStyle: { color: theme.zoomArea } }, selectedDataBackground: { lineStyle: { color: "#6c5ce7" }, areaStyle: { color: "#5a4f8f" } }, handleStyle: { color: theme.handle, borderColor: "#6c5ce7" }, moveHandleStyle: { color: "#6c5ce7" }, textStyle: { color: theme.axis, fontSize: 9 } }
      ],
      series: viewModel.series.map(item => ({
        name: item.name, type: "line", data: item.points, stack: viewModel.style === "area" ? "lifetime" : undefined, smooth: .12, showSymbol: false,
        lineStyle: { color: item.color, width: viewModel.style === "area" ? 1.5 : 2.4 }, itemStyle: { color: item.color }, areaStyle: viewModel.style === "area" ? { color: item.color, opacity: .68 } : undefined,
        emphasis: { focus: "series", lineStyle: { width: 3.2 } }
      }))
    });
  }
  function disposeCharts() {
    for (const observer of chartResizeObservers.values()) observer.disconnect();
    for (const chart of chartInstances.values()) chart.dispose();
    chartResizeObservers.clear(); chartInstances.clear();
  }

  function createChart(key, container, onResize) {
    if (!container || !globalThis.UPAECharts?.init) return null;
    const chart = globalThis.UPAECharts.init(container, null, { renderer: "svg" });
    let lastWidth = Math.round(container.clientWidth), lastHeight = Math.round(container.clientHeight);
    const observer = new ResizeObserver(entries => {
      chart.resize();
      const width = Math.round(entries[0]?.contentRect.width || container.clientWidth);
      const height = Math.round(entries[0]?.contentRect.height || container.clientHeight);
      if (onResize && (width !== lastWidth || height !== lastHeight)) {
        lastWidth = width; lastHeight = height;
        onResize(chart, width, height);
      }
    });
    observer.observe(container); chartInstances.set(key, chart); chartResizeObservers.set(key, observer);
    return chart;
  }

  function renderPerformanceChart(viewModel) {
    const key = `performance-${viewModel.metric.id}`, container = document.getElementById(`upa-${key}-chart`);
    if (!container) return;
    if (!viewModel.series.some(item => item.points.length)) { container.innerHTML = `<div class="upa-empty-chart">${viewModel.metric.emptyLabel}</div>`; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const compactValue = value => new Intl.NumberFormat(undefined, viewModel.metric.currency
      ? { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }
      : { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const fullValue = value => new Intl.NumberFormat(undefined, viewModel.metric.currency
      ? { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 }).format(value || 0);
    const dateLabel = timestamp => new Intl.DateTimeFormat(undefined, ["day", "week"].includes(viewModel.interval) ? { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" }).format(timestamp);
    const allPoints = viewModel.series.flatMap(item => item.points).sort((a, b) => a[0] - b[0]);
    const theme = chartTheme();
    const chart = createChart(key, container); if (!chart) return;
    chart.group = "upa-performance";
    globalThis.UPAECharts.connect?.("upa-performance");
    chart.setOption({
      animation: !matchMedia("(prefers-reduced-motion: reduce)").matches && allPoints.length < 400,
      color: viewModel.series.map(item => item.color),
      aria: { enabled: true, description: `${intervalName(viewModel.interval)} ${viewModel.metric.label.toLowerCase()} for ${viewModel.series.map(item => item.name).join(", ")} from ${dateLabel(allPoints[0][0])} to ${dateLabel(allPoints.at(-1)[0])}.` },
      grid: { left: 12, right: 16, top: 18, bottom: 66, containLabel: true },
      tooltip: {
        trigger: "axis", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 },
        formatter: parameters => {
          const visible = parameters.filter(parameter => Array.isArray(parameter.data)).sort((a, b) => b.data[1] - a.data[1]);
          if (!visible.length) return "";
          return `<strong>${dateLabel(visible[0].data[0])}</strong>${visible.map(parameter => `<br/><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${parameter.color};margin-right:6px"></span>${escapeHtml(parameter.seriesName)}&nbsp;&nbsp;${fullValue(parameter.data[1])}`).join("")}`;
        }
      },
      xAxis: { type: "time", boundaryGap: false, axisLine: { lineStyle: { color: theme.axisLine } }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, hideOverlap: true }, splitLine: { show: false } },
      yAxis: { type: "value", min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, formatter: compactValue }, splitLine: { lineStyle: { color: theme.grid } } },
      dataZoom: [
        { type: "inside", filterMode: "none", zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true, preventDefaultMouseMove: true },
        { type: "slider", filterMode: "none", height: 18, bottom: 14, borderColor: "transparent", backgroundColor: theme.zoom, fillerColor: "rgba(108,92,231,.18)", dataBackground: { lineStyle: { color: theme.zoomLine }, areaStyle: { color: theme.zoomArea } }, selectedDataBackground: { lineStyle: { color: "#6c5ce7" }, areaStyle: { color: "#5a4f8f" } }, handleStyle: { color: theme.handle, borderColor: "#6c5ce7" }, moveHandleStyle: { color: "#6c5ce7" }, textStyle: { color: theme.axis, fontSize: 9 } }
      ],
      series: viewModel.series.map(item => ({
        name: item.name, type: "line", data: item.points, smooth: .14, sampling: "lttb", showSymbol: item.points.length <= 80, symbol: "circle", symbolSize: 5,
        lineStyle: { color: item.color, type: item.lineType, width: viewModel.series.length === 1 ? 2.5 : 2 }, itemStyle: { color: item.color }, emphasis: { focus: "series", lineStyle: { width: 3 } }
      }))
    });
  }

  function renderOverviewChart(viewModel) {
    const container = document.getElementById("upa-overview-chart");
    if (!container) return;
    if (!viewModel.points.length) { container.innerHTML = '<div class="upa-empty-chart">No activity is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const theme = chartTheme();
    const chart = createChart("overview", container); if (!chart) return;
    const lookup = new Map(viewModel.points.map(point => [Date.parse(`${point.date}T00:00:00Z`), point]));
    const dateLabel = timestamp => new Intl.DateTimeFormat(undefined, ["day", "week"].includes(viewModel.interval) ? { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" }).format(timestamp);
    const compactNumber = value => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const compactMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const fullMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    const axes = [0, 1, 2].map(index => ({
      type: "time", gridIndex: index, boundaryGap: false, axisLine: { show: index === 2, lineStyle: { color: theme.axisLine } }, axisTick: { show: false },
      axisLabel: { show: index === 2, color: theme.axis, fontSize: 10, hideOverlap: true }, splitLine: { show: false }
    }));
    const yAxes = [
      { name: "REVENUE", formatter: compactMoney, color: "#6c5ce7" },
      { name: "PAGEVIEWS", formatter: compactNumber, color: "#21a7bd" },
      { name: "DOWNLOADS", formatter: compactNumber, color: "#d99721" }
    ].map((axis, index) => ({
      type: "value", gridIndex: index, min: 0, name: axis.name, nameLocation: "end", nameGap: 7, nameTextStyle: { color: axis.color, fontSize: 9, fontWeight: 800, align: "left" },
      axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, formatter: axis.formatter }, splitLine: { lineStyle: { color: theme.grid } }
    }));
    const series = [
      { name: "Gross revenue", key: "revenue", color: "#6c5ce7", area: ["rgba(108,92,231,.2)", "rgba(108,92,231,0)"] },
      { name: "Pageviews", key: "pageViews", color: "#21a7bd", area: ["rgba(33,167,189,.17)", "rgba(33,167,189,0)"] },
      { name: "Downloads", key: "downloads", color: "#d99721", area: ["rgba(217,151,33,.16)", "rgba(217,151,33,0)"] }
    ].map((item, index) => ({
      name: item.name, type: "line", xAxisIndex: index, yAxisIndex: index, data: viewModel.points.map(point => [Date.parse(`${point.date}T00:00:00Z`), point[item.key]]),
      smooth: .16, sampling: "lttb", showSymbol: false, lineStyle: { color: item.color, width: 2 }, itemStyle: { color: item.color },
      areaStyle: { color: new globalThis.UPAECharts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: item.area[0] }, { offset: 1, color: item.area[1] }]) }, emphasis: { focus: "series" }
    }));
    chart.setOption({
      animation: !matchMedia("(prefers-reduced-motion: reduce)").matches && viewModel.points.length < 260,
      aria: { enabled: true, description: `${intervalName(viewModel.interval)} gross revenue, pageviews, and downloads across the selected period.` },
      grid: [{ left: 72, right: 18, top: 25, height: 72 }, { left: 72, right: 18, top: 140, height: 72 }, { left: 72, right: 18, top: 255, height: 72 }],
      tooltip: {
        trigger: "axis", confine: true, axisPointer: { type: "line", lineStyle: { color: "#a9afbc" } }, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 },
        formatter: parameters => { const timestamp = parameters[0]?.value?.[0], point = lookup.get(timestamp); return point ? `<strong>${dateLabel(timestamp)}</strong><br/><span style="color:#aaa3d8">Gross revenue</span>&nbsp;&nbsp;${fullMoney(point.revenue)}<br/><span style="color:#8ad7e2">Pageviews</span>&nbsp;&nbsp;${number(point.pageViews)}<br/><span style="color:#f0c36c">Downloads</span>&nbsp;&nbsp;${number(point.downloads)}` : ""; }
      },
      xAxis: axes, yAxis: yAxes, series
    });
  }

  function renderRevenueMixChart(viewModel) {
    const container = document.getElementById("upa-revenue-mix-chart");
    if (!container || !viewModel.items.length) return;
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const theme = chartTheme();
    const minimumArcPixels = 3.5;
    const chart = createChart("revenueMix", container, (instance, width, height) => instance.setOption({ series: [{ data: revenueMixSliceData(viewModel, width, height, minimumArcPixels) }] })); if (!chart) return;
    const centerLabel = document.getElementById("upa-revenue-mix-label"), centerValue = document.getElementById("upa-revenue-mix-value");
    const updateCenter = item => {
      if (!centerLabel || !centerValue) return;
      centerLabel.textContent = item?.name || viewModel.label;
      centerValue.textContent = money(item?.value ?? viewModel.total);
    };
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: `${viewModel.label} gross revenue split across ${viewModel.packageCount} revenue-generating assets.` },
      tooltip: { show: false },
      series: [{
        name: "Revenue mix", type: "pie", radius: ["62%", "88%"], center: ["50%", "50%"], avoidLabelOverlap: true, selectedMode: false,
        label: { show: false }, labelLine: { show: false }, emphasis: { scale: true, scaleSize: 5, itemStyle: { shadowBlur: 14, shadowColor: "rgba(31,36,53,.16)" } },
        itemStyle: { borderColor: theme.pieBorder, borderWidth: 1, borderRadius: 2 },
        data: revenueMixSliceData(viewModel, container.clientWidth, container.clientHeight, minimumArcPixels)
      }]
    });
    chart.on("mouseover", parameter => updateCenter(parameter.data));
    chart.on("mouseout", () => updateCenter());
  }

  function calendarMetric(metric) {
    return ({
      sales: { key: "sales", label: "Gross revenue", currency: true, description: "Revenue before refunds, chargebacks, and Unity's revenue share." },
      paidQty: { key: "paidQty", label: "Sales", currency: false, description: "Paid units only. Free claims are not included." },
      salesQty: { key: "salesQty", label: "Sales & Claims", currency: false, description: "Paid units and free claims combined." },
      pageViews: { key: "pageViews", label: "Pageviews", currency: false, description: "Views of your Asset Store package pages." },
      downloads: { key: "downloads", label: "Downloads", currency: false, description: "Downloads of package files." },
      ...Object.fromEntries(Object.values(DAILY_METRICS).filter(metric => !metric.ratio).map(metric => [metric.id, { key: metric.field, label: metric.label, currency: false, description: metric.description }]))
    })[metric] || { key: "sales", label: "Gross revenue", currency: true, description: "Revenue before refunds, chargebacks, and Unity's revenue share." };
  }

  function renderPackageTrendChart(key, viewModel, packageName) {
    const container = document.getElementById(`upa-${key}-chart`);
    if (!container) return;
    if (!viewModel.points.length) { container.innerHTML = '<div class="upa-empty-chart">No package activity is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const theme = chartTheme(), chart = createChart(key, container);
    if (!chart) return;
    const compactValue = value => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1, ...(viewModel.currency ? { style: "currency", currency: "USD" } : {}) }).format(value || 0);
    const fullValue = value => viewModel.currency ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0) : number(value);
    const dateLabel = timestamp => new Intl.DateTimeFormat(undefined, ["day", "week"].includes(viewModel.interval) ? { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" }).format(timestamp);
    const values = viewModel.points.map(point => [Date.parse(`${point.date}T00:00:00Z`), point]);
    chart.group = "upa-package-trends";
    globalThis.UPAECharts.connect?.("upa-package-trends");
    chart.setOption({
      animation: !matchMedia("(prefers-reduced-motion: reduce)").matches && values.length < 400,
      aria: { enabled: true, description: `${intervalName(viewModel.interval)} ${viewModel.series.map(item => item.label.toLowerCase()).join(" and ")} for ${packageName}.` },
      grid: { left: 12, right: 16, top: 18, bottom: 66, containLabel: true },
      tooltip: {
        trigger: "axis", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 },
        formatter: parameters => {
          const timestamp = parameters[0]?.value?.[0], point = values.find(item => item[0] === timestamp)?.[1];
          if (!point) return "";
          return `<strong>${dateLabel(timestamp)}</strong>${viewModel.series.map(item => `<br/><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${item.color};margin-right:6px"></span>${item.label}&nbsp;&nbsp;${fullValue(point[item.field])}`).join("")}`;
        }
      },
      xAxis: { type: "time", boundaryGap: false, axisLine: { lineStyle: { color: theme.axisLine } }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, hideOverlap: true }, splitLine: { show: false } },
      yAxis: { type: "value", min: 0, minInterval: viewModel.currency ? undefined : 1, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, formatter: compactValue }, splitLine: { lineStyle: { color: theme.grid } } },
      dataZoom: [
        { type: "inside", filterMode: "none", zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true, preventDefaultMouseMove: true },
        { type: "slider", filterMode: "none", height: 18, bottom: 14, borderColor: "transparent", backgroundColor: theme.zoom, fillerColor: "rgba(108,92,231,.18)", dataBackground: { lineStyle: { color: theme.zoomLine }, areaStyle: { color: theme.zoomArea } }, selectedDataBackground: { lineStyle: { color: "#6c5ce7" }, areaStyle: { color: "#5a4f8f" } }, handleStyle: { color: theme.handle, borderColor: "#6c5ce7" }, moveHandleStyle: { color: "#6c5ce7" }, textStyle: { color: theme.axis, fontSize: 9 } }
      ],
      series: viewModel.series.map(item => ({ name: item.label, type: "line", data: values.map(([date, point]) => [date, point[item.field] || 0]), smooth: .14, sampling: "lttb", showSymbol: values.length <= 80, symbol: "circle", symbolSize: 5, lineStyle: { color: item.color, width: 2.5 }, itemStyle: { color: item.color }, emphasis: { focus: "series", lineStyle: { width: 3 } } }))
    });
  }

  function renderPackageRevenueGrowthChart(viewModel, packageName, bounds, mode, interval) {
    const container = document.getElementById("upa-package-revenue-chart");
    if (!container) return;
    if (!viewModel.revenuePoints.length && !viewModel.growthPoints.length) { container.innerHTML = '<div class="upa-empty-chart">No package revenue history is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const theme = chartTheme(), chart = createChart("package-revenue", container);
    if (!chart) return;
    const compactMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
    const fullMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    const dateLabel = timestamp => new Intl.DateTimeFormat(undefined, ["day", "week"].includes(interval)
      ? { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }
      : { month: "long", year: "numeric", timeZone: "UTC" }).format(timestamp);
    const revenueLookup = new Map(viewModel.revenuePoints.map(point => [Date.parse(`${point.date}T00:00:00Z`), point]));
    const growthLookup = new Map(viewModel.growthPoints.map(point => [Date.parse(`${point.date}T00:00:00Z`), point]));
    const revenueData = viewModel.revenuePoints.map(point => [Date.parse(`${point.date}T00:00:00Z`), mode === "interval" ? point.revenue : point.cumulativeRevenue]);
    const growthData = viewModel.growthPoints.map(point => [Date.parse(`${point.date}T00:00:00Z`), point.growth]);
    const domainMin = Date.parse(`${viewModel.domainStart}T00:00:00Z`), domainMax = Date.parse(`${viewModel.domainEnd}T00:00:00Z`);
    const hasGrowthData = viewModel.growthPoints.some(point => Number.isFinite(point.growth));
    const hasNewRevenue = viewModel.growthPoints.some(point => point.growthState === "new");
    const growthEmptyText = !viewModel.hasGrowthHistory ? "12-month growth appears after 24 complete months" : hasNewRevenue ? "New revenue · no prior 12-month revenue to compare" : "No complete growth period is available in this range";
    const revenueLabel = mode === "interval" ? `${intervalName(interval)} revenue` : "Cumulative revenue";
    const growthDescription = point => {
      if (point.growthState === "partial") return `Waiting for a complete ${intervalName(interval).toLowerCase()} interval`;
      if (point.growthState === "insufficient") return "Not enough complete history";
      if (point.growthState === "new") return "New revenue";
      return `${point.growth > 0 ? "+" : ""}${percent(point.growth)}`;
    };
    chart.setOption({
      animation: !matchMedia("(prefers-reduced-motion: reduce)").matches && viewModel.revenuePoints.length + viewModel.growthPoints.length < 300,
      aria: { enabled: true, description: `${revenueLabel} and rolling 12-month revenue growth for ${packageName} from ${bounds.start} to ${bounds.end}. Growth bars remain visible when the revenue view changes.` },
      axisPointer: { link: [{ xAxisIndex: "all" }] },
      graphic: hasGrowthData ? [] : [{ type: "text", left: "center", top: "76%", silent: true, style: { text: growthEmptyText, fill: theme.axis, font: "600 11px sans-serif", textAlign: "center" } }],
      grid: [
        { left: 14, right: 18, top: 22, height: "48%", containLabel: true },
        { left: 14, right: 18, top: "66%", bottom: 32, containLabel: true }
      ],
      tooltip: {
        trigger: "axis", confine: true, axisPointer: { type: "line", lineStyle: { color: "#a9afbc" } }, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 },
        formatter: parameters => {
          const timestamp = parameters.find(parameter => Array.isArray(parameter.value))?.value?.[0];
          if (timestamp === undefined) return "";
          const revenuePoint = revenueLookup.get(timestamp), growthPoint = growthLookup.get(timestamp);
          const rows = [];
          if (revenuePoint) rows.push(`<span style="color:#aaa3d8">${revenueLabel}</span>&nbsp;&nbsp;${fullMoney(mode === "interval" ? revenuePoint.revenue : revenuePoint.cumulativeRevenue)}`);
          if (growthPoint) {
            const trailing = growthPoint.trailingRevenue === null ? "—" : fullMoney(growthPoint.trailingRevenue);
            const growthColor = growthPoint.growth === null ? "#aeb6c5" : growthPoint.growth < 0 ? "#ef8798" : "#75d2a2";
            rows.push(`<span style="color:#aeb6c5">Revenue in latest 12 months</span>&nbsp;&nbsp;${trailing}`);
            rows.push(`<span style="color:${growthColor}">Growth vs previous 12 months</span>&nbsp;&nbsp;${growthDescription(growthPoint)}`);
          }
          return rows.length ? `<strong>${dateLabel(timestamp)}</strong><br/>${rows.join("<br/>")}` : "";
        }
      },
      xAxis: [
        { type: "time", gridIndex: 0, min: domainMin, max: domainMax, boundaryGap: false, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
        { type: "time", gridIndex: 1, min: domainMin, max: domainMax, boundaryGap: false, axisLine: { lineStyle: { color: theme.axisLine } }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, hideOverlap: true }, splitLine: { show: false } }
      ],
      yAxis: [
        { type: "value", gridIndex: 0, min: 0, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: theme.axis, fontSize: 10, formatter: compactMoney }, splitLine: { lineStyle: { color: theme.grid } } },
        { type: "value", gridIndex: 1, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: hasGrowthData, color: theme.axis, fontSize: 10, formatter: value => `${value > 0 ? "+" : ""}${Math.round(value)}%` }, splitLine: { show: hasGrowthData, lineStyle: { color: theme.grid } } }
      ],
      series: [
        {
          name: revenueLabel, type: "line", xAxisIndex: 0, yAxisIndex: 0, data: revenueData, smooth: .14, sampling: "lttb", showSymbol: revenueData.length <= 60, symbol: "circle", symbolSize: 4,
          lineStyle: { color: "#6c5ce7", width: 2.5 }, itemStyle: { color: "#6c5ce7" }, areaStyle: mode === "cumulative" ? { color: "rgba(108,92,231,.16)" } : undefined, emphasis: { focus: "series" }
        },
        {
          name: "12-month growth", type: "bar", xAxisIndex: 1, yAxisIndex: 1, data: growthData, barMaxWidth: 20,
          itemStyle: { color: parameter => parameter.value?.[1] < 0 ? "#d45c70" : "#3ca56f", borderRadius: parameter => parameter.value?.[1] < 0 ? [0, 0, 3, 3] : [3, 3, 0, 0] }, emphasis: { focus: "series" }
        }
      ]
    });
  }

  function packageRevenueHeatmapMarkup(viewModel, packageName) {
    if (!viewModel.years.length) return '<div class="upa-revenue-heatmap-empty">No package revenue history is available.</div>';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const exactMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    const cells = viewModel.years.map(year => {
      const values = monthNames.map((_, index) => viewModel.months.get(`${year}-${String(index + 1).padStart(2, "0")}`));
      const total = values.reduce((sum, value) => sum + (value || 0), 0);
      return `<tr><th scope="row">${year}</th><td class="upa-heatmap-year-total">${money(total)}</td>${values.map((value, index) => {
        if (value === undefined) return `<td class="upa-heatmap-unavailable" aria-label="${monthNames[index]} ${year}: no data available">—</td>`;
        const level = value > 0 && viewModel.maximum > 0 ? Math.max(1, Math.ceil(Math.sqrt(value / viewModel.maximum) * 5)) : 0;
        const label = `${monthNames[index]} ${year}: ${exactMoney(value)}`;
        return `<td data-level="${level}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${money(value)}</td>`;
      }).join("")}</tr>`;
    }).join("");
    return `<div class="upa-revenue-heatmap-scroll" data-history-range="${viewModel.historyStart}:${viewModel.historyEnd}"><table class="upa-revenue-heatmap" aria-label="Complete available monthly gross revenue history for ${escapeHtml(packageName)}"><thead><tr><th scope="col">Year</th><th scope="col">Total</th>${monthNames.map(month => `<th scope="col">${month}</th>`).join("")}</tr></thead><tbody>${cells}</tbody></table></div>`;
  }

  function packageDetailPanel(packageInfo, totals, revenueGrowth, unitsTrend, heatmap, bounds, interval) {
    if (!packageInfo) return "";
    const conversion = totals.pageViews ? percent(totals.salesQty / totals.pageViews * 100) : "—";
    const conversionDescription = totals.freeQty > 0 ? "Paid sales and free claims divided by pageviews." : "Sales divided by pageviews.";
    const latestGrowth = revenueGrowth.latestGrowth;
    const growthValue = latestGrowth?.growthState === "new" ? "New" : latestGrowth?.growth === null || latestGrowth?.growth === undefined ? "—" : `${latestGrowth.growth > 0 ? "+" : ""}${percent(latestGrowth.growth)}`;
    const growthClass = latestGrowth?.growthState === "new" || latestGrowth?.growth > 0 ? "upa-positive" : latestGrowth?.growth < 0 ? "upa-negative" : "upa-neutral";
    const growthPeriod = latestGrowth ? `Through ${new Intl.DateTimeFormat(undefined, ["day", "week"].includes(interval) ? { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" } : { month: "short", year: "numeric", timeZone: "UTC" }).format(Date.parse(`${latestGrowth.date}T00:00:00Z`))}` : "Needs 24 complete months";
    const intervalRevenueLabel = `${intervalName(interval)} revenue`;
    const revenueTabs = `<div class="upa-package-chart-tabs" role="tablist" aria-label="Revenue chart view"><button type="button" role="tab" data-package-revenue-mode="cumulative" aria-selected="${prefs.packageRevenueMode !== "interval"}">Cumulative revenue</button><button type="button" role="tab" data-package-revenue-mode="interval" aria-selected="${prefs.packageRevenueMode === "interval"}">${intervalRevenueLabel}</button></div>`;
    return `<section class="upa-view-panel upa-view-package" id="upa-view-package">
      <div class="upa-package-detail-layout"><div class="upa-package-detail-charts">
        <article class="upa-card upa-package-detail-chart-card"><div class="upa-section-title"><div><small>REVENUE</small><h2>Revenue and growth</h2><p>Switch the revenue view. Rolling 12-month growth stays visible below.</p></div><div class="upa-section-tools">${chartActions("package-revenue", !revenueGrowth.revenuePoints.length && !revenueGrowth.growthPoints.some(point => Number.isFinite(point.growth)))}</div></div>${revenueTabs}<div id="upa-package-revenue-chart" class="upa-package-detail-chart upa-package-combined-chart" data-revenue-mode="${prefs.packageRevenueMode === "interval" ? "interval" : "cumulative"}" data-growth-series="visible" data-growth-interval="${interval}" data-growth-points="${revenueGrowth.growthPoints.length}" data-chart-range="${bounds.start}:${bounds.end}" data-time-domain="${revenueGrowth.domainStart}:${revenueGrowth.domainEnd}" role="img" aria-label="${prefs.packageRevenueMode === "interval" ? intervalRevenueLabel : "Cumulative revenue"} and rolling 12-month growth for ${escapeHtml(packageInfo.name)} from ${bounds.start} to ${bounds.end}"></div></article>
        <article class="upa-card upa-package-detail-heatmap"><div class="upa-section-title"><div><small>MONTHLY PATTERN</small><h2>Revenue heatmap</h2><p>Gross revenue for each month in the package's full available history.</p></div></div>${packageRevenueHeatmapMarkup(heatmap, packageInfo.name)}</article>
        ${totals.freeQty > 0 ? `<article class="upa-card upa-package-detail-chart-card"><div class="upa-section-title"><div><small>ACQUISITIONS</small><h2>Sales and free claims</h2><p>Paid sales and free claims shown separately for this package.</p></div><div class="upa-section-tools">${chartActions("package-units", !unitsTrend.points.length)}</div></div><div class="upa-package-chart-legend"><span><i class="upa-package-sales-dot"></i>Sales · ${number(totals.paidQty)}</span><span><i class="upa-package-claims-dot"></i>Claims · ${number(totals.freeQty)}</span></div><div id="upa-package-units-chart" class="upa-package-detail-chart" role="img" aria-label="Paid sales and free claims trend for ${escapeHtml(packageInfo.name)}"></div></article>` : ""}
      </div><aside class="upa-card upa-package-detail-metrics" aria-label="Metrics for ${escapeHtml(packageInfo.name)}"><div class="upa-package-detail-title"><div><small>AT A GLANCE</small><h2>Package metrics</h2></div></div><p>Performance for the selected time range.</p><div class="upa-package-detail-highlights"><div class="upa-package-detail-primary"><span>Gross revenue</span><strong>${money(totals.sales)}</strong><small>Before refunds and Unity's revenue share</small></div><div class="upa-package-detail-primary upa-package-growth-primary"><span>12-month growth</span><strong class="${growthClass}">${growthValue}</strong><small>${growthPeriod}</small></div></div><dl><div><dt>Sales${totals.freeQty > 0 ? " <small>Paid units</small>" : ""}</dt><dd>${number(totals.paidQty)}</dd></div>${totals.freeQty > 0 ? `<div><dt>Claims <small>Free units</small></dt><dd>${number(totals.freeQty)}</dd></div>` : ""}<div><dt>Pageviews</dt><dd>${number(totals.pageViews)}</dd></div><div><dt><span class="upa-package-metric-label">Conversion ${kpiHelp("upa-package-conversion-help", "About package conversion", conversionDescription)}</span></dt><dd>${conversion}</dd></div><div><dt>Downloads</dt><dd>${number(totals.downloads)}</dd></div></dl></aside></div>
    </section>`;
  }

  function revenueMixSliceData(viewModel, width, height, minimumArcPixels) {
    const radius = Math.min(width, height) * .75;
    const circumference = Math.PI * 2 * radius;
    let visibleCount = viewModel.items.length;
    if (circumference > 0 && viewModel.total > 0) {
      visibleCount = viewModel.items.findIndex(item => item.value / viewModel.total * circumference < minimumArcPixels);
      if (visibleCount < 0) visibleCount = viewModel.items.length;
    }
    const visible = viewModel.items.slice(0, visibleCount).map(item => ({ name: item.name, value: item.value, itemStyle: { color: item.color } }));
    const otherValue = viewModel.items.slice(visibleCount).reduce((sum, item) => sum + item.value, 0);
    if (otherValue > 0) visible.push({ name: "Other assets", value: otherValue, itemStyle: { color: "#798398" } });
    return visible;
  }
  function renderCalendarChart(viewModel) {
    const container = document.getElementById("upa-calendar-chart");
    if (!container) return;
    if (!viewModel.points.length) { container.innerHTML = '<div class="upa-empty-chart">No daily activity is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const theme = chartTheme();
    const formatValue = value => viewModel.metric.currency
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)
      : number(value);
    const series = viewModel.years.map((year, index) => ({
      name: viewModel.metric.label, type: "heatmap", coordinateSystem: "calendar", calendarIndex: index,
      data: viewModel.points.filter(([date, value]) => date.startsWith(year) && value > 0), emphasis: { itemStyle: { borderColor: "#26213f", borderWidth: 1, shadowBlur: 5, shadowColor: "rgba(40,32,78,.25)" } }
    }));
    const setCalendarOption = (chart, availableWidth) => {
      const width = Math.max(280, availableWidth || container.clientWidth);
      const sideRoom = width < 540 ? 48 : 88;
      const cellSize = Math.max(5, Math.min(18, Math.floor((width - sideRoom) / 53)));
      const rowHeight = cellSize * 7;
      const rowGap = Math.max(30, Math.round(cellSize * 1.8));
      const firstRowTop = 48;
      const rowStep = rowHeight + rowGap;
      const calendarWidth = cellSize * 53;
      const left = Math.max(36, Math.round((width - calendarWidth) / 2));
      const chartHeight = Math.max(250, firstRowTop + viewModel.years.length * rowStep + 22);
      const calendars = viewModel.years.map((year, index) => ({
        range: year, top: firstRowTop + index * rowStep, left, cellSize: [cellSize, cellSize],
        splitLine: { show: false },
        itemStyle: { color: theme.calendarEmpty, borderColor: theme.calendarSplit, borderWidth: 2 },
        yearLabel: { show: true, position: "left", margin: 35, color: theme.calendarYear, fontSize: 12, fontWeight: 750 },
        monthLabel: { color: theme.calendarMonth, fontSize: 10, margin: 7 }, dayLabel: { firstDay: 1, color: theme.calendarDay, fontSize: 9, margin: 7 }
      }));
      container.style.height = `${chartHeight}px`;
      chart.resize({ height: chartHeight });
      chart.setOption({
        animation: false,
        aria: { enabled: true, description: `${viewModel.metric.label} by day across ${viewModel.years.length} calendar years.` },
        tooltip: { trigger: "item", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 }, formatter: parameter => `<strong>${escapeHtml(parameter.data[0])}</strong><br/><span style="color:#aaa3d8">${viewModel.metric.label}</span>&nbsp;&nbsp;${formatValue(parameter.data[1])}` },
        visualMap: {
          min: 0, max: viewModel.scaleMax, calculable: false, orient: "horizontal", left: "center", bottom: 6,
          itemWidth: 8, itemHeight: 148, text: ["Higher", "Lower"], textGap: 10,
          textStyle: { color: theme.axis, fontSize: 10, fontWeight: 650 },
          padding: [8, 12], backgroundColor: theme.calendarScale, borderColor: theme.calendarScaleBorder, borderWidth: 1, borderRadius: 14,
          inRange: { color: theme.calendarRange }, seriesIndex: series.map((_, index) => index)
        },
        calendar: calendars, series
      }, { notMerge: true });
    };
    const chart = createChart("calendar", container, setCalendarOption); if (!chart) return;
    setCalendarOption(chart, container.clientWidth);
  }

  function renderAssetHeatmapChart(viewModel) {
    const container = document.getElementById("upa-calendar-chart");
    if (!container) return;
    if (!viewModel.points.length || !viewModel.assets.length) { container.innerHTML = '<div class="upa-empty-chart">No asset activity is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const theme = chartTheme(), assetNames = new Map(viewModel.assets.map(asset => [asset.key, asset.name]));
    const formatValue = value => viewModel.metric.currency
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0)
      : number(value);
    const heatmapRange = theme.calendarRange, heatmapEmpty = theme.calendarEmpty;
    const chartHeight = Math.max(430, viewModel.assets.length * 17 + 112);
    const dateLabelMode = visibleDays => visibleDays <= 620 ? "month" : visibleDays <= 1460 ? "quarter" : "year";
    const dateLabelFormatter = mode => value => {
      if (!value.endsWith("-01")) return "";
      const month = Number(value.slice(5, 7));
      if (mode === "year") return month === 1 ? value.slice(0, 4) : "";
      if (mode === "quarter") return (month - 1) % 3 === 0 ? `Q${Math.floor((month - 1) / 3) + 1} '${value.slice(2, 4)}` : "";
      return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][month - 1]} ${value.slice(2, 4)}`;
    };
    let currentDateLabelMode = dateLabelMode(viewModel.dates.length);
    container.style.height = `${chartHeight}px`;
    const chart = createChart("calendar", container); if (!chart) return;
    chart.resize({ height: chartHeight });
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: `${viewModel.metric.label} by day for ${viewModel.assets.length} assets.` },
      grid: { left: 194, right: 18, top: 28, bottom: 76 },
      tooltip: {
        trigger: "item", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 },
        formatter: parameter => `<strong>${escapeHtml(assetNames.get(parameter.data[1]) || parameter.data[1])}</strong><br/><span style="color:#aaa3d8">${escapeHtml(parameter.data[0])}</span><br/>${viewModel.metric.label}&nbsp;&nbsp;${formatValue(parameter.data[3])}`
      },
      xAxis: {
        type: "category", data: viewModel.dates, boundaryGap: true,
        axisLine: { lineStyle: { color: theme.axisLine } }, axisTick: { show: false }, splitLine: { show: false },
        axisLabel: { interval: 0, color: theme.axis, fontSize: 9, formatter: dateLabelFormatter(currentDateLabelMode) }
      },
      yAxis: {
        type: "category", inverse: true, data: viewModel.assets.map(asset => asset.key),
        axisLine: { lineStyle: { color: theme.axisLine } }, axisTick: { show: false },
        axisLabel: { interval: 0, color: theme.axis, fontSize: 10, lineHeight: 14, width: 166, overflow: "truncate", formatter: value => assetNames.get(value) || value },
        splitArea: { show: true, areaStyle: { color: [heatmapEmpty, heatmapEmpty] } }, splitLine: { show: false }
      },
      dataZoom: [
        { type: "inside", xAxisIndex: 0, filterMode: "filter", startValue: viewModel.initialStart, endValue: viewModel.initialEnd, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true, preventDefaultMouseMove: true },
        { type: "slider", xAxisIndex: 0, filterMode: "filter", startValue: viewModel.initialStart, endValue: viewModel.initialEnd, height: 18, bottom: 14, borderColor: "transparent", backgroundColor: theme.zoom, fillerColor: "rgba(108,92,231,.18)", dataBackground: { lineStyle: { color: theme.zoomLine }, areaStyle: { color: theme.zoomArea } }, selectedDataBackground: { lineStyle: { color: "#6c5ce7" }, areaStyle: { color: "#5a4f8f" } }, handleStyle: { color: theme.handle, borderColor: "#6c5ce7" }, moveHandleStyle: { color: "#6c5ce7" }, textStyle: { color: theme.axis, fontSize: 9 } }
      ],
      visualMap: {
        show: false, min: 0, max: viewModel.scaleMax, dimension: 2, calculable: false, orient: "horizontal", right: 18, top: 0,
        itemWidth: 7, itemHeight: 116, text: ["Higher", "Lower"], textGap: 8,
        textStyle: { color: theme.axis, fontSize: 9, fontWeight: 650 }, inRange: { color: heatmapRange }
      },
      series: [{
        name: viewModel.metric.label, type: "heatmap", data: viewModel.points, progressive: 5000, progressiveThreshold: 3000,
        itemStyle: { borderWidth: 0 }, emphasis: { itemStyle: { borderColor: "#6f1d17", borderWidth: 1, shadowBlur: 5, shadowColor: "rgba(126,38,25,.28)" } }
      }]
    });
    chart.on("datazoom", () => {
      const zoom = chart.getOption().dataZoom?.[0], start = Number(zoom?.start), end = Number(zoom?.end);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return;
      const nextMode = dateLabelMode(Math.max(1, Math.round(viewModel.dates.length * Math.abs(end - start) / 100)));
      if (nextMode === currentDateLabelMode) return;
      currentDateLabelMode = nextMode;
      chart.setOption({ xAxis: { axisLabel: { formatter: dateLabelFormatter(currentDateLabelMode) } } });
    });
  }
  function renderSankeyChart(viewModel) {
    const container = document.getElementById("upa-sankey-chart");
    if (!container) return;
    if (!viewModel.links.length) { container.innerHTML = '<div class="upa-empty-chart">No package revenue is available for this date range.</div>'; return; }
    if (!globalThis.UPAECharts?.init) { container.innerHTML = '<div class="upa-empty-chart">The chart renderer could not be loaded.</div>'; return; }
    const theme = chartTheme();
    const chart = createChart("sankey", container); if (!chart) return;
    const fullMoney = value => new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value || 0);
    chart.setOption({
      animation: false,
      aria: { enabled: true, description: `Gross revenue split across ${viewModel.activePackages.length} packages${viewModel.groupBy === "category" ? ` in ${viewModel.categories} categories` : ""}.` },
      tooltip: { trigger: "item", triggerOn: "mousemove", confine: true, backgroundColor: "#151927", borderWidth: 0, padding: [10, 12], textStyle: { color: "#fff", fontSize: 11 }, formatter: parameter => parameter.dataType === "edge" ? `<strong>${escapeHtml(parameter.data.sourceLabel)}</strong><br/><span style="color:#aaa3d8">to ${escapeHtml(parameter.data.targetLabel)}</span>&nbsp;&nbsp;${fullMoney(parameter.value)}` : `<strong>${escapeHtml(parameter.data.displayLabel)}</strong><br/>${fullMoney(parameter.value)}` },
      series: [{
        type: "sankey", left: 110, right: 205, top: 22, bottom: 20, nodeWidth: 14, nodeGap: 13, nodeAlign: "justify", draggable: false, layoutIterations: 36,
        data: viewModel.nodes, links: viewModel.links, label: { color: theme.sankeyLabel, fontSize: 11, fontWeight: 650, lineHeight: 16, width: 185, overflow: "truncate", formatter: parameter => parameter.data.kind === "total" ? `Gross revenue\n${money(viewModel.total)}` : parameter.data.displayLabel },
        lineStyle: { color: "gradient", curveness: .52, opacity: .3 }, emphasis: { focus: "adjacency", lineStyle: { opacity: .65 } }, itemStyle: { borderWidth: 0, borderRadius: 3 }
      }]
    });
  }

  function chartActions(key, disabled = false) {
    return `<div class="upa-chart-actions"><button data-chart-action="save" data-chart="${key}" title="Save this chart as a high-resolution PNG" ${disabled ? "disabled" : ""}>Save PNG</button><button data-chart-action="share" data-chart="${key}" title="Share this chart using your device" ${disabled ? "disabled" : ""}>Share</button></div>`;
  }

  function chartFilename(key) { return `publisher-analytics-${key}-${new Date().toISOString().slice(0, 10)}.png`; }

  const CHART_EXPORT_WIDTH = 1920;

  async function chartExportDataUrl(chart) {
    const chartWidth = chart.getWidth();
    const chartHeight = chart.getHeight();
    const exportHeight = Math.round(CHART_EXPORT_WIDTH * chartHeight / chartWidth);
    const container = document.createElement("div");
    Object.assign(container.style, { position: "fixed", left: "-10000px", top: "0", width: `${CHART_EXPORT_WIDTH}px`, height: `${exportHeight}px`, visibility: "hidden", pointerEvents: "none" });
    document.body.appendChild(container);
    const exportChart = globalThis.UPAECharts.init(container, null, { renderer: "canvas", width: CHART_EXPORT_WIDTH, height: exportHeight });
    try {
      const option = chart.getOption();
      option.animation = false;
      exportChart.setOption(option, { notMerge: true, lazyUpdate: false });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      exportChart.getZr().flush();
      return exportChart.getDataURL({ type: "png", pixelRatio: 1, backgroundColor: darkThemeActive() ? "#1d2939" : "#ffffff" });
    } finally {
      exportChart.dispose();
      container.remove();
    }
  }

  async function chartImage(key) {
    const chart = chartInstances.get(key), metadata = chartShareMetadata.get(key); if (!chart || !metadata) throw new Error("This chart is not ready yet.");
    const source = await chartExportDataUrl(chart);
    const image = new Image(); image.src = source; await image.decode();
    const scopeLegend = Array.isArray(metadata.scopeLegend) ? metadata.scopeLegend : [], headerHeight = 150, footerHeight = scopeLegend.length ? 60 + scopeLegend.length * 28 : 0;
    const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight + headerHeight + footerHeight;
    const context = canvas.getContext("2d"), darkExport = darkThemeActive(); context.fillStyle = darkExport ? "#1d2939" : "#fff"; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = darkExport ? "#e7ebf3" : "#172033"; context.font = "700 32px Segoe UI, sans-serif"; context.fillText(metadata.title, 40, 56);
    context.fillStyle = darkExport ? "#98a3b6" : "#70798d"; context.font = "20px Segoe UI, sans-serif"; context.fillText(metadata.subtitle, 40, 91);
    context.fillStyle = "#6c5ce7"; context.font = "700 18px Segoe UI, sans-serif"; context.textAlign = "right"; context.fillText("Publisher Analytics+", canvas.width - 40, 56); context.textAlign = "left";
    context.drawImage(image, 0, headerHeight);
    if (scopeLegend.length) {
      const footerTop = headerHeight + image.naturalHeight, maxLabelWidth = canvas.width - 105;
      context.strokeStyle = darkExport ? "#303b4e" : "#e8eaf0"; context.lineWidth = 1; context.beginPath(); context.moveTo(40, footerTop + .5); context.lineTo(canvas.width - 40, footerTop + .5); context.stroke();
      context.fillStyle = darkExport ? "#98a3b6" : "#8a91a1"; context.font = "700 14px Segoe UI, sans-serif"; context.fillText("COMPARED SCOPES", 40, footerTop + 30);
      context.font = "18px Segoe UI, sans-serif";
      scopeLegend.forEach((entry, index) => {
        const baseline = footerTop + 60 + index * 28;
        context.fillStyle = entry.color || "#6c5ce7"; context.beginPath(); context.arc(46, baseline - 6, 5, 0, Math.PI * 2); context.fill();
        let label = String(entry.name || "Unnamed scope"), shortened = false;
        while (label.length > 1 && context.measureText(`${label}…`).width > maxLabelWidth) { label = label.slice(0, -1); shortened = true; }
        context.fillStyle = darkExport ? "#d7dde7" : "#4e5669"; context.fillText(shortened ? `${label.trimEnd()}…` : label, 62, baseline);
      });
    }
    const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("Could not create the chart image.")), "image/png"));
    return { blob, filename: chartFilename(key), metadata };
  }

  async function handleChartAction(action, key) {
    try {
      const image = await chartImage(key);
      if (action === "share" && navigator.share) {
        const file = new File([image.blob], image.filename, { type: "image/png" });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) { await navigator.share({ title: image.metadata.title, text: image.metadata.subtitle, files: [file] }); return; }
      }
      const url = URL.createObjectURL(image.blob);
      const link = document.createElement("a"); link.href = url; link.download = image.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(action === "share" ? "Sharing is unavailable here, so the chart was downloaded instead." : "Chart saved as a high-resolution PNG.");
    } catch (error) { if (error.name !== "AbortError") toast(error.message, "error"); }
  }
