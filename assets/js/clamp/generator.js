// generator.js
// Exporte une fonction generateCSS(rows, options)
// rows: [{slug: 'text-m', min: 16, max: 18}, ...]
// options: {minViewport:360, maxViewport:1280, rootFontPx:16}

function toNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function pxToRem(px, root = 16) {
  return px / root
}

function formatNumber(n, decimals) {
  if (!Number.isFinite(n)) return "0"
  // Round to the requested decimals, then remove unnecessary trailing zeros
  // while keeping at least one digit (e.g. 0.5 -> "0.5", 1.000 -> "1").
  const rounded = Number(n.toFixed(decimals))
  return String(rounded)
}

export function generateCSS(rows, options = {}) {
  const minViewport = Number(options.minViewport ?? 360)
  const maxViewport = Number(options.maxViewport ?? 1280)
  const rootFont = Number(options.rootFontPx ?? 16)

  // base variables (min/max static in rem)
  const baseVars = []
  const tokens = []

  rows.forEach((r) => {
    const slugRaw = String(r.slug ?? "").trim()
    if (!slugRaw) return
    const slug = slugRaw.toLowerCase()
    const minPx = toNumber(r.min)
    const maxPx = toNumber(r.max)
    if (!Number.isFinite(minPx) || !Number.isFinite(maxPx)) return

    const minRem = pxToRem(minPx, rootFont)
    const maxRem = pxToRem(maxPx, rootFont)

    // base variable names: use prefix before first '-' or whole slug
    let baseName = slug.includes("-") ? slug.split("-")[0] : slug
    // normalize gap -> spacing to avoid duplicate gap/spacing families
    if (baseName === "gap") baseName = "spacing"
    const minVarName = `--${baseName}-${Math.round(minPx)}`
    const maxVarName = `--${baseName}-${Math.round(maxPx)}`

    const minRemStr = formatNumber(minRem, 3)
    const maxRemStr = formatNumber(maxRem, 3)

    baseVars.push({ name: minVarName, value: `${minRemStr}rem` })
    baseVars.push({ name: maxVarName, value: `${maxRemStr}rem` })

    // slope in px per vw (% of viewport)
    const slopePxPerVw = ((maxPx - minPx) / (maxViewport - minViewport)) * 100

    // intercept: compute in px first, then convert to rem for the rem part
    const interceptPx = minPx - slopePxPerVw * (minViewport / 100)
    const interceptRem = interceptPx / rootFont

    const isFluid = minPx !== maxPx

    tokens.push({
      slug,
      minVarName,
      maxVarName,
      isFluid,
      minPx,
      maxPx,
      minRem,
      maxRem,
      slopePxPerVw,
      interceptRem,
    })
  })

  // helper to sort by numeric suffix
  const sortBySuffix = (arr) => {
    const re = /--[a-z0-9\-]+-(\d+)/i
    return arr.sort((a, b) => {
      const ma = a.name.match(re)
      const mb = b.name.match(re)
      const na = ma ? Number(ma[1]) : 0
      const nb = mb ? Number(mb[1]) : 0
      return na - nb || a.name.localeCompare(b.name)
    })
  }

  // categorize tokens: fonts, spacings, others
  const fontTokens = tokens.filter((t) => /^text(?:-|$)/i.test(t.slug))
  const spacingTokens = tokens.filter((t) =>
    /^(?:spacing|gap)(?:-|$)/i.test(t.slug),
  )
  const otherTokens = tokens.filter(
    (t) =>
      !/^text(?:-|$)/i.test(t.slug) && !/^(?:spacing|gap)(?:-|$)/i.test(t.slug),
  )

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
  ]

  const orderTokens = (arr) =>
    arr.sort((a, b) => {
      const sizeA = String(a.slug).split("-").pop()
      const sizeB = String(b.slug).split("-").pop()
      const ia = sizeOrder.indexOf(sizeA)
      const ib = sizeOrder.indexOf(sizeB)
      if (ia !== -1 || ib !== -1) {
        if (ia === -1) return 1
        if (ib === -1) return -1
        if (ia !== ib) return ia - ib
      }
      return a.slug.localeCompare(b.slug)
    })

  orderTokens(fontTokens)
  orderTokens(spacingTokens)
  orderTokens(otherTokens)

  // Function to build token CSS line
  const buildTokenLine = (t) => {
    if (!t.isFluid) {
      return `  --${t.slug}: var(${t.minVarName});`
    } else {
      const interceptRemStr = formatNumber(t.interceptRem, 3)
      const slopeVwStr = formatNumber(t.slopePxPerVw, 4)
      const parts = []
      if (Number(interceptRemStr) !== 0) parts.push(`${interceptRemStr}rem`)
      if (Number(slopeVwStr) !== 0) parts.push(`${slopeVwStr}vw`)
      const middle = parts.length ? parts.join(" + ") : "0rem"
      return `  --${t.slug}: clamp(var(${t.minVarName}), ${middle}, var(${t.maxVarName}));`
    }
  }

  // Get unique primitives
  const getUniquePrimitives = (names) => {
    const seen = new Set()
    return sortBySuffix(
      baseVars.filter((v) => {
        const isMatch = names.some((n) => v.name.includes(`--${n}-`))
        if (!isMatch) return false
        if (seen.has(v.name)) return false
        seen.add(v.name)
        return true
      }),
    ).map((v) => `  ${v.name}: ${v.value};`)
  }

  let css = ":root {\n"

  // 1. Typographie Primitives
  css += "  /* Typographie Primitives du projet */\n"
  const fontPrimitives = getUniquePrimitives(["text"])
  if (fontPrimitives.length) css += fontPrimitives.join("\n") + "\n"

  // 2. Typographie Tokens
  css += "\n  /* Typographie Tokens du projet */\n"
  if (fontTokens.length) css += fontTokens.map(buildTokenLine).join("\n") + "\n"

  // 3. Espacements Primitives
  css += "\n  /* Espacements Primitives du projet */\n"
  const spacingPrimitives = getUniquePrimitives(["spacing", "gap"])
  if (spacingPrimitives.length) css += spacingPrimitives.join("\n") + "\n"

  // 4. Espacements Tokens
  css += "\n  /* Espacements Tokens du projet */\n"
  if (spacingTokens.length)
    css += spacingTokens.map(buildTokenLine).join("\n") + "\n"

  // Handle others
  if (otherTokens.length) {
    css += "\n  /* Autres Primitives */\n"
    const otherPrimitives = sortBySuffix(
      baseVars.filter((v) => {
        return (
          !v.name.includes("--text-") &&
          !v.name.includes("--spacing-") &&
          !v.name.includes("--gap-")
        )
      }),
    ).map((v) => `  ${v.name}: ${v.value};`)
    if (otherPrimitives.length) css += otherPrimitives.join("\n") + "\n"

    css += "\n  /* Autres Tokens */\n"
    css += otherTokens.map(buildTokenLine).join("\n") + "\n"
  }

  css += "}\n"

  return { themeCss: css, tokensCss: "" }
}
