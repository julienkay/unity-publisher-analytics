(() => {
  const publisherId = "daily-patterns-prototype";
  const adjectives = ["Aurora", "Cobalt", "Ember", "Lunar", "Nimbus"];
  const products = [
    ["Environment Kit", "3D Environments"],
    ["Character Motion Pack", "Animation"],
    ["Editor Toolkit", "Tools"],
    ["Shader Collection", "VFX"],
    ["Interface Icons", "2D"],
    ["Adventure Audio", "Audio"]
  ];
  const packages = adjectives.flatMap((adjective, adjectiveIndex) => products.map(([product, category], productIndex) => {
    const index = adjectiveIndex * products.length + productIndex;
    return {
    id: `asset-${index + 1}`,
    name: `${adjective} ${product}`,
    category,
    price: 12 + productIndex * 7 + adjectiveIndex * 3,
    weight: 2.8 / Math.pow(index + 2, 1.05) + .04,
    launchOffset: index * 11
  }; }));
  const records = [], capturedAt = "2026-08-15T09:30:00.000Z";
  const add = row => records.push({ ...row, publisherId, id: `prototype-${records.length + 1}`, source: "daily-patterns-prototype", capturedAt });
  const iso = date => date.toISOString().slice(0, 10);
  const random = (number, salt = 0) => {
    const value = Math.sin((number + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };
  const gaussian = (number, salt) => {
    const first = Math.max(.00001, random(number, salt)), second = random(number, salt + 1);
    return Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
  };
  const start = new Date("2022-01-01T00:00:00Z"), end = new Date("2026-08-15T00:00:00Z");
  const weekdayFactors = [.67, 1.1, 1.17, 1.06, 1.19, 1.09, .73];
  const promotionDays = Array(packages.length).fill(0), promotionLifts = Array(packages.length).fill(1);
  const activityStates = Array(packages.length).fill(false), noiseStates = Array(packages.length).fill(0);
  let campaignDays = 0, campaignLift = 1;
  for (let cursor = new Date(start), day = 0; cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1), day += 1) {
    const date = iso(cursor), month = cursor.getUTCMonth(), weekday = cursor.getUTCDay();
    const campaignSeason = month === 2 || month === 3 || month === 10 || month === 11;
    if (campaignDays > 0) campaignDays -= 1;
    else if (random(day, 201) < (campaignSeason ? .025 : .006)) {
      campaignDays = 4 + Math.floor(random(day, 202) * 12);
      campaignLift = 1.5 + random(day, 203) * 2.8;
    }
    const catalogLift = campaignDays > 0 ? campaignLift : .82 + random(day, 204) * .36;
    let total = { sales: 0, salesQty: 0, paidQty: 0, freeQty: 0, pageViews: 0, downloads: 0, wishlisted: 0, refunds: 0 };
    packages.forEach((asset, index) => {
      if (day < asset.launchOffset) return;
      const age = day - asset.launchOffset;
      if (promotionDays[index] > 0) promotionDays[index] -= 1;
      else if (random(day, index + 301) < .0045) {
        promotionDays[index] = 3 + Math.floor(random(day, index + 302) * 9);
        promotionLifts[index] = 1.8 + random(day, index + 303) * 3.8;
      }
      const promotionLift = promotionDays[index] > 0 ? promotionLifts[index] : 1;
      const season = 1 + Math.sin(day / 83 + index * .41) * .13;
      const maturity = Math.min(1.08, .72 + age / 1800), launchLift = 1 + 2.8 * Math.exp(-age / 34);
      const activeChance = Math.min(.92, .56 + Math.sqrt(asset.weight) * .22 + (promotionDays[index] > 0 ? .05 : 0));
      const stayActiveChance = promotionDays[index] > 0 ? .91 : .74;
      const startActiveChance = Math.min(.9, activeChance * (1 - stayActiveChance) / Math.max(.08, 1 - activeChance));
      activityStates[index] = activityStates[index]
        ? random(day, index + 401) < stayActiveChance
        : random(day, index + 402) < startActiveChance;
      noiseStates[index] = noiseStates[index] * .45 + gaussian(day, index * 7 + 501) * .73;
      const hasViews = activityStates[index], noise = Math.min(9, Math.exp(noiseStates[index]));
      const pageViews = hasViews ? Math.max(1, Math.round((4 + 42 * asset.weight) * weekdayFactors[weekday] * season * maturity * launchLift * catalogLift * promotionLift * noise)) : 0;
      const saleChance = 1 - Math.exp(-pageViews * (campaignDays > 0 ? .016 : .008));
      const sold = random(day, index + 601) < saleChance;
      const paidQty = sold ? Math.max(1, Math.round(1 + random(day, index + 602) * Math.min(4, pageViews / 24))) : 0;
      const freeQty = index % 11 === 4 && pageViews > 0 && random(day, index + 603) < .13 ? Math.max(1, Math.round(1 + random(day, index + 604) * 3)) : 0;
      const salesQty = paidQty + freeQty;
      const downloads = random(day, index + 605) < .72 ? Math.max(0, Math.round((.8 + 4.2 * asset.weight) * Math.exp(gaussian(day, index + 606) * .48))) : 0;
      const sales = paidQty * asset.price;
      const wishlistRoll = random(day, index + 607);
      const row = { type: "daily", date, period: date.slice(0, 7), scope: "package", packageId: asset.id, package: asset.name, category: asset.category, sales, salesQty, paidQty, freeQty, pageViews, conversionRate: pageViews ? salesQty / pageViews * 100 : 0, downloads, wishlisted: wishlistRoll < .045 ? 1 : wishlistRoll > .992 ? -1 : 0, refunds: 0, currency: "USD" };
      add(row);
      for (const key of Object.keys(total)) total[key] += row[key] || 0;
    });
    add({ type: "daily", date, period: date.slice(0, 7), scope: "all", packageId: "", package: "All assets", category: "", ...total, conversionRate: total.pageViews ? total.salesQty / total.pageViews * 100 : 0, currency: "USD" });
  }
  window.__UPA_DAILY_PATTERNS_FIXTURE__ = { publisherId, publisherName: "Atlas Forge Studio", records, packages, capturedAt };
})();
