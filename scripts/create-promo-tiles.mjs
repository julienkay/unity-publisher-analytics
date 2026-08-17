import { readFile, mkdir } from "node:fs/promises";
import { join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = normalize(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const output = join(root, "marketing", "promos");
const backgroundPath = process.argv[2] || join(root, "scripts", "marketing-assets", "promo-background.png");
const dashboardPath = join(root, "marketing", "screenshots", "01-dashboard.png");
const iconPath = join(root, "icons", "publisher-analytics-128.png");
await mkdir(output, { recursive: true });

const [dashboard, icon] = await Promise.all([readFile(dashboardPath), readFile(iconPath)]);
const dashboardData = `data:image/png;base64,${dashboard.toString("base64")}`;
const iconData = `data:image/png;base64,${icon.toString("base64")}`;
const font = "Inter,Segoe UI,Arial,sans-serif";

const render = async ({ name, width, height, svg }) => {
  const scale = 2;
  const source = await sharp(backgroundPath)
    .resize(width * scale, height * scale, { fit: "cover", position: "center" })
    .modulate({ brightness: .8, saturation: .94 })
    .toBuffer();
  const overlay = await sharp(Buffer.from(svg(scale)))
    .resize(width * scale, height * scale, { fit: "fill" })
    .png()
    .toBuffer();
  const composed = await sharp({ create: { width: width * scale, height: height * scale, channels: 3, background: "#111522" } })
    .composite([{ input: source, top: 0, left: 0 }, { input: overlay, top: 0, left: 0 }])
    .png()
    .toBuffer();
  await sharp(composed)
    .flatten({ background: "#111522" })
    .removeAlpha()
    .resize(width, height, { kernel: sharp.kernel.lanczos3 })
    .png({ palette: false, compressionLevel: 9 })
    .toFile(join(output, name));
};

await render({
  name: "small-promo-440x280.png",
  width: 440,
  height: 280,
  svg: s => `<svg width="${440*s}" height="${280*s}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#0d1120" stop-opacity=".98"/><stop offset=".72" stop-color="#0d1120" stop-opacity=".46"/><stop offset="1" stop-color="#0d1120" stop-opacity=".08"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#shade)"/>
    <image href="${iconData}" x="${28*s}" y="${28*s}" width="${58*s}" height="${58*s}"/>
    <text x="${101*s}" y="${53*s}" fill="#fff" font-family="${font}" font-size="${22*s}" font-weight="750">Publisher Analytics+</text>
    <text x="${101*s}" y="${76*s}" fill="#aab2c8" font-family="${font}" font-size="${12*s}" font-weight="500">Asset Store Insights</text>
    <text x="${28*s}" y="${144*s}" fill="#fff" font-family="${font}" font-size="${33*s}" font-weight="780" letter-spacing="${-.8*s}">Beyond the</text>
    <text x="${28*s}" y="${179*s}" fill="#fff" font-family="${font}" font-size="${33*s}" font-weight="780" letter-spacing="${-.8*s}">one-year window.</text>
    <text x="${29*s}" y="${216*s}" fill="#c9cde0" font-family="${font}" font-size="${13*s}">Lifetime trends. Package clarity. Your data stays local.</text>
    <rect x="${28*s}" y="${239*s}" width="${126*s}" height="${3*s}" rx="${1.5*s}" fill="#6c5ce7"/><rect x="${158*s}" y="${239*s}" width="${58*s}" height="${3*s}" rx="${1.5*s}" fill="#21a7bd"/><rect x="${220*s}" y="${239*s}" width="${30*s}" height="${3*s}" rx="${1.5*s}" fill="#d99721"/>
  </svg>`
});

await render({
  name: "marquee-promo-1400x560.png",
  width: 1400,
  height: 560,
  svg: s => `<svg width="${1400*s}" height="${560*s}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="shade" x1="0" x2="1"><stop offset="0" stop-color="#0c1020" stop-opacity=".99"/><stop offset=".54" stop-color="#0c1020" stop-opacity=".82"/><stop offset="1" stop-color="#0c1020" stop-opacity=".18"/></linearGradient>
      <filter id="shadow"><feDropShadow dx="0" dy="${16*s}" stdDeviation="${18*s}" flood-color="#03050c" flood-opacity=".58"/></filter>
      <clipPath id="screen"><rect x="${760*s}" y="${72*s}" width="${590*s}" height="${416*s}" rx="${20*s}"/></clipPath>
    </defs>
    <rect width="100%" height="100%" fill="url(#shade)"/>
    <circle cx="${89*s}" cy="${76*s}" r="${39*s}" fill="#17273a" opacity=".96"/>
    <image href="${iconData}" x="${50*s}" y="${37*s}" width="${78*s}" height="${78*s}"/>
    <text x="${151*s}" y="${69*s}" fill="#fff" font-family="${font}" font-size="${29*s}" font-weight="760">Publisher Analytics+</text>
    <text x="${152*s}" y="${96*s}" fill="#aab2c8" font-family="${font}" font-size="${15*s}">Asset Store Insights</text>
    <text x="${51*s}" y="${198*s}" fill="#fff" font-family="${font}" font-size="${58*s}" font-weight="790" letter-spacing="${-1.5*s}">See the full story</text>
    <text x="${51*s}" y="${259*s}" fill="#fff" font-family="${font}" font-size="${58*s}" font-weight="790" letter-spacing="${-1.5*s}">behind your assets.</text>
    <text x="${53*s}" y="${307*s}" fill="#c8cde0" font-family="${font}" font-size="${20*s}">Flexible, lifetime analytics for Unity Asset Store publishers.</text>
    <g font-family="${font}" font-size="${15*s}" font-weight="650" fill="#eef0fa">
      <rect x="${52*s}" y="${354*s}" width="${150*s}" height="${42*s}" rx="${21*s}" fill="#282440" stroke="#7466ef"/><text x="${76*s}" y="${381*s}">Lifetime history</text>
      <rect x="${215*s}" y="${354*s}" width="${158*s}" height="${42*s}" rx="${21*s}" fill="#182f3a" stroke="#2db4c8"/><text x="${239*s}" y="${381*s}">Package insights</text>
      <rect x="${386*s}" y="${354*s}" width="${147*s}" height="${42*s}" rx="${21*s}" fill="#332a1b" stroke="#dfa126"/><text x="${410*s}" y="${381*s}">Local &amp; private</text>
    </g>
    <text x="${53*s}" y="${472*s}" fill="#8f97af" font-family="${font}" font-size="${14*s}" font-weight="600" letter-spacing="${1.8*s}">REVENUE · CONVERSION · DOWNLOADS · SEASONALITY</text>
    <rect x="${748*s}" y="${60*s}" width="${614*s}" height="${440*s}" rx="${28*s}" fill="#fff" opacity=".12" filter="url(#shadow)"/>
    <image href="${dashboardData}" x="${760*s}" y="${72*s}" width="${590*s}" height="${416*s}" preserveAspectRatio="xMidYMid slice" clip-path="url(#screen)"/>
    <rect x="${760*s}" y="${72*s}" width="${590*s}" height="${416*s}" rx="${20*s}" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="${2*s}"/>
  </svg>`
});

for (const file of ["small-promo-440x280.png", "marquee-promo-1400x560.png"]) {
  const metadata = await sharp(join(output, file)).metadata();
  console.log(`${file} ${metadata.width}x${metadata.height} ${metadata.channels} channels ${metadata.hasAlpha ? "alpha" : "opaque"}`);
}
