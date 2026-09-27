  function scheduleRender() { if (!renderQueued) { renderQueued = true; requestAnimationFrame(render); } }
  function toast(message, type = "success") { const node = document.querySelector("#upa-root .upa-toast"); if (!node) return; node.textContent = message; node.dataset.type = type; node.classList.add("upa-show"); setTimeout(() => node.classList.remove("upa-show"), 3600); }
  function download(name, contents) { const url = URL.createObjectURL(new Blob([contents], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }

  function openGroupEditor(id = "") {
    groupEditor = { id };
    render();
    requestAnimationFrame(() => document.querySelector("#upa-group-name")?.focus());
  }

  async function saveGroupFromEditor() {
    const publisherId = publisherIdentity.id, generation = workspaceGeneration;
    const existing = groupEditor?.id ? packageGroups.find(group => group.id === groupEditor.id) : null;
    if (groupEditor?.id && !existing) { groupEditor = null; render(); return; }
    const name = compact(document.querySelector("#upa-group-name")?.value).slice(0, 40);
    if (!name) { toast("Enter a group name.", "error"); document.querySelector("#upa-group-name")?.focus(); return; }
    if (name.toLocaleLowerCase() === "all assets") { toast("All assets is the built-in catalog group. Choose another name.", "error"); return; }
    if (packageGroups.some(group => group.id !== existing?.id && group.name.toLocaleLowerCase() === name.toLocaleLowerCase())) { toast("A group with this name already exists.", "error"); return; }
    const availableIds = new Set([...document.querySelectorAll("#upa-root [data-group-package]")].map(input => input.dataset.groupPackage));
    const unavailableIds = document.querySelector("#upa-remove-unavailable")?.checked ? [] : (existing?.packageIds || []).filter(id => !availableIds.has(id));
    const packageIds = [...new Set([...document.querySelectorAll("#upa-root [data-group-package]:checked")].map(input => input.dataset.groupPackage).concat(unavailableIds))];
    if (!packageIds.length) { toast("Choose at least one asset for this group.", "error"); return; }
    const membershipKey = [...packageIds].sort().join("\u0000");
    if (packageGroups.some(group => group.id !== existing?.id && [...group.packageIds].sort().join("\u0000") === membershipKey)) { toast("Another group already contains exactly these assets.", "error"); return; }
    const now = new Date().toISOString();
    const saved = { id: existing?.id || crypto.randomUUID(), name, packageIds, createdAt: existing?.createdAt || now, updatedAt: now };
    packageGroups = existing ? packageGroups.map(group => group.id === existing.id ? saved : group) : [...packageGroups, saved];
    await savePackageGroups();
    if (!ownsWorkspace(publisherId, generation)) return;
    groupEditor = null;
    render();
    toast(existing ? "Package group updated." : "Package group created.");
  }

  async function clearAnalyticsData() {
    const publisherId = publisherIdentity.id;
    workspaceGeneration += 1;
    const generation = workspaceGeneration;
    if (syncJob) syncJob.active = false;
    isRefreshing = false;
    try {
      await clearPublisherData(publisherId);
      if (!ownsWorkspace(publisherId, generation)) return;
      records = [];
      syncJob = null;
      render();
      toast("This publisher's local analytics data was cleared.");
    } catch (error) {
      if (!ownsWorkspace(publisherId, generation)) return;
      console.warn("Publisher Analytics+ could not clear local analytics:", error.message);
      render();
      toast("We couldn't clear this publisher's local analytics. Please try again.", "error");
    }
  }

  function bindEvents() {
    document.addEventListener("error", event => {
      const image = event.target;
      if (!(image instanceof HTMLImageElement) || !image.closest(".upa-package-icon-wrap")) return;
      const wrapper = image.parentElement;
      image.remove();
      wrapper.classList.remove("upa-package-icon-wrap");
      wrapper.textContent = wrapper.dataset.initial || "P";
    }, true);
    document.addEventListener("click", async event => {
      if (!event.target.closest("#upa-root")) {
        if (isDashboardPackageSettingsOpen) setDashboardPackageSettingsOpen(false);
        return;
      }
      if (!event.target.closest(".upa-package-filter")) document.querySelectorAll("#upa-root .upa-package-filter[open]").forEach(filter => { filter.open = false; });
      const outsideAccountMenu = accountMenuOpen && !event.target.closest(".upa-publisher-account");
      if (outsideAccountMenu) accountMenuOpen = false;
      const outsideDashboardPackageSettings = isDashboardPackageSettingsOpen && !event.target.closest(".upa-dashboard-package-settings");
      if (outsideDashboardPackageSettings) setDashboardPackageSettingsOpen(false);
      if (isRangePopoverOpen && !event.target.closest(".upa-range-picker")) {
        isRangePopoverOpen = false; isCustomRangeEditorOpen = false;
        document.querySelector("#upa-root .upa-range-popover")?.remove();
        document.querySelector("#upa-root .upa-range-trigger")?.setAttribute("aria-expanded", "false");
      }
      if (isPerformanceScopeMenuOpen && !event.target.closest(".upa-performance-scope-picker")) {
        isPerformanceScopeMenuOpen = false;
        document.querySelector("#upa-root .upa-performance-scope-menu")?.remove();
        document.querySelector("#upa-root .upa-performance-scope-trigger")?.setAttribute("aria-expanded", "false");
      }
      const action = event.target.closest("[data-action]")?.dataset.action;
      const themeButton = event.target.closest("[data-theme]");
      if (themeButton) {
        prefs.theme = ["system", "light", "dark"].includes(themeButton.dataset.theme) ? themeButton.dataset.theme : "system";
        if (publisherIdentityState === "ready") await savePrefs(); render(); return;
      }
      if (action === "download-support") { download(`publisher-analytics-support-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(supportReport(), null, 2)); return; }
      if (action === "open-settings" || action === "recovery-home") {
        prefs.section = action === "open-settings" ? "settings" : "dashboard";
        groupEditor = null; accountMenuOpen = false;
        render();
        if (publisherIdentityState === "ready") await savePrefs();
        return;
      }
      if (action === "retry-publisher") {
        await openPublisherWorkspace(true);
        return;
      }
      if (action === "open-portal") {
        extensionApi.runtime.sendMessage({ type: "UPA_OPEN_PORTAL", portalTabId }).catch(() => {});
        return;
      }
      if (publisherIdentityState !== "ready" && action && action !== "toggle-account") return;
      const packageButton = event.target.closest("button[data-package-id]");
      if (packageButton && publisherIdentityState === "ready") {
        prefs.packageId = packageButton.dataset.packageId;
        prefs.section = "package";
        await savePrefs(); render(); return;
      }
      const packageRevenueModeButton = event.target.closest("button[data-package-revenue-mode]");
      if (packageRevenueModeButton) {
        const mode = packageRevenueModeButton.dataset.packageRevenueMode === "interval" ? "interval" : "cumulative";
        if (mode === prefs.packageRevenueMode) return;
        prefs.packageRevenueMode = mode;
        await savePrefs(); render(); return;
      }
      const performanceLayoutButton = event.target.closest("button[data-performance-layout]");
      if (performanceLayoutButton) {
        const layout = performanceLayoutButton.dataset.performanceLayout;
        if (!["grid", "wide"].includes(layout) || layout === prefs.performanceLayout) return;
        prefs.performanceLayout = layout;
        document.querySelector("#upa-root .upa-performance-chart-grid")?.setAttribute("data-layout", layout);
        for (const button of document.querySelectorAll("#upa-root button[data-performance-layout]")) {
          button.setAttribute("aria-pressed", String(button.dataset.performanceLayout === layout));
        }
        await savePrefs();
        return;
      }
      if (action === "performance-scope-toggle") { isPerformanceScopeMenuOpen = !isPerformanceScopeMenuOpen; render(); return; }
      if (action === "dashboard-package-settings-toggle") {
        setDashboardPackageSettingsOpen(!isDashboardPackageSettingsOpen);
        return;
      }
      const performanceScopeButton = event.target.closest("[data-performance-scope]");
      if (performanceScopeButton) {
        const scope = performanceScopeButton.dataset.performanceScope, id = scope === "all" ? "all" : performanceScopeButton.dataset.performanceScopeId || "", key = `${scope}:${id}`;
        if (scope === "group" && !packageGroups.some(group => group.id === id)) return;
        if (scope === "asset" && !id) return;
        let scopes = sanitizedPerformanceScopes(prefs.performanceScopes), existingIndex = scopes.findIndex(item => `${item.type}:${item.id}` === key);
        if (existingIndex >= 0) scopes.splice(existingIndex, 1);
        else {
          if (key !== "all:all" && scopes.length === 1 && scopes[0].type === "all") scopes = [];
          scopes.push({ type: scope, id });
        }
        prefs.performanceScopes = scopes.length ? scopes : [{ type: "all", id: "all" }];
        const selectedKeys = new Set(prefs.performanceScopes.map(item => `${item.type}:${item.id}`));
        prefs.performanceHiddenScopes = (prefs.performanceHiddenScopes || []).filter(item => selectedKeys.has(item));
        isPerformanceScopeMenuOpen = true;
        await savePrefs(); render();
        requestAnimationFrame(() => [...document.querySelectorAll("#upa-root [data-performance-scope-key]")].find(item => item.dataset.performanceScopeKey === key)?.focus());
        return;
      }
      if (action === "group-cancel") { groupEditor = null; render(); return; }
      if (action === "group-create") { openGroupEditor(); return; }
      if (action === "group-edit") { openGroupEditor(event.target.closest("[data-group-id]")?.dataset.groupId || ""); return; }
      if (action === "group-save") { await saveGroupFromEditor(); return; }
      if (action === "manage-groups") { isPerformanceScopeMenuOpen = false; prefs.section = "groups"; await savePrefs(); render(); return; }
      if (action === "group-back-performance") { groupEditor = null; prefs.section = "analytics"; prefs.view = "revenue"; await savePrefs(); render(); return; }
      if (action === "group-delete") {
        const id = event.target.closest("[data-group-id]")?.dataset.groupId || "", group = packageGroups.find(item => item.id === id);
        if (!group || !window.confirm(`Delete the package group “${group.name}”? Its assets and analytics will not be deleted.`)) return;
        const publisherId = publisherIdentity.id, generation = workspaceGeneration;
        packageGroups = packageGroups.filter(item => item.id !== id); await savePackageGroups();
        if (!ownsWorkspace(publisherId, generation)) return;
        const removedKey = `group:${id}`;
        prefs.performanceScopes = sanitizedPerformanceScopes(prefs.performanceScopes).filter(scope => `${scope.type}:${scope.id}` !== removedKey);
        if (!prefs.performanceScopes.length) prefs.performanceScopes = [{ type: "all", id: "all" }];
        prefs.performanceHiddenScopes = (prefs.performanceHiddenScopes || []).filter(key => key !== removedKey);
        await savePrefs();
        if (groupEditor?.id === id) groupEditor = null;
        render(); toast("Package group deleted."); return;
      }
      if (action === "range-toggle") {
        isRangePopoverOpen = !isRangePopoverOpen; isCustomRangeEditorOpen = false; updateRangePopover(); return;
      }
      const rangeOption = event.target.closest("[data-range-option]")?.dataset.rangeOption;
      if (rangeOption) {
        if (rangeOption === "custom") {
          isRangePopoverOpen = true; isCustomRangeEditorOpen = true; updateRangePopover();
          requestAnimationFrame(() => document.querySelector("#upa-custom-start")?.focus());
          return;
        }
        if (rangeOption === prefs.range) {
          isRangePopoverOpen = false; isCustomRangeEditorOpen = false; updateRangePopover(); return;
        }
        prefs.range = rangeOption; isRangePopoverOpen = false; isCustomRangeEditorOpen = false;
        render(); await savePrefs(); return;
      }
      if (action === "range-back") { isRangePopoverOpen = true; isCustomRangeEditorOpen = false; updateRangePopover(); return; }
      if (action === "range-cancel") { isRangePopoverOpen = false; isCustomRangeEditorOpen = false; updateRangePopover(); return; }
      if (action === "range-apply") {
        let start = document.querySelector("#upa-custom-start")?.value || "", end = document.querySelector("#upa-custom-end")?.value || "";
        const available = availableDateBounds();
        if (!start || !end || !available.start) { toast("Choose both a start and end date.", "error"); return; }
        start = [[start, available.start].sort().at(-1), available.end].sort()[0];
        end = [[end, available.start].sort().at(-1), available.end].sort()[0];
        if (start > end) [start, end] = [end, start];
        prefs.range = "custom"; prefs.start = start; prefs.end = end; isRangePopoverOpen = false; isCustomRangeEditorOpen = false;
        render(); await savePrefs(); return;
      }
      const chartButton = event.target.closest("[data-chart-action]");
      if (chartButton) { await handleChartAction(chartButton.dataset.chartAction, chartButton.dataset.chart); return; }
      const performanceLegendButton = event.target.closest("[data-performance-legend-scope]");
      if (performanceLegendButton) {
        const key = performanceLegendButton.dataset.performanceLegendScope, hidden = new Set(prefs.performanceHiddenScopes || []);
        if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
        prefs.performanceHiddenScopes = [...hidden];
        await savePrefs(); render(); return;
      }
      const lifetimeLegendButton = event.target.closest("[data-lifetime-legend-package]");
      if (lifetimeLegendButton) {
        const key = lifetimeLegendButton.dataset.lifetimeLegendPackage, hidden = new Set(prefs.lifetimeHiddenPackages || []);
        if (hidden.has(key)) hidden.delete(key); else hidden.add(key);
        prefs.lifetimeHiddenPackages = [...hidden];
        await savePrefs(); render(); return;
      }
      const sectionButton = event.target.closest("button[data-section]");
      if (sectionButton) {
        prefs.section = sectionButton.dataset.section;
        if (prefs.section !== "groups") groupEditor = null;
        accountMenuOpen = false;
        const switchedInPlace = switchWorkspaceSection(prefs.section);
        await savePrefs();
        if (!switchedInPlace) render();
        return;
      }
      const viewButton = event.target.closest("button[data-view]");
      if (viewButton) {
        prefs.section = "analytics"; prefs.view = viewButton.dataset.view; groupEditor = null;
        if (prefs.view === "lifetime") { isRangePopoverOpen = false; isCustomRangeEditorOpen = false; }
        const switchedInPlace = switchAnalyticsView(prefs.view);
        await savePrefs();
        if (!switchedInPlace) render();
        return;
      }
      const calendarStyleButton = event.target.closest("button[data-calendar-style]");
      if (calendarStyleButton) { prefs.calendarStyle = calendarStyleButton.dataset.calendarStyle === "assets" ? "assets" : "calendar"; await savePrefs(); render(); return; }
      if (event.target.closest(".upa-fab")) { isOpen = true; render(); return; }
      if (action === "toggle-account") { accountMenuOpen = !accountMenuOpen; render(); return; }
      if (action === "settings-sync") {
        const shouldStart = !syncJob?.active && !["preparing", "months", "daily"].includes(syncJob?.phase);
        prefs.section = "dashboard"; accountMenuOpen = false; await savePrefs(); render();
        if (shouldStart) await startFullSync();
        return;
      }
      if (action === "sync-all") await startFullSync();
      if (action === "refresh") await incrementalSync(true);
      if (action === "stop-sync" && syncJob) { syncJob.active = false; syncJob.label = "Sync paused"; await saveJob(); render(); }
      if (action === "continue-sync") await continueFullSync();
      if (action === "lifetime-top") { prefs.lifetimePackages = []; prefs.lifetimeHiddenPackages = []; await savePrefs(); render(); }
      if (action === "sankey-top") { prefs.sankeyPackages = []; await savePrefs(); render(); }
      if (action === "export") { download(`publisher-analytics-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), publisher: { id: publisherIdentity.id, name: publisherIdentity.name }, records }, null, 2)); toast("Your analytics backup is downloading."); }
      if (action === "clear" && window.confirm(`Clear locally synced analytics for ${publisherIdentity.name}? Your preferences and package groups will be kept. This can't be undone.`)) {
        await clearAnalyticsData();
      }
      if (!action && outsideAccountMenu) render();
    });
    document.addEventListener("change", async event => {
      if (event.target.id === "upa-interval") { prefs.interval = event.target.value; render(); await savePrefs(); }
      if (event.target.id === "upa-calendar-metric") { prefs.calendarMetric = event.target.value; await savePrefs(); render(); }
      if (event.target.id === "upa-lifetime-metric") { prefs.lifetimeMetric = LIFETIME_METRICS[event.target.value] ? event.target.value : "revenue"; await savePrefs(); render(); }
      if (event.target.id === "upa-lifetime-style") { prefs.lifetimeStyle = event.target.value === "area" ? "area" : "lines"; if (prefs.lifetimeStyle === "area") prefs.lifetimeAlign = "calendar"; await savePrefs(); render(); }
      if (event.target.id === "upa-lifetime-align") { prefs.lifetimeAlign = event.target.value === "age" ? "age" : "calendar"; if (prefs.lifetimeAlign === "age") prefs.lifetimeStyle = "lines"; await savePrefs(); render(); }
      if (event.target.id === "upa-sankey-group") { prefs.sankeyGroupBy = event.target.value === "category" ? "category" : "none"; await savePrefs(); render(); }
      if (event.target.matches("[data-dashboard-package-column]")) {
        const key = event.target.dataset.dashboardPackageColumn;
        if (DASHBOARD_PACKAGE_COLUMNS.includes(key)) {
          const columns = new Set(prefs.dashboardPackageColumns);
          if (event.target.checked) columns.add(key); else columns.delete(key);
          prefs.dashboardPackageColumns = DASHBOARD_PACKAGE_COLUMNS.filter(column => columns.has(column));
          updateDashboardPackageTable();
          await savePrefs();
        }
      }
      if (event.target.matches("[data-lifetime-package]")) {
        prefs.lifetimePackages = [...document.querySelectorAll("#upa-root [data-lifetime-package]:checked")].map(input => input.dataset.lifetimePackage);
        if (event.target.checked) prefs.lifetimeHiddenPackages = (prefs.lifetimeHiddenPackages || []).filter(key => key !== event.target.dataset.lifetimePackage);
        await savePrefs(); render(); requestAnimationFrame(() => { const filter = document.querySelector("#upa-root .upa-view-lifetime .upa-package-filter"); if (filter) filter.open = true; });
      }
      if (event.target.matches("[data-sankey-package]")) {
        prefs.sankeyPackages = [...document.querySelectorAll("#upa-root [data-sankey-package]:checked")].map(input => input.dataset.sankeyPackage);
        await savePrefs(); render(); requestAnimationFrame(() => { const filter = document.querySelector("#upa-root .upa-package-filter"); if (filter) filter.open = true; });
      }
    });
    document.addEventListener("keydown", event => {
      if (groupEditor && event.key === "Enter" && event.target.id === "upa-group-name") { event.preventDefault(); saveGroupFromEditor(); return; }
      if (event.key !== "Escape") return;
      if (groupEditor) { groupEditor = null; render(); return; }
      if (isPerformanceScopeMenuOpen) { isPerformanceScopeMenuOpen = false; render(); requestAnimationFrame(() => document.querySelector("#upa-root .upa-performance-scope-trigger")?.focus()); return; }
      if (isDashboardPackageSettingsOpen) { setDashboardPackageSettingsOpen(false); document.querySelector("#upa-root .upa-dashboard-package-settings-trigger")?.focus(); return; }
      if (accountMenuOpen) { accountMenuOpen = false; render(); requestAnimationFrame(() => document.querySelector("#upa-root .upa-account-trigger")?.focus()); return; }
      const openPackageFilter = document.querySelector("#upa-root .upa-package-filter[open]");
      if (openPackageFilter) { openPackageFilter.open = false; openPackageFilter.querySelector("summary")?.focus(); return; }
      if (!isRangePopoverOpen) return;
      isRangePopoverOpen = false; isCustomRangeEditorOpen = false; updateRangePopover();
      requestAnimationFrame(() => document.querySelector("#upa-root .upa-range-trigger")?.focus());
    });
    systemDarkTheme.addEventListener("change", () => { if (prefs.theme === "system") scheduleRender(); });
    extensionApi.runtime.onMessage.addListener(message => {
      if (message?.type !== "UPA_TOGGLE") return;
      isOpen = !isOpen;
      if (!isOpen) { isRangePopoverOpen = false; isCustomRangeEditorOpen = false; isPerformanceScopeMenuOpen = false; accountMenuOpen = false; groupEditor = null; }
      render();
    });
  }

  async function init() {
    isOpen = standalone;
    const root = document.createElement("div"); root.id = "upa-root"; document.body.appendChild(root); bindEvents(); render();
    await openPublisherWorkspace();
  }

  init().catch(error => console.error("Publisher Analytics+ failed to initialize:", error));
