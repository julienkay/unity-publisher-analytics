  function earliestAccountDate(packages, revenue) {
    const dates = [...packages.map(item => item.firstPublished), ...revenue.map(item => item.date)].filter(Boolean).sort();
    if (!dates.length) throw new Error("The Publisher API did not return an account start date.");
    return [dates[0], DAILY_API_MIN_DATE].sort().at(-1);
  }

  function incrementalDailyStart(scope, publisherRecords) {
    const latest = publisherRecords.filter(item => item.type === "daily" && item.packageId === scope.id).map(item => item.date).sort().at(-1);
    if (latest) return latest;
    if (!scope.id) return "";
    if (!scope.firstPublished) throw new Error(`The asset "${scope.name}" did not include a publication date.`);
    return [scope.firstPublished, DAILY_API_MIN_DATE].sort().at(-1);
  }

  function incrementalDailyRanges(scope, publisherRecords, endExclusive) {
    const ranges = [];
    let start = incrementalDailyStart(scope, publisherRecords);
    while (start && start < endExclusive) {
      const rangeEnd = [addDays(start, DAILY_API_WINDOW_DAYS), endExclusive].sort()[0];
      ranges.push({ start, endExclusive: rangeEnd });
      start = rangeEnd;
    }
    return ranges;
  }
  async function saveJob(job = syncJob, publisherId = publisherIdentity.id) { await setMeta(SYNC_KEY, job, publisherId); }

  async function prepareFullSync(publisherId, generation) {
    const [packages, revenueRaw] = await Promise.all([fetchPackages(), apiJson(API.revenue)]);
    if (!ownsWorkspace(publisherId, generation)) return;
    const revenue = normalizeRevenue(revenueRaw, publisherId); await putMany(revenue, publisherId);
    if (!ownsWorkspace(publisherId, generation)) return;
    const start = earliestAccountDate(packages, revenue), endInclusive = latestCompleteDailyDate(), months = monthSequence(start, new Date().toISOString().slice(0, 10));
    const scopes = [{ id: null, name: "All assets" }, ...packages];
    const chunksPerScope = Math.max(1, Math.ceil((new Date(`${addDays(endInclusive, 1)}T00:00:00Z`) - new Date(`${start}T00:00:00Z`)) / 86400000 / DAILY_API_WINDOW_DAYS));
    syncJob = { publisherId, active: true, phase: "months", startedAt: new Date().toISOString(), packages, start, endExclusive: addDays(endInclusive, 1), months, monthIndex: 0,
      scopes, scopeIndex: 0, cursor: start, completed: 1, total: 1 + months.length * 2 + scopes.length * chunksPerScope, label: "Getting your history ready" };
    await saveJob(syncJob, publisherId); render();
    void cacheDiscoveredPackageIcons(packages, publisherId, generation);
  }

  async function runFullSync(publisherId = publisherIdentity.id, generation = workspaceGeneration) {
    try {
      if (!ownsWorkspace(publisherId, generation)) return;
      if (!syncJob?.active || !syncJob.phase || syncJob.phase === "preparing") await prepareFullSync(publisherId, generation);
      if (!ownsWorkspace(publisherId, generation)) return;
      const job = syncJob;
      if (job.publisherId !== publisherId) throw new Error("The saved sync does not belong to this publisher.");
      if (job.phase === "months") {
        while (job.active && ownsWorkspace(publisherId, generation) && job.monthIndex < job.months.length) {
          const month = job.months[job.monthIndex]; job.label = `Syncing sales and downloads · ${month}`; render();
          const [salesRaw, downloadsRaw] = await Promise.all([apiJson(API.sales(month)), apiJson(API.downloads(month))]);
          if (!ownsWorkspace(publisherId, generation)) return;
          await putMany([...normalizeSales(salesRaw, month, publisherId), ...normalizeDownloads(downloadsRaw, month, publisherId)], publisherId);
          job.monthIndex += 1; job.completed += 2; await saveJob(job, publisherId); render();
        }
        if (!job.active || !ownsWorkspace(publisherId, generation)) return;
        job.phase = "daily"; await saveJob(job, publisherId);
      }
      if (job.phase === "daily") {
        while (job.active && ownsWorkspace(publisherId, generation) && job.scopeIndex < job.scopes.length) {
          const scope = job.scopes[job.scopeIndex];
          while (job.active && ownsWorkspace(publisherId, generation) && job.cursor < job.endExclusive) {
            const chunkEnd = [addDays(job.cursor, DAILY_API_WINDOW_DAYS), job.endExclusive].sort()[0];
            job.label = `Syncing daily performance · ${scope.name} · ${job.cursor}–${addDays(chunkEnd, -1)}`; render();
            let raw;
            try { raw = await apiJson(API.daily, { method: "POST", body: { start_date: apiTimestamp(job.cursor), end_date: apiTimestamp(chunkEnd), package_ids: scope.id ? [scope.id] : [] } }); }
            catch (error) { error.message += ` Range ${job.cursor}–${addDays(chunkEnd, -1)}, scope ${scope.name}.`; throw error; }
            if (!ownsWorkspace(publisherId, generation)) return;
            await putMany(normalizeDaily(raw, scope, publisherId), publisherId);
            job.cursor = chunkEnd; job.completed += 1; await saveJob(job, publisherId); render(); await sleep(120);
          }
          if (!ownsWorkspace(publisherId, generation)) return;
          job.scopeIndex += 1; job.cursor = job.start; await saveJob(job, publisherId);
        }
      }
      if (job.active && ownsWorkspace(publisherId, generation)) {
        const completedAt = new Date().toISOString();
        job.active = false; job.phase = "complete"; job.finishedAt = completedAt; job.lastRefreshedAt = completedAt; job.label = "Your history is up to date";
        await saveJob(job, publisherId); records = await getAll(publisherId); render(); toast("Your complete publisher history is ready.");
      }
    } catch (error) {
      if (!ownsWorkspace(publisherId, generation)) return;
      console.error("Publisher Analytics+ sync failed:", error);
      if (syncJob?.phase === "complete") {
        workspaceStage = "local-data";
        publisherIdentityState = "error";
        workspaceFailure = { stage: workspaceStage, ...failureDetails(error) };
        recordDiagnostic({ kind: "workspace", ...workspaceFailure });
        render();
        return;
      }
      const failure = { stage: "sync", ...failureDetails(error), events: diagnosticEvents.slice(-12) };
      recordDiagnostic({ kind: "sync", ...failureDetails(error) });
      syncJob = { ...(syncJob || {}), publisherId, active: false, error: error.message, failure, label: "Sync couldn't be completed" };
      try { await saveJob(syncJob, publisherId); }
      catch (saveError) { recordDiagnostic({ kind: "checkpoint", ...failureDetails(saveError) }); }
      render(); toast("We couldn't finish syncing your history. Download a support report if this happens again.", "error");
    }
  }

  async function continueFullSync() {
    if (!syncJob || syncJob.active || !["months", "daily"].includes(syncJob.phase)) return;
    const publisherId = publisherIdentity.id, generation = workspaceGeneration;
    if (syncJob.publisherId !== publisherId) return;
    syncJob.active = true;
    syncJob.error = "";
    syncJob.failure = null;
    syncJob.label = "Resuming your history";
    try { await saveJob(syncJob, publisherId); }
    catch (error) {
      syncJob.active = false;
      syncJob.error = error.message;
      recordDiagnostic({ kind: "checkpoint", ...failureDetails(error) });
      render();
      return;
    }
    if (!ownsWorkspace(publisherId, generation)) return;
    render();
    await runFullSync(publisherId, generation);
  }

  async function startFullSync() {
    let identity;
    try { identity = await fetchPublisherIdentity(true); }
    catch (error) {
      recordDiagnostic({ kind: "full-sync-identity", ...failureDetails(error) });
      console.warn("Publisher Analytics+ could not verify the publisher before full sync:", error.message);
      toast("We couldn't confirm your publisher. We did not change your saved analytics. Please try again.", "error");
      return;
    }
    if (identity.id !== publisherIdentity.id) await activatePublisher(identity, { resume: false });
    else publisherIdentity = identity;
    const publisherId = identity.id, generation = workspaceGeneration;
    if (!ownsWorkspace(publisherId, generation)) return;
    syncJob = { publisherId, active: true, phase: "preparing", startedAt: new Date().toISOString(), completed: 0, total: 0, label: "Preparing your history" };
    isOpen = true;
    render();
    try {
      await clearPublisherData(publisherId);
      if (!ownsWorkspace(publisherId, generation)) return;
      records = [];
      syncJob = { publisherId, active: true, phase: "preparing", startedAt: new Date().toISOString(), completed: 0, total: 0, label: "Preparing your history" };
      render();
      await runFullSync(publisherId, generation);
    } catch (error) {
      if (!ownsWorkspace(publisherId, generation)) return;
      syncJob.active = false;
      syncJob.error = error.message;
      syncJob.failure = { stage: "sync-start", ...failureDetails(error) };
      recordDiagnostic({ kind: "sync-start", ...failureDetails(error) });
      render();
    }
  }

  async function incrementalSync(announce = false, publisherId = publisherIdentity.id, generation = workspaceGeneration) {
    if (syncJob?.active || ["preparing", "months", "daily"].includes(syncJob?.phase) || isRefreshing || !records.length) return;
    isRefreshing = true; render();
    let notice = "", noticeType = "success";
    try {
      const packages = await fetchPackages(), currentMonth = new Date().toISOString().slice(0, 7);
      if (ownsWorkspace(publisherId, generation)) void cacheDiscoveredPackageIcons(packages, publisherId, generation);
      const [salesRaw, downloadsRaw, revenueRaw] = await Promise.all([apiJson(API.sales(currentMonth)), apiJson(API.downloads(currentMonth)), apiJson(API.revenue)]);
      if (!ownsWorkspace(publisherId, generation)) return;
      await putMany([...normalizeSales(salesRaw, currentMonth, publisherId), ...normalizeDownloads(downloadsRaw, currentMonth, publisherId), ...normalizeRevenue(revenueRaw, publisherId)], publisherId);
      const scopes = [{ id: null, name: "All assets" }, ...packages];
      for (const scope of scopes) {
        if (!ownsWorkspace(publisherId, generation)) return;
        const endExclusive = addDays(latestCompleteDailyDate(), 1);
        for (const range of incrementalDailyRanges(scope, records, endExclusive)) {
          if (!ownsWorkspace(publisherId, generation)) return;
          const raw = await apiJson(API.daily, { method: "POST", body: { start_date: apiTimestamp(range.start), end_date: apiTimestamp(range.endExclusive), package_ids: scope.id ? [scope.id] : [] } });
          if (!ownsWorkspace(publisherId, generation)) return;
          await putMany(normalizeDaily(raw, scope, publisherId), publisherId);
        }
      }
      if (!ownsWorkspace(publisherId, generation)) return;
      records = await getAll(publisherId);
      syncJob = { ...(syncJob || {}), publisherId, packages, active: false, phase: "complete", error: "", label: "Your history is up to date", lastRefreshedAt: new Date().toISOString() };
      await saveJob(syncJob, publisherId);
      if (announce) notice = "Your publisher data has been refreshed.";
    } catch (error) {
      if (!ownsWorkspace(publisherId, generation)) return;
      console.warn("Publisher Analytics+ incremental API sync failed:", error.message);
      recordDiagnostic({ kind: "refresh", ...failureDetails(error) });
      if (announce) { notice = "We couldn't refresh your publisher data. Please try again."; noticeType = "error"; }
    } finally { if (ownsWorkspace(publisherId, generation)) { isRefreshing = false; render(); if (notice) toast(notice, noticeType); } }
  }
