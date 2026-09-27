  function publisherFromHeader() {
    const button = [...document.querySelectorAll("button")].find(item => /User menu/i.test(item.getAttribute("aria-label") || "")) || document.querySelector('nav[aria-label="User"] button:last-of-type');
    if (!button) return null;
    const lines = String(button.innerText || "").split(/\n+/).map(compact).filter(Boolean);
    const labelParts = (button.getAttribute("aria-label") || "").split(",").map(compact).filter(Boolean);
    const portalLabel = lines.at(-1) || labelParts.at(-2) || "";
    const username = lines.at(-2) || labelParts[0] || "";
    return { portalLabel, username, name: portalLabel.replace(/\s+Publisher$/i, "") || username || "Publisher" };
  }

  function profileValue(doc, labelText) {
    const label = [...doc.querySelectorAll("div, span, p")].find(item => !item.children.length && compact(item.textContent) === labelText);
    if (!label) return "";
    let node = label.parentElement;
    while (node && node !== doc.body) {
      const text = compact(node.innerText);
      if (text.startsWith(labelText) && text.length > labelText.length && text.length < 180) return compact(text.slice(labelText.length));
      node = node.parentElement;
    }
    return "";
  }

  function publisherFromProfile(doc) {
    const image = doc.querySelector('img[alt="Profile picture"]');
    const name = profileValue(doc, "Profile name"), icon = image?.currentSrc || image?.src || "";
    return name || icon ? { name, icon } : null;
  }

  async function loadPublisherProfile() {
    if (standalone) return null;
    if (location.pathname === "/account/profile") {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const profile = publisherFromProfile(document); if (profile) return profile;
        await sleep(200);
      }
      return null;
    }
    const frame = document.createElement("iframe");
    frame.className = "upa-profile-frame"; frame.src = "/account/profile"; frame.tabIndex = -1; frame.setAttribute("aria-hidden", "true");
    document.body.appendChild(frame);
    try {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        await sleep(200);
        try { const profile = frame.contentDocument && publisherFromProfile(frame.contentDocument); if (profile) return profile; } catch { return null; }
      }
      return null;
    } finally { frame.remove(); }
  }

  async function fetchPublisherIdentity(force = false) {
    const user = await apiJson(API.user);
    const id = compact(user?.publisherId);
    if (!id) throw Object.assign(new Error("The active Publisher Portal account did not provide a publisher identity."), { code: "missing-publisher" });
    publisherConfirmed = true;
    const header = publisherFromHeader();
    const key = publisherStorageKey(PUBLISHER_KEY_PREFIX, id);
    let cached;
    try { cached = (await extensionApi.storage.local.get(key))[key]; }
    catch (error) { recordDiagnostic({ kind: "publisher-display-cache", ...failureDetails(error) }); }
    const fresh = !force && cached?.id === id && Date.now() - Number(cached.updatedAt || 0) < 86400000;
    if (fresh) return { ...cached, portalLabel: displayText(cached.portalLabel), name: displayText(cached.name) };
    const apiIcon = typeof user.avatar === "string" ? user.avatar : "";
    const apiName = displayText(user.publisherName || user.publisherOrgName);
    const profile = apiIcon && apiName ? null : await loadPublisherProfile();
    const identity = {
      id,
      organizationId: compact(user.publisherOrgId || user.defaultOrgId),
      portalLabel: displayText(header?.portalLabel),
      name: apiName || displayText(profile?.name) || displayText(header?.name) || "Publisher",
      icon: apiIcon || profile?.icon || "",
      updatedAt: Date.now()
    };
    try { await extensionApi.storage.local.set({ [key]: identity }); }
    catch (error) { recordDiagnostic({ kind: "publisher-display-cache", ...failureDetails(error) }); }
    return identity;
  }
  function recordDiagnostic(event) {
    diagnosticEvents.push({ at: new Date().toISOString(), ...event });
    if (diagnosticEvents.length > 60) diagnosticEvents.shift();
  }

  function failureDetails(error) {
    const message = String(error?.message || "");
    const code = ["missing-publisher", "timeout", "network", "http", "unexpected-response"].includes(error?.code) ? error.code
      : /maximum allowed size|message.*too large/i.test(message) ? "message-too-large"
      : /quota/i.test(message) ? "storage-full"
      : /extension context invalidated/i.test(message) ? "extension-reloaded"
      : /stack|recursion/i.test(message) ? "stack-limit" : "unexpected-error";
    const name = ["Error", "TypeError", "RangeError", "QuotaExceededError", "SecurityError", "AbortError"].includes(error?.name) ? error.name : "Error";
    const locations = [...new Set(String(error?.stack || "").match(/(?:content|background|api-client)\.js:\d+:\d+/g) || [])].slice(0, 5);
    return { code, name, locations };
  }

  function supportReport() {
    let version = "unknown";
    try { version = extensionApi.runtime.getManifest().version; } catch { /* Local previews have no manifest. */ }
    const job = syncJob;
    return {
      format: "publisher-analytics-support", version: 1, extensionVersion: version, generatedAt: new Date().toISOString(),
      browser: navigator.userAgent.match(/(?:Firefox|Edg|Chrome)\/[\d.]+/g)?.join(" ") || "unknown",
      workspace: { state: publisherIdentityState, stage: workspaceStage, publisherConfirmed, loadedRecords: records.length, failure: workspaceFailure },
      sync: job ? { phase: job.phase, active: Boolean(job.active), completed: job.completed, total: job.total,
        packageCount: job.packages?.length || 0, monthIndex: job.monthIndex, scopeIndex: job.scopeIndex,
        cursor: job.cursor, endExclusive: job.endExclusive, failure: job.failure || null } : null,
      events: diagnosticEvents.slice()
    };
  }

  function supportPanel() {
    return `<section class="upa-settings-section"><div class="upa-settings-intro"><h2>Troubleshooting</h2><p>Save a report if you need help.</p></div><article class="upa-settings-panel upa-support-panel"><p>The report includes your extension version, sync progress, and recent error types. It excludes account names, asset names, sales figures, and sign-in details. Nothing is sent automatically.</p><button class="upa-settings-primary" type="button" data-action="download-support">Download support report</button><details><summary>Preview report</summary><pre>${escapeHtml(JSON.stringify(supportReport(), null, 2))}</pre></details></article></section>`;
  }

  function workspaceErrorCopy() {
    if (workspaceStage === "identity") return { title: "We couldn't confirm your publisher.", detail: "Open the Publisher Portal and check that you are signed in. Then try again." };
    if (workspaceStage === "render") return { title: "We couldn't display your analytics.", detail: "Your saved history has not been cleared. Download a support report, or try opening the workspace again." };
    return { title: "We couldn't open your saved workspace.", detail: "Your publisher was confirmed, but saved data could not be loaded. Download a support report before trying again. Your saved history has not been cleared." };
  }

  function renderRecovery(host) {
    try { disposeCharts(); }
    catch (error) {
      recordDiagnostic({ kind: "chart-cleanup", ...failureDetails(error) });
      chartResizeObservers.clear(); chartInstances.clear();
    }
    host.classList.toggle("upa-open", isOpen);
    host.classList.toggle("upa-theme-dark", darkThemeActive());
    document.documentElement.classList.toggle("upa-dashboard-open", isOpen);
    const settings = prefs.section === "settings", loading = publisherIdentityState === "loading";
    const logo = extensionApi.runtime.getURL("icons/publisher-analytics-128.png"), copy = workspaceErrorCopy();
    const status = loading ? `<h2>${workspaceStage === "identity" ? "Checking your publisher…" : "Opening your saved workspace…"}</h2><p class="upa-workspace-load-status">${workspaceRecordsLoaded ? `Loading saved history · ${workspaceRecordsLoaded} records` : "Opening your local workspace. Large histories can take longer."}</p>`
      : `<h2>${copy.title}</h2><p>${copy.detail}</p><div class="upa-recovery-actions"><button class="upa-primary" data-action="retry-publisher">Try again</button><button data-action="exit-analytics">Open Publisher Portal</button></div>`;
    host.innerHTML = `<button class="upa-fab" aria-label="Open Publisher Analytics+" title="Publisher Analytics+"><img src="${logo}" alt=""></button><aside class="upa-panel" aria-label="Publisher Analytics+ dashboard"><div class="upa-shell"><aside class="upa-sidebar" aria-label="Analytics workspace"><div class="upa-brand"><span><img src="${logo}" alt=""></span><div><strong>Publisher Analytics+</strong><small>Asset Store Insights</small></div></div><div class="upa-primary-nav"><button data-action="recovery-home">Home</button><button data-action="open-settings">Settings</button><button data-action="exit-analytics">Exit to Publisher Portal</button></div>${publisherAccount()}</aside><section class="upa-workspace"><header class="upa-header upa-header-compact"><div class="upa-header-main"><div class="upa-header-copy"><small>Publisher workspace</small><h1>${settings ? "Settings" : "Your workspace"}</h1></div></div><nav class="upa-mobile-nav" aria-label="Workspace sections"><button data-action="recovery-home">Home</button><button data-action="open-settings">Settings</button><button data-action="exit-analytics">Publisher Portal</button></nav></header><main class="upa-content" data-section="${settings ? "settings" : "dashboard"}"><section class="upa-recovery-card" role="status">${status}</section>${settings ? '<section class="upa-recovery-card"><h2>Appearance</h2><div class="upa-recovery-actions"><button data-theme="system">System</button><button data-theme="light">Light</button><button data-theme="dark">Dark</button></div><p>Data management becomes available when your workspace opens.</p></section>' : ""}${supportPanel()}</main></section></div><div class="upa-toast" role="status"></div></aside>`;
  }

  async function openPublisherWorkspace(force = false) {
    if (workspaceLoading) return;
    workspaceLoading = true;
    publisherConfirmed = false;
    workspaceFailure = null;
    workspaceStage = "identity";
    workspaceRecordsLoaded = 0;
    publisherIdentityState = "loading";
    render();
    try { await activatePublisher(await fetchPublisherIdentity(force), { initial: true }); }
    catch (error) {
      publisherIdentityState = "error";
      workspaceFailure = { stage: workspaceStage, ...failureDetails(error) };
      recordDiagnostic({ kind: "workspace", ...workspaceFailure });
      console.warn("Publisher Analytics+ workspace failed:", workspaceStage, error);
      render();
    } finally { workspaceLoading = false; }
  }
  function sanitizedPreferences(storedPrefs = {}) {
    const analyticsViews = ["revenue", "lifetime", "calendar", "sankey", "packages"], ranges = ["all", "7d", "30d", "3", "6", "12", "36", "60", "mtd", "ytd", "custom"];
    const storedSankeyGroupBy = ["none", "category"].includes(storedPrefs.sankeyGroupBy) ? storedPrefs.sankeyGroupBy : "category";
    const storedDashboardColumns = Array.isArray(storedPrefs.dashboardPackageColumns) ? storedPrefs.dashboardPackageColumns : null;
    const dashboardReviewsDefaultOffApplied = storedPrefs.dashboardPackageReviewsDefaultOffApplied === true;
    const storedLifetimeAlign = storedPrefs.lifetimeAlign === "age" ? "age" : "calendar";
    const storedLifetimeStyle = storedPrefs.lifetimeStyle === "area" && storedLifetimeAlign === "calendar" ? "area" : "lines";
    const lifetimeStyle = storedPrefs.lifetimeStackDefaultApplied === true ? storedLifetimeStyle : "area";
    return {
      section: ["dashboard", "analytics", "package", "groups", "settings"].includes(storedPrefs.section) ? storedPrefs.section : (storedPrefs.view && storedPrefs.view !== "overview" ? "analytics" : "dashboard"),
      view: analyticsViews.includes(storedPrefs.view) ? storedPrefs.view : "revenue", packageId: compact(storedPrefs.packageId), packageRevenueMode: storedPrefs.packageRevenueMode === "interval" ? "interval" : "cumulative", range: ranges.includes(storedPrefs.range) ? storedPrefs.range : "all", interval: storedPrefs.interval || "auto", start: storedPrefs.start || "", end: storedPrefs.end || "", theme: ["system", "light", "dark"].includes(storedPrefs.theme) ? storedPrefs.theme : "system",
      performanceLayout: storedPrefs.performanceLayout === "wide" ? "wide" : "grid", performanceScopes: sanitizedPerformanceScopes(storedPrefs.performanceScopes), performanceHiddenScopes: Array.isArray(storedPrefs.performanceHiddenScopes) ? [...new Set(storedPrefs.performanceHiddenScopes.map(String).filter(Boolean))] : [], dashboardPackageColumns: (storedDashboardColumns ? DASHBOARD_PACKAGE_COLUMNS.filter(key => storedDashboardColumns.includes(key)) : [...DEFAULT_DASHBOARD_PACKAGE_COLUMNS]).filter(key => dashboardReviewsDefaultOffApplied || key !== "reviews"), dashboardPackageReviewsDefaultOffApplied: true, calendarMetric: storedPrefs.calendarMetric || "sales", calendarStyle: storedPrefs.calendarStyle === "assets" ? "assets" : "calendar", lifetimeMetric: LIFETIME_METRICS[storedPrefs.lifetimeMetric] ? storedPrefs.lifetimeMetric : "revenue", lifetimeStyle, lifetimeAlign: lifetimeStyle === "area" ? "calendar" : storedLifetimeAlign, lifetimeStackDefaultApplied: true, lifetimePackages: Array.isArray(storedPrefs.lifetimePackages) ? storedPrefs.lifetimePackages : [], lifetimeHiddenPackages: Array.isArray(storedPrefs.lifetimeHiddenPackages) ? storedPrefs.lifetimeHiddenPackages : [], sankeyPackages: Array.isArray(storedPrefs.sankeyPackages) ? storedPrefs.sankeyPackages : [], sankeyGroupBy: storedPrefs.sankeyCategoryDefaultApplied === true ? storedSankeyGroupBy : "category", sankeyCategoryDefaultApplied: true
    };
  }

  function sanitizedPerformanceScopes(value) {
    if (!Array.isArray(value)) return [{ type: "all", id: "all" }];
    const seen = new Set(), scopes = [];
    for (const item of value) {
      const type = item?.type, id = type === "all" ? "all" : compact(item?.id), key = `${type}:${id}`;
      if (!["all", "group", "asset"].includes(type) || !id || seen.has(key)) continue;
      seen.add(key); scopes.push({ type, id });
    }
    return scopes.length ? scopes : [{ type: "all", id: "all" }];
  }

  function sanitizedPackageGroups(value) {
    if (!Array.isArray(value)) return [];
    const ids = new Set(), names = new Set(), memberships = new Set(), groups = [];
    for (const item of value) {
      const id = compact(item?.id), name = compact(item?.name).slice(0, 40), normalizedName = name.toLocaleLowerCase();
      const packageIds = [...new Set((Array.isArray(item?.packageIds) ? item.packageIds : []).map(value => compact(value)).filter(Boolean))];
      const membership = [...packageIds].sort().join("\u0000");
      if (!id || ["all", "custom"].includes(id) || !name || !packageIds.length || ids.has(id) || names.has(normalizedName) || memberships.has(membership) || normalizedName === "all assets") continue;
      ids.add(id); names.add(normalizedName); memberships.add(membership);
      groups.push({ id, name, packageIds, createdAt: item.createdAt || new Date().toISOString(), updatedAt: item.updatedAt || item.createdAt || new Date().toISOString() });
    }
    return groups.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  async function savePrefs() {
    if (!publisherIdentity.id) return;
    await extensionApi.storage.local.set({ [publisherStorageKey(PREFS_KEY_PREFIX)]: prefs });
  }

  async function savePackageGroups() {
    if (!publisherIdentity.id) return;
    packageGroups = sanitizedPackageGroups(packageGroups);
    await extensionApi.storage.local.set({ [publisherStorageKey(GROUPS_KEY_PREFIX)]: packageGroups });
  }

  function ownsWorkspace(publisherId, generation) {
    return publisherIdentity.id === publisherId && workspaceGeneration === generation;
  }

  async function activatePublisher(identity, { initial = false, resume = true } = {}) {
    if (publisherIdentity.id && publisherIdentity.id !== identity.id) diagnosticEvents.length = 0;
    workspaceGeneration += 1;
    const generation = workspaceGeneration;
    publisherIdentity = identity;
    publisherIdentityState = "loading";
    records = [];
    workspaceRecordsLoaded = 0;
    syncJob = null;
    packageGroups = [];
    groupEditor = null;
    isPerformanceScopeMenuOpen = false;
    isDashboardPackageSettingsOpen = false;
    isRefreshing = false;
    workspaceStage = "preferences";
    render();
    const preferencesKey = publisherStorageKey(PREFS_KEY_PREFIX, identity.id), groupsKey = publisherStorageKey(GROUPS_KEY_PREFIX, identity.id);
    const stored = await extensionApi.storage.local.get([preferencesKey, groupsKey]);
    if (!ownsWorkspace(identity.id, generation)) return;
    prefs = sanitizedPreferences(stored[preferencesKey] || {});
    packageGroups = sanitizedPackageGroups(stored[groupsKey] || []);
    prefs.performanceScopes = sanitizedPerformanceScopes(prefs.performanceScopes).filter(scope => scope.type !== "group" || packageGroups.some(group => group.id === scope.id));
    if (!prefs.performanceScopes.length) prefs.performanceScopes = [{ type: "all", id: "all" }];
    await extensionApi.storage.local.set({ [preferencesKey]: prefs });
    workspaceStage = "checkpoint";
    const publisherJob = await getMeta(SYNC_KEY, identity.id);
    if (!ownsWorkspace(identity.id, generation)) return;
    syncJob = publisherJob;
    workspaceStage = "local-data";
    const publisherRecords = await getAll(identity.id);
    if (!ownsWorkspace(identity.id, generation)) return;
    records = publisherRecords;
    syncJob = publisherJob;
    publisherIdentityState = "ready";
    workspaceStage = "render";
    if (initial && syncJob?.active) isOpen = true;
    render();
    if (!resume || publisherIdentityState !== "ready") return;
    if (syncJob?.active) runFullSync(identity.id, generation);
    else if (records.length) incrementalSync(false, identity.id, generation);
  }
