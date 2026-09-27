  function publisherAccount() {
    const initial = escapeHtml((publisherIdentity.name || "P").trim().charAt(0).toUpperCase() || "P");
    const avatar = publisherIdentity.icon ? `<img src="${escapeHtml(publisherIdentity.icon)}" alt="">` : `<span>${initial}</span>`;
    return `<div class="upa-publisher-account">${accountMenuOpen ? `<div class="upa-account-menu" role="menu"><button type="button" data-action="open-settings" role="menuitem"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.09a2 2 0 0 1 1 1.74v.5a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg><span>Settings</span></button></div>` : ""}<button class="upa-account-trigger" type="button" data-action="toggle-account" aria-haspopup="menu" aria-expanded="${accountMenuOpen}"><span class="upa-publisher-avatar">${avatar}</span><span class="upa-publisher-copy"><strong>${escapeHtml(publisherIdentity.name || "Publisher")}</strong><small>Publisher</small></span><svg class="upa-account-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m3 7.5 3-3 3 3"></path></svg></button></div>`;
  }

  function groupEditorMarkup(packageOptions) {
    if (!groupEditor) return "";
    const existing = groupEditor.id ? packageGroups.find(group => group.id === groupEditor.id) : null;
    if (groupEditor.id && !existing) return "";
    const selected = new Set(existing?.packageIds || []), availableIds = new Set(packageOptions.map(item => item.key));
    const unavailableCount = [...selected].filter(id => !availableIds.has(id)).length;
    const title = existing ? "Edit package group" : "Create package group";
    const options = packageOptions.map(item => {
      const otherGroups = packageGroups.filter(group => group.id !== existing?.id && group.packageIds.includes(item.key)).length;
      return `<label><input type="checkbox" data-group-package="${escapeHtml(item.key)}" ${selected.has(item.key) ? "checked" : ""}><span><strong>${escapeHtml(item.name)}</strong><small>${otherGroups ? `In ${otherGroups} other ${otherGroups === 1 ? "group" : "groups"}` : "Not grouped elsewhere"}</small></span></label>`;
    }).join("");
    return `<section class="upa-groups-page"><button class="upa-page-back" type="button" data-action="group-cancel">← Back to package groups</button><article class="upa-group-editor" aria-labelledby="upa-group-editor-title"><div class="upa-group-editor-head"><div><small>PACKAGE GROUP</small><h2 id="upa-group-editor-title">${title}</h2><p>Choose a clear name and at least one asset. Assets can belong to more than one group.</p></div></div><label class="upa-group-name">Group name<input id="upa-group-name" type="text" maxlength="40" value="${escapeHtml(existing?.name || "")}" placeholder="For example, Editor tools"></label><div class="upa-group-package-head"><strong>Assets</strong><span>${packageOptions.length} available${unavailableCount ? ` · ${unavailableCount} unavailable kept` : ""}</span></div><div class="upa-group-package-list">${options || '<div class="upa-group-empty">Sync package history before creating a group.</div>'}</div>${unavailableCount ? `<label class="upa-group-unavailable"><input id="upa-remove-unavailable" type="checkbox"><span>Remove ${number(unavailableCount)} unavailable ${unavailableCount === 1 ? "asset" : "assets"} when saving</span></label>` : ""}<div class="upa-group-editor-actions"><button type="button" data-action="group-cancel">Cancel</button><button class="upa-primary" type="button" data-action="group-save" ${packageOptions.length || existing?.packageIds.length ? "" : "disabled"}>${existing ? "Save changes" : "Create group"}</button></div></article></section>`;
  }

  function groupsPanel(packageOptions) {
    if (groupEditor) return groupEditorMarkup(packageOptions);
    const groupRows = packageGroups.map(group => {
      const availableCount = group.packageIds.filter(id => packageOptions.some(item => item.key === id)).length, unavailableCount = group.packageIds.length - availableCount;
      return `<div class="upa-group-row"><div><strong>${escapeHtml(group.name)}</strong><span>${number(group.packageIds.length)} ${group.packageIds.length === 1 ? "asset" : "assets"}${unavailableCount ? ` · ${number(unavailableCount)} unavailable` : ""}</span></div><div><button type="button" data-action="group-edit" data-group-id="${escapeHtml(group.id)}">Edit</button><button class="upa-group-delete" type="button" data-action="group-delete" data-group-id="${escapeHtml(group.id)}">Delete</button></div></div>`;
    }).join("");
    return `<section class="upa-groups-page"><button class="upa-page-back" type="button" data-action="group-back-performance">← Back to Performance</button><article class="upa-card upa-settings-card upa-settings-groups"><div class="upa-section-title"><div><small>ANALYTICS SCOPES</small><h2>Package groups</h2><p>Save reusable asset selections for Performance. Assets can belong to more than one group.</p></div><button class="upa-settings-primary" type="button" data-action="group-create" ${packageOptions.length ? "" : "disabled"}>New group</button></div><div class="upa-group-list"><div class="upa-group-row upa-group-built-in"><div><strong>All assets</strong><span>${number(packageOptions.length)} assets · Always includes the complete catalog</span></div><em>Built in</em></div>${groupRows || '<div class="upa-group-list-empty">No saved groups yet. Create one to reuse the same asset selection in Performance.</div>'}</div></article></section>`;
  }

  function settingsPanel() {
    const salesMonths = new Set(indexedRecords("sales").map(item => item.period)).size;
    const downloadMonths = new Set(indexedRecords("downloads").map(item => item.period)).size;
    const performanceDays = new Set(indexedRecords("daily", "all").map(item => item.date)).size;
    const revenueEntries = indexedRecords("revenue").length;
    const themeOptions = [
      { id: "system", label: "System", icon: "◐" },
      { id: "light", label: "Light", icon: "☀" },
      { id: "dark", label: "Dark", icon: "☾" }
    ].map(option => `<button type="button" data-theme="${option.id}" aria-pressed="${prefs.theme === option.id}"><span aria-hidden="true">${option.icon}</span>${option.label}</button>`).join("");
    const syncAlreadyStarted = Boolean(syncJob?.active || ["preparing", "months", "daily"].includes(syncJob?.phase));
    const settingsSyncAction = records.length || syncAlreadyStarted ? "" : '<div class="upa-settings-sync"><div><strong>Publisher history</strong><small>Bring your available history into this browser.</small></div><button class="upa-settings-primary" type="button" data-action="settings-sync">Sync full history</button></div>';
    return `<section class="upa-settings-page"><section class="upa-settings-section"><div class="upa-settings-intro"><h2>Local data</h2><p>See how much publisher history is currently available.</p></div><article class="upa-settings-panel"><div class="upa-settings-panel-head"><strong>Data coverage</strong><small>Stored for ${escapeHtml(publisherIdentity.name)} in this browser.</small></div><div class="upa-coverage-grid"><div><span>Sales</span><strong>${number(salesMonths)}</strong><small>months</small></div><div><span>Downloads</span><strong>${number(downloadMonths)}</strong><small>months</small></div><div><span>Performance</span><strong>${number(performanceDays)}</strong><small>days</small></div><div><span>Revenue</span><strong>${number(revenueEntries)}</strong><small>entries</small></div></div>${settingsSyncAction}</article></section>
      <section class="upa-settings-section"><div class="upa-settings-intro"><h2>Data management</h2><p>Back up or remove analytics kept for this publisher.</p></div><article class="upa-settings-panel"><div class="upa-settings-panel-head"><strong>Browser storage</strong><small>Your analytics stays in this browser and is never sent to an external service. Each publisher has a separate local workspace.</small></div><button class="upa-data-action" type="button" data-action="export" ${records.length ? "" : "disabled"}><span><strong>Export data</strong><small>Download a JSON backup of this publisher's analytics.</small></span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2.5v10m-4-4 4 4 4-4"></path><path d="M3.5 14v2.5h13V14"></path></svg></button><div class="upa-danger-zone"><div><strong>Clear local data</strong><span>Deletes this publisher's synced analytics, saved sync progress, and cached package icons. Preferences and package groups are kept.</span></div><button type="button" data-action="clear" ${records.length || syncJob ? "" : "disabled"}>Clear data</button></div></article></section>
      <section class="upa-settings-section"><div class="upa-settings-intro"><h2>Appearance</h2><p>Choose how Publisher Analytics+ looks in this browser.</p></div><article class="upa-settings-panel"><div class="upa-settings-row"><div><strong>Color theme</strong><small>System follows your browser or device preference.</small></div><div class="upa-theme-options" role="group" aria-label="Color theme">${themeOptions}</div></div></article></section>
      ${supportPanel()}
    </section>`;
  }

  function dashboardPackageColumnOptions() {
    const metricColumn = metric => ({ key: metric.id, label: metric.id === "revenuePerPageview" ? "RPV" : metric.label, description: metric.id === "revenuePerPageview" ? `Revenue per pageview. ${metric.description}` : metric.description, render: item => `<span class="upa-table-value">${metric.ratio ? (item.pageViews ? metricValue(metric, item[metric.field]) : "—") : number(item[metric.field])}</span>` });
    return [
      { key: "sales", label: "Sales", description: "Paid units and free claims combined.", render: item => number(item.salesQty) },
      { key: "revenue", label: "Revenue / share", description: "Gross revenue and its share of package revenue in this table.", render: item => `<span class="upa-table-value">${money(item.sales)}</span><span class="upa-table-inline-detail">${percent(item.share)}</span>` },
      { key: "monthlyAverage", label: "Monthly avg. (12m)", description: "Average monthly gross revenue over the latest 12 months with data.", render: item => `<span class="upa-table-value">${item.trailing.monthCount ? money(item.trailing.monthlyAverage) : "—"}</span>` },
      { key: "growth", label: "Growth (12m)", description: "Gross revenue change over the latest 12 complete months versus the preceding 12 months.", render: item => `<span class="upa-table-value ${revenueGrowthClass(item.trailing)}">${revenueGrowthLabel(item.trailing)}</span>` },
      { key: "conversion", label: "Conversion", description: "Sales and claims as a share of pageviews.", render: item => `<span class="upa-table-value">${item.pageViews ? percent(item.conversion) : "—"}</span>` },
      { key: "pageViews", label: "Pageviews", description: "Views of your Asset Store package pages.", render: item => `<span class="upa-table-value">${number(item.pageViews)}</span>` },
      { key: "downloads", label: "Downloads", description: "Downloads of package files.", render: item => `<span class="upa-table-value">${number(item.downloads)}</span>` },
      ...Object.values(DAILY_METRICS).map(metricColumn),
      { key: "reviews", label: "Reviews", description: "Current review count reported for this package.", render: item => item.reviewCount == null ? "—" : `<span class="upa-table-value">${number(item.reviewCount)}</span>` },
      { key: "reviewsPerSales", label: "Reviews / sales", description: "Percent of lifetime sales that led to a review.", render: item => `<span class="upa-table-value">${item.lifetimeSalesQty ? percent(item.reviewCount / item.lifetimeSalesQty * 100) : "—"}</span>` }
    ];
  }

  function dashboardPackageTableMarkup(rows) {
    const columns = dashboardPackageColumnOptions().filter(column => prefs.dashboardPackageColumns.includes(column.key));
    return `<thead><tr><th scope="col">Package</th>${columns.map(column => `<th class="upa-package-column-${column.key}" scope="col"${column.description ? ` title="${escapeHtml(column.description)}"` : ""}>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map(item => `<tr><th scope="row"><button class="upa-package-detail-link" type="button" data-package-id="${escapeHtml(item.id)}" aria-label="View details for ${escapeHtml(item.name)}"><div class="upa-package-identity" title="${number(item.paidQty)} paid units${item.freeQty ? ` · ${number(item.freeQty)} claims` : ""}">${packageIconMarkup(item)}<strong class="upa-package-name">${escapeHtml(item.name)}</strong></div></button></th>${columns.map(column => `<td class="upa-package-column-${column.key}">${column.render(item)}</td>`).join("")}</tr>`).join("")}</tbody>`;
  }

  function packageIconMarkup(item, className = "upa-package-avatar") {
    const initial = escapeHtml(item.name?.trim().slice(0, 1).toUpperCase() || "P");
    const fallback = `<span class="${className}" aria-hidden="true">${initial}</span>`;
    const trusted = packageIconUrl(item.icon);
    if (!trusted) return fallback;
    if (!trusted.cacheable) return `<span class="${className} upa-package-icon-wrap" aria-hidden="true" data-initial="${initial}"><img src="${escapeHtml(trusted.url)}" alt="" loading="lazy" referrerpolicy="no-referrer"></span>`;
    const packageId = String(item.id || item.key || "").trim();
    if (!packageId) return fallback;
    const key = cachedIconKey(packageId, trusted.url), dataUrl = packageIconDataUrls.get(key);
    if (dataUrl) return `<span class="${className} upa-package-icon-wrap" aria-hidden="true" data-initial="${initial}"><img src="${escapeHtml(dataUrl)}" alt="" loading="lazy"></span>`;
    return `<span class="${className} upa-package-icon-pending" aria-hidden="true" data-initial="${initial}" data-package-icon-id="${escapeHtml(packageId)}" data-package-icon-url="${escapeHtml(trusted.url)}">${initial}</span>`;
  }

  function metricTooltipLabel(label, description) {
    return description ? `<span class="upa-metric-help" tabindex="0">${escapeHtml(label)}<span class="upa-metric-tooltip" role="tooltip">${escapeHtml(description)}</span></span>` : escapeHtml(label);
  }

  function updateDashboardPackageTable() {
    const table = document.querySelector("#upa-root .upa-dashboard-packages .upa-package-table");
    if (table) table.innerHTML = dashboardPackageTableMarkup(dashboardPackageRows);
  }

  function setDashboardPackageSettingsOpen(open) {
    isDashboardPackageSettingsOpen = open;
    const settings = document.querySelector("#upa-root .upa-dashboard-package-settings");
    const trigger = settings?.querySelector(".upa-dashboard-package-settings-trigger");
    const menu = settings?.querySelector(".upa-dashboard-package-settings-menu");
    if (trigger) trigger.setAttribute("aria-expanded", String(open));
    if (menu) menu.hidden = !open;
  }

  let cachedWorkspaceModelsSource = null;
  let cachedWorkspaceModels = new Map();
  let packageCategoriesRecordsSource = null;
  let packageCategoriesPackagesSource = null;
  let packageCategoriesCache = new Map();

  function cachedWorkspaceModel(key, build) {
    if (cachedWorkspaceModelsSource !== records) {
      cachedWorkspaceModelsSource = records;
      cachedWorkspaceModels = new Map();
    }
    if (cachedWorkspaceModels.has(key)) {
      const value = cachedWorkspaceModels.get(key);
      cachedWorkspaceModels.delete(key);
      cachedWorkspaceModels.set(key, value);
      return value;
    }
    const value = build();
    cachedWorkspaceModels.set(key, value);
    if (cachedWorkspaceModels.size > 16) cachedWorkspaceModels.delete(cachedWorkspaceModels.keys().next().value);
    return value;
  }

  function analyticsViewModelKey(view) {
    const bounds = selectedDateBounds(), range = [bounds.start, bounds.end];
    if (view === "revenue") return JSON.stringify([range, resolvedInterval(bounds), prefs.performanceScopes, prefs.performanceHiddenScopes, packageGroups, packageMetadataSignature()]);
    if (view === "lifetime") return JSON.stringify([prefs.lifetimeMetric, prefs.lifetimePackages, prefs.lifetimeHiddenPackages, prefs.lifetimeStyle, prefs.lifetimeAlign]);
    if (view === "calendar") return JSON.stringify([range, prefs.calendarMetric, prefs.calendarStyle]);
    if (view === "sankey") return JSON.stringify([range, prefs.sankeyPackages, prefs.sankeyGroupBy, packageMetadataSignature()]);
    return "";
  }

  function dashboardViewModelKey() {
    const bounds = selectedDateBounds();
    return JSON.stringify([[bounds.start, bounds.end], prefs.range, resolvedInterval(bounds)]);
  }

  function packageMetadataSignature() {
    return (syncJob?.packages || []).map(item => [String(item.id || ""), item.name || "", item.category || ""]);
  }

  function packageCategoryIndex() {
    const packages = syncJob?.packages || null;
    if (packageCategoriesRecordsSource === records && packageCategoriesPackagesSource === packages) return packageCategoriesCache;
    packageCategoriesRecordsSource = records;
    packageCategoriesPackagesSource = packages;
    packageCategoriesCache = new Map();
    for (const item of packages || []) {
      const key = String(item.id || item.name || "");
      if (key && item.category) packageCategoriesCache.set(key, item.category);
    }
    for (const item of records) {
      const key = String(item.packageId || item.package || "");
      if (key && item.category && !packageCategoriesCache.has(key)) packageCategoriesCache.set(key, item.category);
    }
    return packageCategoriesCache;
  }

  function render() {
    renderQueued = false;
    const host = document.getElementById("upa-root");
    if (!host) return;
    try {
      if (publisherIdentityState !== "ready") { renderRecovery(host); return; }
      const renderStartedAt = globalThis.__UPA_PERF_TRACE === true ? performance.now() : 0;
      renderWorkspace();
      if (renderStartedAt) console.info("[UPA performance] workspace render", { totalMs: performance.now() - renderStartedAt, records: records.length });
    } catch (error) {
      workspaceStage = "render";
      publisherIdentityState = "error";
      workspaceFailure = { stage: "render", ...failureDetails(error) };
      recordDiagnostic({ kind: "workspace", ...workspaceFailure });
      console.warn("Publisher Analytics+ could not display the workspace:", error);
      renderRecovery(host);
    }
  }

  function fullSyncPending(job) {
    return Boolean(job && ["preparing", "months", "daily"].includes(job.phase));
  }

  function renderWorkspace() {
    renderQueued = false; const host = document.getElementById("upa-root"); if (!host) return;
    const previousAnalyticsModels = analyticsChartModels?.source === records ? analyticsChartModels : null;
    const previousDashboardModels = dashboardChartModels?.source === records ? dashboardChartModels : null;
    disposeCharts(); chartShareMetadata.clear();
    const previousViewPanels = new Map();
    if (previousAnalyticsModels) {
      for (const panel of host.querySelectorAll(".upa-view-panel[id]")) previousViewPanels.set(panel.id, panel.cloneNode(true));
    }
    const salesItems = filtered("sales");
    const lifetimeMetric = lifetimeMetricDefinition(prefs.lifetimeMetric);
    const lifetimeItems = lifetimeMetric.source === "daily" ? indexedRecords("daily", "package") : indexedRecords(lifetimeMetric.source);
    const daily = filtered("daily"), dailyAll = daily.filter(item => item.scope === "all"), dailyPackages = daily.filter(item => item.scope === "package"), packages = aggregatePackages(daily);
    const pageViews = dailyAll.reduce((sum, item) => sum + item.pageViews, 0), salesQty = dailyAll.reduce((sum, item) => sum + item.salesQty, 0);
    const paidUnits = dailyAll.reduce((sum, item) => sum + item.paidQty, 0), downloads = dailyAll.reduce((sum, item) => sum + item.downloads, 0);
    const conversionRate = pageViews ? salesQty / pageViews * 100 : 0;
    const progress = syncJob?.active ? Math.min(100, Math.round((syncJob.completed || 0) / Math.max(syncJob.total || 1, 1) * 100)) : 0;
    const hasData = records.length > 0 && !fullSyncPending(syncJob);
    const availableBounds = availableDateBounds(), dateBounds = selectedDateBounds(), suggestedInterval = automaticInterval(dateBounds), interval = resolvedInterval(dateBounds), revenueChartData = revenueViewModel(dailyAll, interval);
    const allDaily = indexedRecords("daily", "all"), trailingRevenue = trailingRevenueMetrics(allDaily, availableBounds);
    const comparisonBounds = comparisonDateBounds(dateBounds, prefs.range);
    const comparisonAvailable = comparisonBounds && comparisonBounds.start >= availableBounds.start && comparisonBounds.end <= availableBounds.end;
    const previousDaily = comparisonAvailable ? allDaily.filter(item => item.date >= comparisonBounds.start && item.date <= comparisonBounds.end) : [];
    const previousRevenue = previousDaily.reduce((sum, item) => sum + item.sales, 0), previousPageViews = previousDaily.reduce((sum, item) => sum + item.pageViews, 0);
    const previousSalesQty = previousDaily.reduce((sum, item) => sum + item.salesQty, 0), previousDownloads = previousDaily.reduce((sum, item) => sum + item.downloads, 0);
    const previousConversionRate = previousPageViews ? previousSalesQty / previousPageViews * 100 : null;
    const revenueGrowthValue = revenueGrowthLabel(trailingRevenue);
    const comparisonLabel = comparisonAvailable ? comparisonBounds.label : "";
    const revenueChange = changeIndicator(relativeChange(revenueChartData.total, previousRevenue), comparisonLabel);
    const averageRevenueChange = trailingRevenue.hasBaseline ? changeIndicator(trailingRevenue.growth, "previous 12 months") : "";
    const pageViewsChange = changeIndicator(relativeChange(pageViews, previousPageViews), comparisonLabel);
    const conversionChange = previousConversionRate === null ? "" : changeIndicator(conversionRate - previousConversionRate, comparisonLabel, " pp");
    const downloadsChange = changeIndicator(relativeChange(downloads, previousDownloads), comparisonLabel);
    const allPackageDaily = indexedRecords("daily", "package");
    const allPackageTotals = cachedWorkspaceModel("all-package-totals", () => aggregatePackages(allPackageDaily));
    const lifetimeSalesByPackage = cachedWorkspaceModel("lifetime-sales-by-package", () => new Map(allPackageTotals.map(item => [String(item.id), item.salesQty])));
    const packageHistory = cachedWorkspaceModel("package-history", () => {
      const history = new Map();
      for (const item of allPackageDaily) {
        const id = item.packageId || item.package, rows = history.get(id) || [];
        rows.push(item); history.set(id, rows);
      }
      return history;
    });
    const discoveredPackageById = new Map((syncJob?.packages || []).map(item => [String(item.id || ""), item]));
    for (const item of packages) item.icon = discoveredPackageById.get(String(item.id))?.icon || item.icon || "";
    const packageRevenueTotal = packages.reduce((sum, item) => sum + item.sales, 0);
    const dashboardPackages = packages.slice(0, 12).map(item => ({
      ...item,
      share: packageRevenueTotal ? item.sales / packageRevenueTotal * 100 : 0,
      reviewCount: discoveredPackageById.get(String(item.id))?.reviewCount ?? null,
      icon: discoveredPackageById.get(String(item.id))?.icon || item.icon || "",
      lifetimeSalesQty: lifetimeSalesByPackage.get(String(item.id)) || 0,
      trailing: trailingRevenueMetrics(packageHistory.get(item.id) || [], availableBounds)
    }));
    dashboardPackageRows = dashboardPackages;
    const packageCategories = packageCategoryIndex();
    const performanceOptions = performancePackageOptions(allPackageDaily, dailyPackages, syncJob?.packages);
    const dailyPackageRowsById = new Map();
    for (const item of dailyPackages) {
      const key = String(item.packageId || item.package || "");
      if (!key) continue;
      const rows = dailyPackageRowsById.get(key);
      if (rows) rows.push(item); else dailyPackageRowsById.set(key, [item]);
    }
    const selectedPackage = performanceOptions.find(item => item.key === prefs.packageId);
    const selectedPackageIndex = selectedPackage ? performanceOptions.findIndex(item => item.key === selectedPackage.key) : -1;
    const canNavigatePackages = performanceOptions.length > 1;
    const previousPackage = canNavigatePackages && selectedPackageIndex >= 0 ? performanceOptions[(selectedPackageIndex - 1 + performanceOptions.length) % performanceOptions.length] : null;
    const nextPackage = canNavigatePackages && selectedPackageIndex >= 0 ? performanceOptions[(selectedPackageIndex + 1) % performanceOptions.length] : null;
    const selectedPackageRows = selectedPackage ? dailyPackages.filter(item => String(item.packageId || item.package || "") === selectedPackage.key) : [];
    const selectedPackageLifetimeRows = selectedPackage ? allPackageDaily.filter(item => String(item.packageId || item.package || "") === selectedPackage.key) : [];
    const selectedPackageTotals = aggregatePackages(selectedPackageRows)[0] || { sales: 0, paidQty: 0, freeQty: 0, salesQty: 0, pageViews: 0, downloads: 0 };
    const packageInterval = interval;
    const packageRevenueGrowth = packageRevenueGrowthViewModel(selectedPackageLifetimeRows, dateBounds, packageInterval);
    const packageUnitsTrend = packageTrendViewModel(selectedPackageRows, packageInterval, [{ field: "paidQty", label: "Sales", color: "#3ca56f" }, ...(selectedPackageTotals.freeQty > 0 ? [{ field: "freeQty", label: "Claims", color: "#d99721" }] : [])]);
    const packageRevenueHeatmap = selectedPackage ? cachedWorkspaceModel(`package-revenue-heatmap:${selectedPackage.key}`, () => packageRevenueHeatmapViewModel(selectedPackageLifetimeRows)) : packageRevenueHeatmapViewModel([]);
    const availablePerformancePackageIds = new Set(performanceOptions.map(item => item.key));
    const performanceScopeOptions = [
      { type: "all", id: "all", key: "all:all", name: "All assets", membershipIds: [...availablePerformancePackageIds], items: dailyAll },
      ...packageGroups.map(group => {
        const membershipIds = group.packageIds.filter(id => availablePerformancePackageIds.has(id)), membership = new Set(membershipIds);
        return { type: "group", id: group.id, key: `group:${group.id}`, name: group.name, membershipIds, items: dailyPackages.filter(item => membership.has(String(item.packageId || ""))) };
      }),
      ...performanceOptions.map(option => ({ type: "asset", id: option.key, key: `asset:${option.key}`, name: option.name, membershipIds: [option.key], items: dailyPackageRowsById.get(option.key) || [] }))
    ];
    const requestedPerformanceScopeKeys = new Set(sanitizedPerformanceScopes(prefs.performanceScopes).map(scope => `${scope.type}:${scope.id}`));
    let selectedPerformanceScopes = performanceScopeOptions.filter(scope => requestedPerformanceScopeKeys.has(scope.key));
    if (!selectedPerformanceScopes.length) selectedPerformanceScopes = [performanceScopeOptions[0]];
    const selectedPerformanceScopeKeys = new Set(selectedPerformanceScopes.map(scope => scope.key));
    const overlapCounts = new Map();
    for (const scope of selectedPerformanceScopes) for (const packageId of scope.membershipIds) overlapCounts.set(packageId, (overlapCounts.get(packageId) || 0) + 1);
    const overlappingPerformanceAssets = [...overlapCounts.values()].filter(count => count > 1).length;
    const analyticsView = ["revenue", "lifetime", "calendar", "sankey", "packages"].includes(prefs.view) ? prefs.view : "revenue";
    const performanceModelKey = analyticsViewModelKey("revenue");
    const lifetimeModelKey = analyticsViewModelKey("lifetime");
    const calendarModelKey = analyticsViewModelKey("calendar");
    const sankeyModelKey = analyticsViewModelKey("sankey");
    const modelFreshness = { ...(previousAnalyticsModels?.freshness || {}) };
    const performanceCharts = !previousAnalyticsModels || analyticsView === "revenue"
      ? PERFORMANCE_METRICS.map(metric => performanceViewModel(selectedPerformanceScopes, interval, metric, performanceScopeOptions, prefs.performanceHiddenScopes))
      : previousAnalyticsModels.performanceCharts;
    if (!previousAnalyticsModels || analyticsView === "revenue") modelFreshness.revenue = performanceModelKey;
    const performanceData = performanceCharts[0];
    const performanceScopeName = selectedPerformanceScopes.length === 1 ? selectedPerformanceScopes[0].name : `${number(selectedPerformanceScopes.length)} scopes selected`;
    const performanceScopeSummary = selectedPerformanceScopes.length <= 3 ? selectedPerformanceScopes.map(scope => scope.name).join(", ") : `${number(selectedPerformanceScopes.length)} selected scopes`;
    const assetHeatmapActive = prefs.section === "analytics" && analyticsView === "calendar" && prefs.calendarStyle === "assets";
    const dashboardKey = !previousDashboardModels || prefs.section === "dashboard"
      ? dashboardViewModelKey()
      : previousDashboardModels.key;
    const overviewChartData = !previousDashboardModels || prefs.section === "dashboard"
      ? overviewViewModel(dailyAll, dateBounds)
      : previousDashboardModels.overviewChartData;
    const calendarData = !previousAnalyticsModels || analyticsView === "calendar" ? calendarViewModel(dailyAll, prefs.calendarMetric) : previousAnalyticsModels.calendarData;
    const emptyHeatmap = { metric: calendarData.metric, dates: [], assets: [], points: [], peak: null, total: 0 };
    const assetHeatmapData = assetHeatmapActive
      ? assetHeatmapViewModel(dailyPackages, performanceOptions, prefs.calendarMetric)
      : previousAnalyticsModels?.assetHeatmapData || emptyHeatmap;
    if ((analyticsView === "calendar" && (prefs.calendarStyle !== "assets" || assetHeatmapActive)) || (!previousAnalyticsModels && prefs.calendarStyle !== "assets")) modelFreshness.calendar = calendarModelKey;
    const lifetimeCacheKey = `lifetime:${JSON.stringify([lifetimeMetric.id, prefs.lifetimePackages, prefs.lifetimeHiddenPackages, prefs.lifetimeStyle, prefs.lifetimeAlign])}`;
    const lifetimeData = !previousAnalyticsModels || analyticsView === "lifetime"
      ? cachedWorkspaceModel(lifetimeCacheKey, () => lifetimeViewModel(lifetimeItems, lifetimeMetric.id, prefs.lifetimePackages, prefs.lifetimeHiddenPackages, prefs.lifetimeStyle, prefs.lifetimeAlign))
      : previousAnalyticsModels.lifetimeData;
    if (!previousAnalyticsModels || analyticsView === "lifetime") modelFreshness.lifetime = lifetimeModelKey;
    const sankeyData = !previousAnalyticsModels || analyticsView === "sankey"
      ? sankeyViewModel(salesItems, prefs.sankeyPackages, prefs.sankeyGroupBy, packageCategories)
      : previousAnalyticsModels.sankeyData;
    if (!previousAnalyticsModels || analyticsView === "sankey") modelFreshness.sankey = sankeyModelKey;
    const dailyPatternsTotal = assetHeatmapActive ? assetHeatmapData.total : calendarData.total;
    const sankeyHeight = Math.max(410, sankeyData.activePackages.length * 48 + 96);
    chartShareMetadata.set("overview", { title: "Business activity over time", subtitle: `${intervalName(overviewChartData.interval)} revenue, pageviews, and downloads · ${dateBounds.start} to ${dateBounds.end}` });
    for (const chart of performanceCharts) chartShareMetadata.set(`performance-${chart.metric.id}`, { title: chart.metric.label, subtitle: `${intervalName(interval)} totals · ${dateBounds.start} to ${dateBounds.end}`, scopeLegend: chart.series.map(scope => ({ name: scope.name, color: scope.color })) });
    chartShareMetadata.set("lifetime", { title: `${lifetimeData.metric.label} lifetime growth`, subtitle: `${lifetimeData.style === "area" ? "Stacked cumulative" : "Cumulative"} ${lifetimeData.metric.label.toLowerCase()} · ${lifetimeData.align === "age" ? `aligned by ${lifetimeData.metric.ageDescription}` : "calendar time"} · all available history` });
    chartShareMetadata.set("calendar", assetHeatmapActive
      ? { title: `${assetHeatmapData.metric.label} by asset`, subtitle: `${dateBounds.start} to ${dateBounds.end} · ${assetHeatmapData.assets.length} assets across ${assetHeatmapData.dates.length} daily slices` }
      : { title: `${calendarData.metric.label} calendar`, subtitle: `${dateBounds.start} to ${dateBounds.end} · daily intensity across ${calendarData.years.length} ${calendarData.years.length === 1 ? "year" : "years"}` });
    chartShareMetadata.set("sankey", { title: "Where revenue comes from", subtitle: `${sankeyData.activePackages.length} packages${sankeyData.groupBy === "category" ? ` · ${sankeyData.categories} categories` : ""} · ${dateBounds.start} to ${dateBounds.end}` });
    if (selectedPackage) {
      chartShareMetadata.set("package-revenue", { title: `${selectedPackage.name} · ${prefs.packageRevenueMode === "interval" ? `${intervalName(packageInterval)} revenue` : "Cumulative revenue"}`, subtitle: `Revenue with rolling 12-month growth · ${dateBounds.start} to ${dateBounds.end}` });
      if (selectedPackageTotals.freeQty > 0) chartShareMetadata.set("package-units", { title: `${selectedPackage.name} · Sales and free claims`, subtitle: `${intervalName(packageInterval)} totals · ${dateBounds.start} to ${dateBounds.end}` });
    }
    const views = [
      { id: "revenue", label: "Performance", description: "Compare revenue, demand, attention, and usage for the catalog or individual assets." },
      { id: "lifetime", label: "Lifetime growth", description: "See how each package accumulates gross revenue and where growth plateaus." },
      { id: "calendar", label: "Daily patterns", description: "Compare daily intensity and seasonality across years." },
      { id: "sankey", label: "Revenue composition", description: "Break down gross revenue by category and package." },
      { id: "packages", label: "Packages", description: "Compare attention, conversion, downloads, and gross revenue." }
    ];
    const preferredSection = prefs.section === "package" && !selectedPackage ? "dashboard" : ["dashboard", "analytics", "package", "groups", "settings"].includes(prefs.section) ? prefs.section : "dashboard";
    const section = hasData || preferredSection === "settings" ? preferredSection : "dashboard";
    const view = views.some(item => item.id === prefs.view) ? prefs.view : "revenue";
    analyticsChartModels = { source: records, freshness: modelFreshness, performanceCharts, lifetimeData, calendarData, assetHeatmapData, performanceOptions, sankeyData };
    const sectionMeta = section === "dashboard"
      ? { label: "Dashboard", description: "Your publishing business at a glance." }
      : section === "analytics"
        ? { label: "Analytics", description: "Explore trends, patterns, and package performance." }
        : section === "package"
          ? { label: escapeHtml(selectedPackage.name), description: "Performance for this package in the selected time range." }
        : section === "groups"
          ? { label: "Package groups", description: "Create and manage reusable asset selections." }
          : { label: "Settings", description: "Manage data coverage and local browser storage." };
    const packageNavigation = section === "package" && selectedPackage
      ? `<div class="upa-header-control upa-package-nav-control"><span>Asset</span><nav class="upa-package-pagination" aria-label="Asset navigation"><button type="button" data-package-id="${escapeHtml(previousPackage?.key || "")}" data-package-direction="previous" aria-label="${previousPackage ? `Previous asset: ${escapeHtml(previousPackage.name)}` : "No previous asset"}" title="${previousPackage ? `Previous: ${escapeHtml(previousPackage.name)}` : "No previous asset"}" ${previousPackage ? "" : "disabled"}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m10 3-5 5 5 5"></path></svg></button><span aria-label="Asset ${selectedPackageIndex + 1} of ${performanceOptions.length}">${selectedPackageIndex + 1} / ${performanceOptions.length}</span><button type="button" data-package-id="${escapeHtml(nextPackage?.key || "")}" data-package-direction="next" aria-label="${nextPackage ? `Next asset: ${escapeHtml(nextPackage.name)}` : "No next asset"}" title="${nextPackage ? `Next: ${escapeHtml(nextPackage.name)}` : "No next asset"}" ${nextPackage ? "" : "disabled"}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"></path></svg></button></nav></div>`
      : "";
    const headerTitle = `<h1>${hasData || ["groups", "settings"].includes(section) ? sectionMeta.label : "Welcome"}</h1>`;
    const viewTabs = views.map(item => `<button class="upa-view-tab ${item.id === view ? "upa-active" : ""}" type="button" role="tab" aria-selected="${item.id === view}" aria-controls="upa-view-${item.id}" data-view="${item.id}">${item.label}</button>`).join("");
    const syncIncomplete = Boolean(syncJob && !syncJob.active && ["preparing", "months", "daily"].includes(syncJob.phase));
    const syncFailed = Boolean(syncJob?.error);
    const syncTitle = syncJob?.active ? syncJob.label : syncFailed ? "Sync couldn't be completed" : "Sync paused";
    const syncPreparing = syncJob?.active && syncJob.phase === "preparing";
    const syncDetail = syncJob?.active
      ? syncPreparing ? "Finding your assets and available history…" : `${syncJob.completed || 0} of ${syncJob.total || "?"} steps complete`
      : syncFailed
        ? syncJob.failure?.code === "portal-tab-unavailable" ? "The Publisher Portal tab closed. Continue to reopen it and resume your saved progress."
          : syncIncomplete ? "Continue from your saved progress. If it fails again, refresh the Publisher Portal first." : "Try again. If it keeps happening, refresh the Publisher Portal first."
        : "Continue when you're ready. Your progress has been saved.";
    const syncIcon = syncJob?.active
      ? syncPreparing ? '<div class="upa-sync-icon upa-sync-preparing" aria-hidden="true"><i></i></div>' : `<div class="upa-sync-icon upa-sync-progress" style="--upa-progress-angle:${progress * 3.6}deg" aria-hidden="true"><span>${progress}%</span></div>`
      : syncFailed
        ? '<div class="upa-sync-icon upa-sync-error" aria-hidden="true">!</div>'
        : '<div class="upa-sync-icon" aria-hidden="true">Ⅱ</div>';
    const latestCapturedAt = latestRecordCapturedAt();
    const lastRefreshedAt = syncJob?.lastRefreshedAt || syncJob?.finishedAt || latestCapturedAt;
    const refreshTooltip = `Refresh publisher data · ${lastRefreshedAt ? `Last refreshed ${dateTime(lastRefreshedAt)}` : "Not refreshed yet"}`;
    const refreshAction = hasData && !syncJob?.active && !syncFailed && !syncIncomplete ? `<button class="upa-refresh-action ${isRefreshing ? "upa-refreshing" : ""}" type="button" data-action="refresh" aria-label="${escapeHtml(refreshTooltip)}" ${isRefreshing ? "disabled" : ""}${section === "dashboard" ? "" : ' style="display:none"'}><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13.2 5.9A5.5 5.5 0 1 0 13 10.7"></path><path d="M13.4 2.8v3.5H9.9"></path></svg><span>${isRefreshing ? "Refreshing…" : "Refresh data"}</span><span class="upa-refresh-tooltip" role="tooltip">${escapeHtml(refreshTooltip)}</span></button>` : "";
    const headerIdentity = section === "package" && selectedPackage ? `<div class="upa-header-package-identity">${packageIconMarkup(selectedPackage, "upa-package-avatar")}<div>${headerTitle}<div class="upa-header-subline"><p>${sectionMeta.description}</p>${refreshAction}</div></div></div>` : `${headerTitle}<div class="upa-header-subline"><p>${hasData || ["groups", "settings"].includes(section) ? sectionMeta.description : "Build a complete, configurable view of your publishing business."}</p>${refreshAction}</div>`;
    const customRangeLabel = `${shortDate(dateBounds.start)} – ${shortDate(dateBounds.end)}`;
    const selectedRangeLabel = prefs.range === "custom" ? customRangeLabel : RANGE_OPTIONS.find(option => option.id === prefs.range)?.label || "All time";
    const revenueMixLabel = prefs.range === "all" ? "Lifetime" : selectedRangeLabel;
    const revenueMixData = !previousDashboardModels || prefs.section === "dashboard"
      ? revenueMixViewModel(daily.filter(item => item.scope === "package"), revenueMixLabel)
      : previousDashboardModels.revenueMixData;
    dashboardChartModels = { source: records, key: dashboardKey, revenueMixData, overviewChartData, suggestedInterval };
    const rangePopover = isRangePopoverOpen ? rangePopoverMarkup(dateBounds, availableBounds) : "";
    const rangeControl = hasData ? `<div class="upa-header-control upa-header-range"${section === "analytics" && view === "lifetime" ? ' style="display:none"' : ""}><span>Time range</span><div class="upa-range-picker"><button class="upa-range-trigger" type="button" data-action="range-toggle" aria-haspopup="dialog" aria-expanded="${isRangePopoverOpen}"><b>${selectedRangeLabel}</b><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"></path></svg></button>${rangePopover}</div></div>` : "";
    const intervalControl = hasData ? `<label class="upa-header-control upa-header-interval"${section === "analytics" && view === "revenue" ? "" : ' style="display:none"'}><span>Interval</span><select id="upa-interval" aria-label="Chart interval"><option value="auto" ${prefs.interval === "auto" ? "selected" : ""}>Automatic (${intervalName(suggestedInterval).toLowerCase()})</option><option value="day" ${prefs.interval === "day" ? "selected" : ""}>Daily</option><option value="week" ${prefs.interval === "week" ? "selected" : ""}>Weekly</option><option value="month" ${prefs.interval === "month" ? "selected" : ""}>Monthly</option><option value="quarter" ${prefs.interval === "quarter" ? "selected" : ""}>Quarterly</option><option value="year" ${prefs.interval === "year" ? "selected" : ""}>Yearly</option></select></label>` : "";
    const averageRevenueHelp = trailingRevenue.monthCount ? `Average gross revenue across the ${trailingRevenue.monthCount === 12 ? "last 12" : number(trailingRevenue.monthCount)} complete months available.` : "Average monthly revenue is calculated once a complete month is available.";
    const performancePackageNames = new Map(performanceOptions.map(item => [item.key, item.name]));
    const performanceGroupMenuItems = packageGroups.map(group => {
      const key = `group:${group.id}`, selected = selectedPerformanceScopeKeys.has(key);
      const names = group.packageIds.map(id => performancePackageNames.get(id)).filter(Boolean), shownNames = names.slice(0, 6), remaining = group.packageIds.length - shownNames.length;
      const packageNamesTooltip = shownNames.length ? `${shownNames.join(", ")}${remaining ? `, … +${number(remaining)} more` : ""}` : "Package names unavailable";
      const assetCountLabel = `${number(group.packageIds.length)} ${group.packageIds.length === 1 ? "asset" : "assets"}`;
      return `<button type="button" role="menuitemcheckbox" aria-checked="${selected}" data-performance-scope="group" data-performance-scope-id="${escapeHtml(group.id)}" data-performance-scope-key="${escapeHtml(key)}"><span><strong>${escapeHtml(group.name)}</strong></span><em class="upa-performance-scope-count" title="${escapeHtml(packageNamesTooltip)}" aria-label="${escapeHtml(`${assetCountLabel}: ${packageNamesTooltip}`)}">${number(group.packageIds.length)}</em><i aria-hidden="true">${selected ? "✓" : ""}</i></button>`;
    }).join("");
    const performanceAssetMenuItems = performanceOptions.map(item => {
      const key = `asset:${item.key}`, selected = selectedPerformanceScopeKeys.has(key);
      return `<button type="button" role="menuitemcheckbox" aria-checked="${selected}" data-performance-scope="asset" data-performance-scope-id="${escapeHtml(item.key)}" data-performance-scope-key="${escapeHtml(key)}"><span><strong>${escapeHtml(item.name)}</strong></span><i aria-hidden="true">${selected ? "✓" : ""}</i></button>`;
    }).join("");
    const allPerformanceScopeSelected = selectedPerformanceScopeKeys.has("all:all");
    const performanceOverlapWarning = overlappingPerformanceAssets ? `<div class="upa-performance-overlap-note" role="note"><strong>Overlapping selection</strong><span>${number(overlappingPerformanceAssets)} ${overlappingPerformanceAssets === 1 ? "asset appears" : "assets appear"} in more than one selected scope.</span></div>` : "";
    const performanceScopeBlocks = `${performanceGroupMenuItems ? `${performanceGroupMenuItems}<div class="upa-performance-scope-separator" role="separator"></div>` : ""}${performanceAssetMenuItems ? `${performanceAssetMenuItems}<div class="upa-performance-scope-separator" role="separator"></div>` : ""}`;
    const performanceScopeMenu = isPerformanceScopeMenuOpen ? `<div class="upa-performance-scope-menu" role="menu" aria-label="Choose asset groups and individual assets"><div class="upa-performance-scope-list">${performanceScopeBlocks}<button type="button" role="menuitemcheckbox" aria-checked="${allPerformanceScopeSelected}" data-performance-scope="all" data-performance-scope-key="all:all"><span><strong>All assets</strong></span><i aria-hidden="true">${allPerformanceScopeSelected ? "✓" : ""}</i></button></div>${performanceOverlapWarning}<button class="upa-performance-manage-groups" type="button" data-action="manage-groups"><span>Manage groups</span><i>→</i></button></div>` : "";
    const performanceScopeControls = `<div class="upa-performance-scope-controls"><div class="upa-performance-scope-control"><span>Asset group</span><div class="upa-performance-scope-picker"><button class="upa-performance-scope-trigger" type="button" data-action="performance-scope-toggle" aria-haspopup="menu" aria-expanded="${isPerformanceScopeMenuOpen}"><strong>${escapeHtml(performanceScopeName)}</strong><svg viewBox="0 0 12 12" aria-hidden="true"><path d="m3 4.5 3 3 3-3"></path></svg></button>${performanceScopeMenu}</div></div></div>`;
    const performanceLayoutControls = `<div class="upa-performance-layout-control"><span>Layout</span><div class="upa-performance-layout-options" role="group" aria-label="Performance chart layout"><button type="button" data-performance-layout="grid" aria-pressed="${prefs.performanceLayout === "grid"}">Grid</button><button type="button" data-performance-layout="wide" aria-pressed="${prefs.performanceLayout === "wide"}">Wide</button></div></div>`;
    const performanceLegend = `<div class="upa-performance-legend" aria-label="Visible comparison lines">${performanceData.legend.map(item => `<button type="button" data-performance-legend-scope="${escapeHtml(item.key)}" aria-pressed="${item.visible}" title="${item.visible ? "Hide" : "Show"} ${escapeHtml(item.name)}"><i class="upa-line-${item.lineType}" style="border-color:${item.color}"></i><strong>${escapeHtml(item.name)}</strong></button>`).join("")}</div>`;
    const performanceChartScopeDescription = selectedPerformanceScopes.length === 1 && selectedPerformanceScopes[0].type === "all" ? "the complete catalog" : escapeHtml(performanceScopeSummary);
    const performanceChartsMarkup = performanceCharts.map(chart => {
      return `<article class="upa-card upa-performance-metric-card"><div class="upa-section-title"><div><small>${chart.metric.eyebrow}</small><h2>${metricTooltipLabel(chart.metric.label, chart.metric.description || "")}</h2><p>${chart.metric.ratio ? `${intervalName(interval)} revenue per pageview for ${performanceChartScopeDescription}.` : `${intervalName(interval)} totals for ${performanceChartScopeDescription}.`}</p></div><div class="upa-section-tools"><span>${chart.pointCount} periods</span>${chartActions(`performance-${chart.metric.id}`, !chart.series.some(item => item.points.length))}</div></div>${chart.metric.ratio ? "" : `<div class="upa-chart-summary"><dl><div><dt>Total shown</dt><dd>${metricValue(chart.metric, chart.total)}</dd></div><div><dt>Average</dt><dd>${metricValue(chart.metric, chart.average)}</dd></div><div><dt>Peak</dt><dd>${metricValue(chart.metric, chart.peak?.[1] || 0)}</dd></div></dl></div>`}<div id="upa-performance-${chart.metric.id}-chart" class="upa-performance-chart" role="img" aria-label="Interactive ${escapeHtml(chart.metric.label.toLowerCase())} chart"></div></article>`;
    }).join("");
    const dashboardSummary = `<div class="upa-dashboard-summary"><section class="upa-dashboard-mix-card"><div class="upa-section-title"><div><small>ASSET ALLOCATION</small><h2>Revenue mix</h2></div></div>${revenueMixData.items.length ? `<div class="upa-revenue-mix-layout"><div class="upa-revenue-mix-visual"><div id="upa-revenue-mix-chart" class="upa-revenue-mix-chart" role="img" aria-label="Gross revenue contribution by asset for ${escapeHtml(revenueMixData.label)}"></div><div class="upa-revenue-mix-center"><small id="upa-revenue-mix-label">${escapeHtml(revenueMixData.label)}</small><strong id="upa-revenue-mix-value">${money(revenueMixData.total)}</strong></div></div><div class="upa-revenue-concentration"><small>REVENUE CONCENTRATION</small><dl><div><dt>Largest asset share</dt><dd>${revenueMixData.largest ? percent(revenueMixData.largest.value / revenueMixData.total * 100) : "—"}</dd><span>${revenueMixData.largest ? escapeHtml(revenueMixData.largest.name) : "No revenue yet"}</span></div><div><dt>Top 3 share</dt><dd>${percent(revenueMixData.topThreeShare)}</dd><span>${prefs.range === "all" ? "Of lifetime gross revenue" : "Of gross revenue in this range"}</span></div><div><dt>Revenue-generating assets</dt><dd>${number(revenueMixData.packageCount)}</dd><span>With recorded gross revenue</span></div></dl></div></div>` : '<div class="upa-revenue-mix-empty">No gross revenue is available for this range.</div>'}</section><div class="upa-kpi-groups"><div class="upa-kpis upa-kpis-selected"><article><div><small>Gross revenue</small></div><strong>${money(revenueChartData.total)}</strong><span>${number(paidUnits)} paid units in the selected period</span>${revenueChange}</article><article><div><small>Pageviews</small></div><strong>${number(pageViews)}</strong><span>Sales &amp; Claims: ${number(salesQty)}</span>${pageViewsChange}</article><article><div><small>Conversion rate</small></div><strong>${percent(conversionRate)}</strong><span>Sales &amp; Claims as a share of pageviews</span>${conversionChange}</article><article><div><small>Downloads</small></div><strong>${number(downloads)}</strong><span>Across the selected period</span>${downloadsChange}</article></div><div class="upa-kpis upa-kpis-trailing"><article><div><small>Average monthly revenue</small>${kpiHelp("upa-average-revenue-help", "About average monthly revenue", averageRevenueHelp)}</div><strong>${money(trailingRevenue.monthlyAverage)}</strong>${averageRevenueChange}</article><article><div><small>Revenue growth</small>${kpiHelp("upa-revenue-growth-help", "About revenue growth", "Compares gross revenue from the last 12 complete months with the preceding 12 months. It requires 24 months of history.")}</div><strong>${revenueGrowthValue}</strong></article></div></div></div>`;
    const dashboardPackageColumns = dashboardPackageColumnOptions();
    const dashboardPackageSettings = `<div class="upa-dashboard-package-settings"><button class="upa-dashboard-package-settings-trigger" type="button" data-action="dashboard-package-settings-toggle" aria-label="Choose Package performance table metrics" aria-expanded="${isDashboardPackageSettingsOpen}" aria-controls="upa-dashboard-package-settings-menu"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8.5 2.8h3l.5 1.8a5.9 5.9 0 0 1 1.2.7l1.8-.6 1.5 2.6-1.3 1.3a6.2 6.2 0 0 1 0 1.4l1.3 1.3-1.5 2.6-1.8-.6a5.9 5.9 0 0 1-1.2.7l-.5 1.8h-3L8 14a5.9 5.9 0 0 1-1.2-.7l-1.8.6-1.5-2.6 1.3-1.3a6.2 6.2 0 0 1 0-1.4L3.5 7.3 5 4.7l1.8.6A5.9 5.9 0 0 1 8 4.6z"></path><circle cx="10" cy="9.8" r="2.2"></circle></svg></button><div class="upa-dashboard-package-settings-menu" id="upa-dashboard-package-settings-menu" role="group" aria-label="Choose table metrics"><strong>Show metrics</strong>${dashboardPackageColumns.map(column => `<label><input type="checkbox" data-dashboard-package-column="${column.key}" ${prefs.dashboardPackageColumns.includes(column.key) ? "checked" : ""}><span>${metricTooltipLabel(column.label, column.description)}</span></label>`).join("")}</div></div>`;
    const dashboardPackageTable = `<article class="upa-dashboard-packages"><div class="upa-section-title"><div><small>PACKAGE BREAKDOWN</small><h2>Package performance</h2><p>Selected-range results ranked by gross revenue, with trailing revenue context.</p></div>${dashboardPackageSettings}</div>${dashboardPackages.length ? `<div class="upa-package-table-wrap"><table class="upa-package-table">${dashboardPackageTableMarkup(dashboardPackages)}</table></div><div class="upa-package-table-footer"><span>${packages.length > dashboardPackages.length ? `Showing the top ${dashboardPackages.length} of ${packages.length} packages` : `Showing all ${packages.length} packages in this range`}</span></div>` : '<div class="upa-package-table-empty">No package activity is available for this date range.</div>'}</article>`;
    host.classList.toggle("upa-open", isOpen);
    host.classList.toggle("upa-theme-dark", darkThemeActive());
    document.documentElement.classList.toggle("upa-dashboard-open", isOpen);
    const logoUrl = extensionApi.runtime.getURL("icons/publisher-analytics-128.png");
    const previousContent = host.querySelector(".upa-content"), previousScrollTop = previousContent?.scrollTop || 0;
    const previousSection = previousContent?.dataset.section, previousView = previousContent?.dataset.view;
    const dashboardIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2.5" y="2.5" width="6" height="6" rx="1.5"></rect><rect x="11.5" y="2.5" width="6" height="6" rx="1.5"></rect><rect x="2.5" y="11.5" width="6" height="6" rx="1.5"></rect><rect x="11.5" y="11.5" width="6" height="6" rx="1.5"></rect></svg>';
    const onboardingNavigation = '<div class="upa-onboarding-nav"><small>Getting started</small><strong>Build your publisher history</strong><span>One sync brings your available analytics into this workspace.</span></div>';
    const workspaceNavigation = hasData
      ? `<div class="upa-primary-nav"><small>Workspace</small><button class="${section === "dashboard" || section === "package" ? "upa-active" : ""}" type="button" data-section="dashboard">${dashboardIcon}<span>Dashboard</span></button><button class="${section === "analytics" ? "upa-active" : ""}" type="button" data-section="analytics"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 16.5V11m5 5.5V7m5 9.5V9m4 7.5V3.5"></path><path d="m3 8 5-4 5 2 4-3"></path></svg><span>Analytics</span></button></div>`
      : `${section === "settings" ? `<div class="upa-primary-nav upa-empty-primary-nav"><small>Workspace</small><button type="button" data-section="dashboard">${dashboardIcon}<span>Home</span></button></div>` : ""}${onboardingNavigation}`;
    const mobileNavigation = hasData
      ? `<nav class="upa-mobile-nav" aria-label="Workspace sections"><button class="${section === "dashboard" || section === "package" ? "upa-active" : ""}" type="button" data-section="dashboard">Dashboard</button><button class="${section === "analytics" ? "upa-active" : ""}" type="button" data-section="analytics">Analytics</button><button class="${section === "settings" ? "upa-active" : ""}" type="button" data-section="settings">Settings</button></nav>`
      : `<nav class="upa-mobile-nav" aria-label="Workspace sections">${section === "settings" ? '<button type="button" data-section="dashboard">Home</button>' : ""}<button class="${section === "settings" ? "upa-active" : ""}" type="button" data-section="settings">Settings</button></nav>`;
    host.innerHTML = `<button class="upa-fab" aria-label="Open Publisher Analytics+" title="Publisher Analytics+"><img src="${logoUrl}" alt=""></button><aside class="upa-panel" aria-label="Publisher Analytics+ dashboard">
      <div class="upa-shell">
        <aside class="upa-sidebar" aria-label="Analytics workspace">
          <div class="upa-brand"><span aria-hidden="true"><img src="${logoUrl}" alt=""></span><div><strong>Publisher Analytics+</strong><small>Asset Store Insights</small></div></div>
          ${workspaceNavigation}
          ${publisherAccount()}
        </aside>
        <section class="upa-workspace">
          <header class="upa-header ${section === "dashboard" || section === "package" || section === "groups" || section === "settings" ? "upa-header-compact" : ""}"><div class="upa-header-main"><div class="upa-header-copy"><small>Publisher workspace</small>${headerIdentity}</div><div class="upa-header-actions">${packageNavigation}${intervalControl}${rangeControl}</div></div>${mobileNavigation}${hasData ? `<nav class="upa-view-tabs" role="tablist" aria-label="Analytics views"${section === "analytics" ? "" : ' style="display:none"'}>${viewTabs}</nav>` : ""}</header>
          ${(syncJob?.active || syncFailed || syncIncomplete) ? `<section class="upa-sync ${syncJob?.active ? "upa-syncing" : ""}" role="status" aria-live="polite">${syncIcon}<div class="upa-sync-copy"><strong>${escapeHtml(syncTitle)}</strong><span>${escapeHtml(syncDetail)}</span>${syncJob?.active ? '<small class="upa-sync-note">Large catalogs can take several minutes. Keep the Publisher Portal tab open while syncing. If interrupted, progress resumes when you return.</small>' : ""}</div><div class="upa-sync-actions">${syncPreparing ? "" : syncJob?.active ? '<button data-action="stop-sync">Pause</button>' : syncIncomplete ? '<button data-action="continue-sync">Continue</button>' : '<button data-action="sync-all">Try full sync again</button>'}${syncFailed ? '<button data-action="download-support">Download support report</button>' : ""}</div>${syncJob?.active ? `<div class="upa-progress ${syncPreparing ? "upa-progress-preparing" : ""}"><i style="width:${progress}%"></i></div>` : ""}</section>` : ""}
          <main class="upa-content" data-section="${section}" data-view="${view}">${section === "groups" ? groupsPanel(performanceOptions) : section === "settings" ? settingsPanel() : hasData ? `<section class="upa-dashboard-view upa-view-panel upa-view-dashboard" id="upa-view-dashboard">${dashboardSummary}<article class="upa-dashboard-chart"><div class="upa-section-title"><div><small>BUSINESS ACTIVITY</small><h2>Performance over time</h2><p>${intervalName(overviewChartData.interval)} revenue, pageviews, and downloads on aligned timelines.</p></div><div class="upa-section-tools"><span>${overviewChartData.points.length} periods</span>${chartActions("overview")}</div></div><div class="upa-pulse-legend"><span><i class="upa-pulse-revenue"></i>Gross revenue</span><span><i class="upa-pulse-views"></i>Pageviews</span><span><i class="upa-pulse-downloads"></i>Downloads</span></div><div id="upa-overview-chart" class="upa-overview-chart" role="img" aria-label="Aligned gross revenue, pageviews, and downloads timelines"></div></article>${dashboardPackageTable}</section>
            <section class="upa-dashboard-grid"><section class="upa-view-panel upa-view-revenue upa-performance-view" id="upa-view-revenue"><article class="upa-card upa-performance-controls"><div class="upa-performance-control-layout"><div><small>CATALOG PERFORMANCE</small><h2>Compare the signals that drive your business</h2><p>Choose All assets, a saved group, or an individual asset. Every included asset gets its own line across all four charts.</p></div><div class="upa-performance-tools">${performanceLayoutControls}${performanceScopeControls}</div></div>${performanceLegend}</article><div class="upa-performance-chart-grid" data-layout="${prefs.performanceLayout}">${performanceChartsMarkup}</div></section>
            <article class="upa-card upa-packages-card upa-view-panel upa-view-packages" id="upa-view-packages"><div class="upa-section-title"><div><small>AUDIENCE &amp; CONVERSION</small><h2>Package performance</h2><p>Top packages ranked by gross revenue.</p></div><span>${packages.length} packages</span></div><div class="upa-package-list">${packages.slice(0, 10).map((item, index) => `<button class="upa-package-row" type="button" data-package-id="${escapeHtml(item.id)}" aria-label="View details for ${escapeHtml(item.name)}"><b>${String(index + 1).padStart(2, "0")}</b>${packageIconMarkup(item)}<div><strong>${escapeHtml(item.name)}</strong><span>${number(item.pageViews)} views · ${item.conversion.toFixed(2)}% conversion · ${number(item.downloads)} downloads</span></div><em>${money(item.sales)}</em><i aria-hidden="true">→</i></button>`).join("")}</div></article></section>
            <section class="upa-card upa-insight-card upa-view-panel upa-view-lifetime" id="upa-view-lifetime"><div class="upa-section-title"><div><small>LIFETIME GROWTH</small><h2>How packages accumulate ${escapeHtml(lifetimeData.metric.noun)}</h2><p>Cumulative ${escapeHtml(lifetimeData.metric.label.toLowerCase())} across all available history makes momentum and plateaus visible.</p></div><div class="upa-section-tools"><span>${lifetimeData.pointCount} months</span>${chartActions("lifetime", !lifetimeData.series.length)}</div></div><div class="upa-insight-toolbar upa-lifetime-toolbar"><div class="upa-lifetime-controls"><label class="upa-inline-select">View<select id="upa-lifetime-style"><option value="area" ${lifetimeData.style === "area" ? "selected" : ""}>Stacked area</option><option value="lines" ${lifetimeData.style === "lines" ? "selected" : ""}>Cumulative lines</option></select></label><label class="upa-inline-select upa-metric-select">Metric<select id="upa-lifetime-metric" aria-describedby="upa-lifetime-metric-help">${Object.values(LIFETIME_METRICS).map(metric => `<option value="${metric.id}" ${lifetimeData.metric.id === metric.id ? "selected" : ""}>${metric.label}</option>`).join("")}</select><span id="upa-lifetime-metric-help" class="upa-metric-tooltip" role="tooltip">${escapeHtml(lifetimeData.metric.description)}</span></label>${lifetimeData.style === "lines" ? `<label class="upa-inline-select">Align<select id="upa-lifetime-align"><option value="calendar" ${lifetimeData.align === "calendar" ? "selected" : ""}>Calendar time</option><option value="age" ${lifetimeData.align === "age" ? "selected" : ""}>${lifetimeData.metric.ageLabel}</option></select></label>` : ""}<details class="upa-package-filter"><summary><span>Packages</span><strong>${lifetimeData.explicitKeys.length ? `${lifetimeData.explicitKeys.length} selected` : `Top 8 by ${lifetimeData.metric.rankingLabel}`}</strong></summary><div class="upa-package-filter-panel"><div class="upa-package-filter-head"><span>Choose packages to compare</span><button data-action="lifetime-top">Use top 8</button></div><div class="upa-package-checklist">${lifetimeData.options.map(item => `<label><input type="checkbox" data-lifetime-package="${escapeHtml(item.key)}" ${lifetimeData.activePackages.some(active => active.key === item.key) ? "checked" : ""}><span><strong>${escapeHtml(item.name)}</strong><small>${lifetimeValue(lifetimeData.metric, item.total)}</small></span></label>`).join("")}</div></div></details></div></div><div class="upa-lifetime-legend">${lifetimeData.legend.map(item => `<button type="button" data-lifetime-legend-package="${escapeHtml(item.key)}" aria-pressed="${item.visible}" title="${item.visible ? "Hide" : "Show"} ${escapeHtml(item.name)}"><i style="background:${item.color}"></i><strong>${escapeHtml(item.name)}</strong><em>${lifetimeValue(lifetimeData.metric, item.total)}</em></button>`).join("")}</div><div id="upa-lifetime-chart" class="upa-lifetime-chart" role="img" aria-label="Cumulative ${escapeHtml(lifetimeData.metric.label.toLowerCase())} by package"></div></section>
            <section class="upa-card upa-insight-card upa-view-panel upa-view-calendar" id="upa-view-calendar"><div class="upa-section-title"><div><small>SEASONALITY &amp; OUTLIERS</small><h2>${prefs.calendarStyle === "assets" ? "Daily activity by asset" : "Daily activity calendar"}</h2><p>${prefs.calendarStyle === "assets" ? "Compare every asset across thin daily slices. Drag the timeline to inspect earlier history." : "Compare daily intensity across years and spot recurring patterns at a glance."}</p></div><div class="upa-section-tools"><span>${prefs.calendarStyle === "assets" ? `${assetHeatmapData.assets.length} assets` : `${calendarData.years.length} ${calendarData.years.length === 1 ? "year" : "years"}`}</span>${chartActions("calendar")}</div></div><div class="upa-insight-toolbar upa-daily-toolbar"><div class="upa-daily-controls"><div class="upa-daily-view-control"><span>View</span><div class="upa-daily-view-options" role="group" aria-label="Daily patterns view"><button type="button" data-calendar-style="calendar" aria-pressed="${prefs.calendarStyle !== "assets"}">Year calendar</button><button type="button" data-calendar-style="assets" aria-pressed="${prefs.calendarStyle === "assets"}">Asset heatmap</button></div></div><label class="upa-inline-select upa-metric-select">Show<select id="upa-calendar-metric" aria-describedby="upa-calendar-metric-help"><option value="sales" ${prefs.calendarMetric === "sales" ? "selected" : ""}>Gross revenue</option><option value="paidQty" ${prefs.calendarMetric === "paidQty" ? "selected" : ""}>Sales</option><option value="salesQty" ${prefs.calendarMetric === "salesQty" ? "selected" : ""}>Sales &amp; Claims</option><option value="pageViews" ${prefs.calendarMetric === "pageViews" ? "selected" : ""}>Pageviews</option><option value="downloads" ${prefs.calendarMetric === "downloads" ? "selected" : ""}>Downloads</option>${Object.values(DAILY_METRICS).filter(metric => !metric.ratio).map(metric => `<option value="${metric.id}" ${prefs.calendarMetric === metric.id ? "selected" : ""}>${metric.label}</option>`).join("")}</select><span id="upa-calendar-metric-help" class="upa-metric-tooltip" role="tooltip">${escapeHtml(calendarData.metric.description)}</span></label></div><div class="upa-insight-facts"><span><small>Total</small><strong>${metricValue(calendarData.metric, dailyPatternsTotal)}</strong></span>${prefs.calendarStyle === "assets" ? `<span><small>Daily slices</small><strong>${number(assetHeatmapData.dates.length)}</strong></span><span><small>Peak cell</small><strong>${assetHeatmapData.peak ? (metricValue(assetHeatmapData.metric, assetHeatmapData.peak.value)) : "—"}</strong></span>` : `<span><small>Peak day</small><strong>${calendarData.peak ? escapeHtml(calendarData.peak[0]) : "—"}</strong></span><span><small>Peak value</small><strong>${calendarData.peak ? (metricValue(calendarData.metric, calendarData.peak[1])) : "—"}</strong></span>`}</div></div><div id="upa-calendar-chart" class="upa-calendar-chart ${prefs.calendarStyle === "assets" ? "upa-asset-heatmap-chart" : ""}" role="img" aria-label="${prefs.calendarStyle === "assets" ? `Daily ${escapeHtml(assetHeatmapData.metric.label.toLowerCase())} heatmap with one row per asset` : "Calendar heatmap with one row per year"}"></div></section>
            <section class="upa-card upa-insight-card upa-view-panel upa-view-sankey" id="upa-view-sankey"><div class="upa-section-title"><div><small>REVENUE COMPOSITION</small><h2>Where revenue comes from</h2></div><div class="upa-section-tools"><span>${sankeyData.activePackages.length} shown</span>${chartActions("sankey")}</div></div><div class="upa-insight-toolbar upa-sankey-toolbar"><div class="upa-sankey-controls"><label class="upa-inline-select">Group by<select id="upa-sankey-group"><option value="none" ${sankeyData.groupBy === "none" ? "selected" : ""}>None</option><option value="category" ${sankeyData.groupBy === "category" ? "selected" : ""} ${sankeyData.categoryAvailable ? "" : "disabled"}>${sankeyData.categoryAvailable ? "Category" : "Category unavailable"}</option></select></label><details class="upa-package-filter"><summary><span>Packages</span><strong>${sankeyData.explicitKeys.length ? `${sankeyData.explicitKeys.length} selected` : "Top 8 by revenue"}</strong></summary><div class="upa-package-filter-panel"><div class="upa-package-filter-head"><span>Choose packages to compare</span><button data-action="sankey-top">Use top 8</button></div><div class="upa-package-checklist">${sankeyData.options.map(item => `<label><input type="checkbox" data-sankey-package="${escapeHtml(item.key)}" ${sankeyData.activePackages.some(active => active.key === item.key) ? "checked" : ""}><span><strong>${escapeHtml(item.name)}</strong><small>${money(item.gross)}</small></span></label>`).join("")}</div></div></details></div><div class="upa-insight-facts"><span><small>Revenue shown</small><strong>${money(sankeyData.total)}</strong></span>${sankeyData.groupBy === "category" ? `<span><small>Categories</small><strong>${number(sankeyData.categories)}</strong></span>` : ""}<span><small>Packages</small><strong>${number(sankeyData.activePackages.length)}</strong></span></div></div><div id="upa-sankey-chart" class="upa-sankey-chart" style="height:${sankeyHeight}px" role="img" aria-label="Gross revenue split by package${sankeyData.groupBy === "category" ? " and category" : ""}"></div></section>` : `<section class="upa-welcome"><div class="upa-welcome-copy"><small>YOUR COMPLETE PICTURE</small><h2>Go beyond the<br>one-year window.</h2><p>${fullSyncPending(syncJob) ? "Your complete history must finish syncing before it is ready to view. Your saved progress and Settings remain available." : "Bring your available sales, downloads, revenue, pageviews, and conversion history into one configurable workspace."}</p>${fullSyncPending(syncJob) ? "" : '<button class="upa-primary upa-large" data-action="sync-all">Sync full history</button>'}</div><div class="upa-welcome-visual" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><span>Lifetime</span></div></section>`}</main>
        </section>
      </div>
      <div class="upa-toast" role="status" aria-live="polite"></div>
    </aside>`;
    if (previousViewPanels.size && ["dashboard", "analytics"].includes(section)) {
      for (const [id, panel] of previousViewPanels) {
        const isActive = section === "dashboard" ? id === "upa-view-dashboard" : id === `upa-view-${view}`;
        const isFreshOnEveryRender = id === "upa-view-packages";
        if (!isActive && !isFreshOnEveryRender) host.querySelector(`#${id}`)?.replaceWith(panel);
      }
    }
    setDashboardPackageSettingsOpen(isDashboardPackageSettingsOpen);
    const nextContent = host.querySelector(".upa-content");
    if (previousContent && nextContent && previousSection === section && previousView === view) {
      nextContent.style.scrollBehavior = "auto";
      nextContent.scrollTop = previousScrollTop;
      requestAnimationFrame(() => { if (nextContent.isConnected) nextContent.style.removeProperty("scroll-behavior"); });
    }
    if (section === "package" && selectedPackage) {
      host.querySelector(".upa-content")?.insertAdjacentHTML("afterbegin", packageDetailPanel(selectedPackage, selectedPackageTotals, packageRevenueGrowth, packageUnitsTrend, packageRevenueHeatmap, dateBounds, packageInterval));
    }
    hydrateVisiblePackageIcons();
    if (hasData && isOpen) {
      if (section === "dashboard") { renderRevenueMixChart(revenueMixData); renderOverviewChart(overviewChartData); }
      if (section === "package" && selectedPackage) {
        renderPackageRevenueGrowthChart(packageRevenueGrowth, selectedPackage.name, dateBounds, prefs.packageRevenueMode, packageInterval);
        if (selectedPackageTotals.freeQty > 0) renderPackageTrendChart("package-units", packageUnitsTrend, selectedPackage.name);
      }
      if (section === "analytics") renderAnalyticsViewChart(view);
    }
  }

  function renderAnalyticsViewChart(view) {
    if (!analyticsChartModels) return;
    if (view === "revenue") for (const chart of analyticsChartModels.performanceCharts) renderPerformanceChart(chart);
    if (view === "lifetime") renderLifetimeChart(analyticsChartModels.lifetimeData);
    if (view === "calendar") {
      if (prefs.calendarStyle === "assets") renderAssetHeatmapChart(analyticsChartModels.assetHeatmapData);
      else renderCalendarChart(analyticsChartModels.calendarData);
    }
    if (view === "sankey") renderSankeyChart(analyticsChartModels.sankeyData);
  }

  function switchAnalyticsView(view) {
    const tracePerformance = globalThis.__UPA_PERF_TRACE === true;
    const switchStartedAt = tracePerformance ? performance.now() : 0;
    const content = document.querySelector("#upa-root .upa-content");
    if (content?.dataset.section !== "analytics") return false;
    if (!content || fullSyncPending(syncJob) || !analyticsChartModels || !["revenue", "lifetime", "calendar", "sankey", "packages"].includes(view)) return false;
    if (view !== "packages" && analyticsChartModels.freshness?.[view] !== analyticsViewModelKey(view)) return false;
    // This view has range-dependent text and chart data. Let the caller run a
    // synchronous workspace render so both stay in sync when it is selected.
    if (view === "calendar" && prefs.calendarStyle === "assets") return false;
    content.dataset.view = view;
    for (const tab of content.ownerDocument.querySelectorAll("#upa-root button[data-view]")) {
      const selected = tab.dataset.view === view;
      tab.classList.toggle("upa-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    }
    const host = content.ownerDocument.getElementById("upa-root");
    const range = host?.querySelector(".upa-header-range");
    if (range) range.style.display = view === "lifetime" ? "none" : "";
    const interval = host?.querySelector(".upa-header-interval");
    if (interval) interval.style.display = view === "revenue" ? "" : "none";
    disposeCharts();
    renderAnalyticsViewChart(view);
    if (tracePerformance) console.info("[UPA performance] analytics view switch", { view, totalMs: performance.now() - switchStartedAt, records: records.length });
    return true;
  }

  function switchWorkspaceSection(section) {
    const tracePerformance = globalThis.__UPA_PERF_TRACE === true;
    const switchStartedAt = tracePerformance ? performance.now() : 0;
    const host = document.getElementById("upa-root"), content = host?.querySelector(".upa-content");
    if (!content || fullSyncPending(syncJob) || !records.length || !["dashboard", "analytics"].includes(content.dataset.section) || !["dashboard", "analytics"].includes(section) || !dashboardChartModels || !analyticsChartModels) return false;
    if (section === "dashboard" && dashboardChartModels.key !== dashboardViewModelKey()) return false;
    if (section === "analytics" && prefs.view !== "packages" && analyticsChartModels.freshness?.[prefs.view] !== analyticsViewModelKey(prefs.view)) return false;
    prefs.section = section;
    if (section === "analytics" && prefs.view === "lifetime") {
      isRangePopoverOpen = false; isCustomRangeEditorOpen = false;
      host.querySelector(".upa-range-popover")?.remove();
      host.querySelector(".upa-range-trigger")?.setAttribute("aria-expanded", "false");
    }
    accountMenuOpen = false;
    content.dataset.section = section;
    content.dataset.view = prefs.view;
    content.scrollTop = 0;
    const header = host.querySelector(".upa-header");
    header?.classList.toggle("upa-header-compact", section === "dashboard");
    const title = host.querySelector(".upa-header-copy h1"), description = host.querySelector(".upa-header-subline p");
    if (title) title.textContent = section === "dashboard" ? "Dashboard" : "Analytics";
    if (description) description.textContent = section === "dashboard" ? "Your publishing business at a glance." : "Explore trends, patterns, and package performance.";
    for (const button of host.querySelectorAll("button[data-section=\"dashboard\"], button[data-section=\"analytics\"]")) {
      const selected = button.dataset.section === section;
      button.classList.toggle("upa-active", selected);
      button.setAttribute("aria-current", selected ? "page" : "false");
    }
    const tabs = host.querySelector(".upa-view-tabs");
    if (tabs) tabs.style.display = section === "analytics" ? "" : "none";
    for (const tab of host.querySelectorAll("button[data-view]")) {
      const selected = tab.dataset.view === prefs.view;
      tab.classList.toggle("upa-active", selected);
      tab.setAttribute("aria-selected", String(selected));
    }
    const range = host.querySelector(".upa-header-range");
    if (range) range.style.display = section === "analytics" && prefs.view === "lifetime" ? "none" : "";
    const interval = host.querySelector(".upa-header-interval");
    if (interval) interval.style.display = section === "analytics" && prefs.view === "revenue" ? "" : "none";
    const refresh = host.querySelector(".upa-refresh-action");
    const syncIncomplete = Boolean(syncJob && !syncJob.active && ["preparing", "months", "daily"].includes(syncJob.phase));
    const syncFailed = Boolean(syncJob?.error);
    if (refresh) refresh.style.display = section === "dashboard" && !syncJob?.active && !syncFailed && !syncIncomplete ? "" : "none";
    disposeCharts();
    if (isOpen) {
      if (section === "dashboard") {
        renderRevenueMixChart(dashboardChartModels.revenueMixData);
        renderOverviewChart(dashboardChartModels.overviewChartData);
      } else renderAnalyticsViewChart(prefs.view);
    }
    if (tracePerformance) console.info("[UPA performance] workspace section switch", { section, totalMs: performance.now() - switchStartedAt, records: records.length });
    return true;
  }
