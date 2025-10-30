// generator.js
// Exporte une fonction generateCSS(rows, options)
// rows: [{slug: 'text-m', min: 16, max: 18}, ...]
// options: {minViewport:360, maxViewport:1280, rootFontPx:16}

function toNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function pxToRem(px, root = 16) {
  return px / root;
}

function formatNumber(n, decimals) {
  if (!Number.isFinite(n)) return "0";
  // Round to the requested decimals, then remove unnecessary trailing zeros
  // while keeping at least one digit (e.g. 0.5 -> "0.5", 1.000 -> "1").
  const rounded = Number(n.toFixed(decimals));
  return String(rounded);
}

export function generateCSS(rows, options = {}) {
  const minViewport = Number(options.minViewport ?? 360);
  const maxViewport = Number(options.maxViewport ?? 1280);
  const rootFont = Number(options.rootFontPx ?? 16);

  // header for theme.css
  let themeCss = ":root {\n";

  // base variables (min/max static in rem)
  const baseVars = [];
  const tokens = [];

  rows.forEach((r) => {
    const slugRaw = String(r.slug ?? "").trim();
    if (!slugRaw) return;
    const slug = slugRaw.toLowerCase();
    const minPx = toNumber(r.min);
    const maxPx = toNumber(r.max);
    if (!Number.isFinite(minPx) || !Number.isFinite(maxPx)) return;

    const minRem = pxToRem(minPx, rootFont);
    const maxRem = pxToRem(maxPx, rootFont);

    // base variable names: use prefix before first '-' or whole slug
    let baseName = slug.includes("-") ? slug.split("-")[0] : slug;
    // normalize gap -> spacing to avoid duplicate gap/spacing families
    if (baseName === "gap") baseName = "spacing";
    const minVarName = `--${baseName}-${Math.round(minPx)}`;
    const maxVarName = `--${baseName}-${Math.round(maxPx)}`;

    const minRemStr = formatNumber(minRem, 3);
    const maxRemStr = formatNumber(maxRem, 3);

    baseVars.push(`  ${minVarName}: ${minRemStr}rem;`);
    baseVars.push(`  ${maxVarName}: ${maxRemStr}rem;`);

    // slope in px per vw (% of viewport)
    const slopePxPerVw = ((maxPx - minPx) / (maxViewport - minViewport)) * 100; // px per vw

    // intercept: compute in px first, then convert to rem for the rem part
    const interceptPx = minPx - slopePxPerVw * (minViewport / 100);
    const interceptRem = interceptPx / rootFont;

    // produce expression without calc(): we'll format differently for fonts vs spacings later
    const middleExpr = null; // placeholder; compute per-token when building tokensCss
    const isFluid = minPx !== maxPx;

    tokens.push({
      slug,
      minVarName,
      maxVarName,
      middleExpr,
      isFluid,
      minPx,
      maxPx,
      minRem,
      maxRem,
      slopePxPerVw,
      interceptRem,
    });
  });

  // deduplicate baseVars lines (in case of multiple rows sharing same numeric values)
  const uniqueBaseVars = Array.from(new Set(baseVars));

  // helper to sort by numeric suffix
  const sortBySuffix = (arr) => {
    const re = /--[a-z0-9\-]+-(\d+)/i;
    return arr.sort((a, b) => {
      const ma = a.match(re);
      const mb = b.match(re);
      const na = ma ? Number(ma[1]) : 0;
      const nb = mb ? Number(mb[1]) : 0;
      return na - nb || a.localeCompare(b);
    });
  };

  // group base vars: fonts (text-), spacings (spacing-|gap-), others
  const fontBase = uniqueBaseVars.filter((s) => /--text-/i.test(s));
  const spacingBase = uniqueBaseVars.filter((s) => /--(spacing|gap)-/i.test(s));
  const otherBase = uniqueBaseVars.filter(
    (s) => !/--text-/i.test(s) && !/--(spacing|gap)-/i.test(s)
  );

  // sort each group by numeric suffix
  sortBySuffix(fontBase);
  sortBySuffix(spacingBase);
  sortBySuffix(otherBase);

  themeCss += "  /* Tailles de police */\n";
  if (fontBase.length) themeCss += fontBase.join("\n") + "\n\n";
  themeCss += "  /* Espacements */\n";
  if (spacingBase.length) themeCss += spacingBase.join("\n") + "\n";
  if (otherBase.length) themeCss += "\n" + otherBase.join("\n") + "\n";
  // end themeCss with a single newline (avoid extra blank line at EOF)
  themeCss += "}\n";

  // theme-tokens
  let tokensCss = ":root {\n";

  // categorize tokens: fonts, spacings, others
  const fontTokens = tokens.filter((t) => /^text(?:-|$)/i.test(t.slug));
  const spacingTokens = tokens.filter((t) =>
    /^(?:spacing|gap)(?:-|$)/i.test(t.slug)
  );
  const otherTokens = tokens.filter(
    (t) =>
      !/^text(?:-|$)/i.test(t.slug) && !/^(?:spacing|gap)(?:-|$)/i.test(t.slug)
  );

  // keep previous token ordering inside groups
  const sizeOrder = [
    "xxs",
    "xs",
    "s",
    "m",
    "l",
    "xl",
    "2xl",
    "3xl",
    "4xl",
    "5xl",
  ];

  const orderTokens = (arr) =>
    arr.sort((a, b) => {
      const sizeA = String(a.slug).split("-").pop();
      const sizeB = String(b.slug).split("-").pop();
      const ia = sizeOrder.indexOf(sizeA);
      const ib = sizeOrder.indexOf(sizeB);
      if (ia !== -1 || ib !== -1) {
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        if (ia !== ib) return ia - ib;
      }
      return a.slug.localeCompare(b.slug);
    });

  orderTokens(fontTokens);
  orderTokens(spacingTokens);
  orderTokens(otherTokens);

  // build tokensCss with sections
  tokensCss += "  /* Tailles de police */\n";
  fontTokens.forEach((t) => {
    if (!t.isFluid) {
      tokensCss += `  --${t.slug}: var(${t.minVarName});\n`;
    } else {
      // compute middle expression from stored intercept and slope
      const interceptRemStr = formatNumber(t.interceptRem, 3);
      const slopeVwStr = formatNumber(t.slopePxPerVw, 4);
      // clean zero terms: omit parts that are zero to avoid "+ 0.0000vw"
      const parts = [];
      if (Number(interceptRemStr) !== 0) parts.push(`${interceptRemStr}rem`);
      if (Number(slopeVwStr) !== 0) parts.push(`${slopeVwStr}vw`);
      const middleExpr = parts.length ? parts.join(" + ") : "0rem";
      tokensCss += `  --${t.slug}: clamp(var(${t.minVarName}), ${middleExpr}, var(${t.maxVarName}));\n`;
    }
  });
  tokensCss += "\n  /* Espacements */\n";
  spacingTokens.forEach((t) => {
    if (!t.isFluid) {
      tokensCss += `  --${t.slug}: var(${t.minVarName});\n`;
    } else {
      const interceptRemStr = formatNumber(t.interceptRem, 3);
      const slopeVwStr = formatNumber(t.slopePxPerVw, 4);
      const parts = [];
      if (Number(interceptRemStr) !== 0) parts.push(`${interceptRemStr}rem`);
      if (Number(slopeVwStr) !== 0) parts.push(`${slopeVwStr}vw`);
      const middle = parts.length ? parts.join(" + ") : "0rem";
      tokensCss += `  --${t.slug}: clamp(var(${t.minVarName}), ${middle}, var(${t.maxVarName}));\n`;
    }
  });
  if (otherTokens.length) {
    tokensCss += "\n  /* Autres */\n";
    otherTokens.forEach((t) => {
      if (!t.isFluid) {
        tokensCss += `  --${t.slug}: var(${t.minVarName});\n`;
      } else {
        // compute middle similar to fonts/spacings
        const interceptRemStr = formatNumber(t.interceptRem, 3);
        const slopeVwStr = formatNumber(t.slopePxPerVw ?? 0, 4);
        const parts = [];
        if (Number(interceptRemStr) !== 0) parts.push(`${interceptRemStr}rem`);
        if (Number(slopeVwStr) !== 0) parts.push(`${slopeVwStr}vw`);
        const middle = parts.length ? parts.join(" + ") : "0rem";
        tokensCss += `  --${t.slug}: clamp(var(${t.minVarName}), ${middle}, var(${t.maxVarName}));\n`;
      }
    });
  }
  tokensCss += "}\n";

  return { themeCss, tokensCss };
}
