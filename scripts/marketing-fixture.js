(() => {
  const publisherId = "marketing-demo";
  const packages = [
    { id: "aurora", name: "Aurora Environment Kit", category: "3D Environments", price: 54, weight: 1.0 },
    { id: "motion", name: "Motion Pro Controller", category: "Tools", price: 39, weight: 0.76 },
    { id: "shaders", name: "Luminous Shader Library", category: "VFX", price: 29, weight: 0.57 },
    { id: "icons", name: "Essential UI Icons", category: "2D", price: 18, weight: 0.42 },
    { id: "audio", name: "Cinematic Worlds Audio", category: "Audio", price: 24, weight: 0.31 }
  ];
  const records = [];
  const capturedAt = "2026-08-15T09:30:00.000Z";
  const add = row => records.push({ ...row, publisherId, id: `demo-${records.length + 1}`, source: "marketing-fixture", capturedAt });
  const iso = date => date.toISOString().slice(0, 10);
  const wave = (n, phase = 0) => 1 + Math.sin(n * .43 + phase) * .22 + Math.cos(n * .17 + phase) * .11;
  const random = (n, salt = 0) => {
    const value = Math.sin((n + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  let monthIndex = 0;
  for (let year = 2022; year <= 2026; year += 1) {
    const lastMonth = year === 2026 ? 7 : 11;
    for (let month = year === 2022 ? 2 : 0; month <= lastMonth; month += 1) {
      const period = `${year}-${String(month + 1).padStart(2, "0")}`;
      packages.forEach((pkg, index) => {
        const growth = 1 + monthIndex * .018;
        const launch = index === 4 && monthIndex < 20 ? 0 : 1;
        const qty = Math.max(0, Math.round((13 + 7 * wave(monthIndex, index)) * pkg.weight * growth * launch));
        const gross = qty * pkg.price;
        add({ type: "sales", period, date: `${period}-01`, packageId: pkg.id, package: pkg.name, category: pkg.category, price: pkg.price, qty, refunds: Math.round(qty * .018), chargebacks: 0, gross, net: gross * .7, currency: "USD" });
        add({ type: "downloads", period, date: `${period}-01`, packageId: pkg.id, package: pkg.name, category: pkg.category, downloads: Math.round(qty * (2.4 + index * .35)), users: Math.round(qty * (1.7 + index * .24)) });
      });
      monthIndex += 1;
    }
  }

  const start = new Date("2022-03-01T00:00:00Z");
  const end = new Date("2026-08-15T00:00:00Z");
  for (let cursor = new Date(start), day = 0; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1), day += 1) {
    const date = iso(cursor);
    const weekend = [0, 6].includes(cursor.getUTCDay()) ? .72 : 1;
    const season = 1 + Math.sin(day / 58) * .18;
    const month = cursor.getUTCMonth(), dayOfMonth = cursor.getUTCDate();
    const springCampaign = month === 2 && dayOfMonth >= 20 || month === 3 && dayOfMonth <= 12;
    const autumnCampaign = month === 9 || month === 10;
    const activeRevenueDay = random(day, 2) < (springCampaign ? .42 : autumnCampaign ? .17 : .075);
    const eventLift = activeRevenueDay ? 1 + random(day, 3) * (springCampaign ? 5.2 : 2.8) : 0;
    let total = { sales: 0, salesQty: 0, paidQty: 0, freeQty: 0, pageViews: 0, downloads: 0, wishlisted: 0, refunds: 0 };
    packages.forEach((pkg, index) => {
      const active = !(index === 4 && date < "2023-11-01");
      if (!active) return;
      const pulse = Math.max(.25, wave(day / 7, index * .8) * weekend * season * (1 + day / 3200));
      const packageSold = activeRevenueDay && random(day, index + 10) < (.28 + pkg.weight * .34);
      const paidQty = packageSold ? Math.max(1, Math.round((.42 + pkg.weight * .55) * pulse * eventLift)) : 0;
      const freeQty = index === 3 ? Math.round(1.6 * pulse) : 0;
      const salesQty = paidQty + freeQty;
      const pageViews = Math.round((20 + 38 * pkg.weight) * pulse);
      const downloads = Math.round((1.4 + 3.2 * pkg.weight) * pulse);
      const sales = paidQty * pkg.price;
      const row = { type: "daily", date, period: date.slice(0, 7), scope: "package", packageId: pkg.id, package: pkg.name, category: pkg.category, sales, salesQty, paidQty, freeQty, pageViews, conversionRate: pageViews ? salesQty / pageViews * 100 : 0, downloads, wishlisted: Math.round((day + index) % 9 === 0 ? 2 : (day + index) % 17 === 0 ? -1 : 0), refunds: 0, currency: "USD" };
      add(row);
      for (const key of Object.keys(total)) total[key] += row[key] || 0;
    });
    add({ type: "daily", date, period: date.slice(0, 7), scope: "all", packageId: "", package: "All assets", category: "", ...total, conversionRate: total.pageViews ? total.salesQty / total.pageViews * 100 : 0, currency: "USD" });
  }

  for (let index = 0; index < 34; index += 1) {
    const date = new Date(Date.UTC(2023, index % 12, 8 + (index * 5) % 20));
    add({ type: "revenue", date: iso(date), description: index % 4 === 0 ? "Publisher payout" : "Asset Store revenue", debit: index % 4 === 0 ? 2100 + index * 18 : 0, credit: index % 4 === 0 ? 0 : 740 + index * 21, balance: 12840 + index * 310, currency: "USD" });
  }

  window.__UPA_MARKETING_FIXTURE__ = { publisherId, publisherName: "Northstar Studio", records, packages, capturedAt };
})();
