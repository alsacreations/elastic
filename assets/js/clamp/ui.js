// ui.js
// Construction du DOM : lignes du tableau, courbes, aperçu, coloration du code

const SVG_NS = "http://www.w3.org/2000/svg"

// Plage affichée par la règle et les courbes
export const RANGE_MIN = 360
export const RANGE_MAX = 1600

// Seuil d'alerte WCAG 1.4.4 (ratio max / min pour les typographies)
export const WARN_RATIO = 2.5

export function q(sel, ctx = document) {
  return ctx.querySelector(sel)
}
export function qa(sel, ctx = document) {
  return Array.from(ctx.querySelectorAll(sel))
}

export function setStatus(msgEl, text) {
  if (!msgEl) return
  msgEl.textContent = text
}

export function validateSlug(slug) {
  // lettres minuscules, chiffres et tirets
  return /^[a-z0-9-]+$/.test(slug)
}

export function formatNumber(n, decimals = 1) {
  if (!Number.isFinite(n)) return "0"
  return String(Number(n.toFixed(decimals)))
}

/** Valeur (px) d'une variable pour une largeur d'écran donnée */
export function valueAt(row, width, vmin, vmax) {
  const min = Number(row.min)
  const max = Number(row.max)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return NaN
  if (vmax <= vmin) return min
  const t = Math.min(1, Math.max(0, (width - vmin) / (vmax - vmin)))
  return min + (max - min) * t
}

function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name)
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v))
  return el
}

function icon(paths) {
  const svg = svgEl("svg", {
    class: "icon",
    viewBox: "0 0 24 24",
    "aria-hidden": "true",
  })
  paths.forEach((d) => svg.appendChild(svgEl("path", { d })))
  return svg
}

const ICON_WARN = [
  "m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3",
  "M12 9v4",
  "M12 17h.01",
]
const ICON_CLOSE = ["M18 6 6 18", "m6 6 12 12"]

/** Crée une ligne de tableau éditable */
export function createRow(row = { slug: "", min: "", max: "" }) {
  const tr = document.createElement("tr")

  // Nom
  const tdSlug = document.createElement("td")
  const inputSlug = document.createElement("input")
  inputSlug.type = "text"
  inputSlug.className = "input input-slug"
  inputSlug.value = row.slug
  inputSlug.spellcheck = false
  inputSlug.autocomplete = "off"
  inputSlug.setAttribute("aria-label", "Nom de la variable")
  tdSlug.appendChild(inputSlug)

  // Min
  const tdMin = document.createElement("td")
  const inputMin = document.createElement("input")
  inputMin.type = "number"
  inputMin.min = "0"
  inputMin.className = "input input-min"
  inputMin.value = row.min
  tdMin.appendChild(inputMin)

  // Courbe
  const tdCurve = document.createElement("td")
  const curveCell = document.createElement("div")
  curveCell.className = "curve-cell"
  const svg = svgEl("svg", {
    class: "curve",
    viewBox: "0 0 200 40",
    preserveAspectRatio: "none",
    role: "img",
  })
  svg.appendChild(svgEl("polygon", { class: "curve-area" }))
  svg.appendChild(
    svgEl("polyline", {
      class: "curve-line",
      "vector-effect": "non-scaling-stroke",
    }),
  )
  svg.appendChild(
    svgEl("line", {
      class: "curve-marker",
      y1: "0",
      y2: "40",
      "vector-effect": "non-scaling-stroke",
    }),
  )
  const badge = document.createElement("span")
  badge.className = "badge-warn"
  badge.hidden = true
  badge.title = "Écart min/max ≥ ×2,5 : vérifier le zoom à 200 % (WCAG 1.4.4)"
  badge.appendChild(icon(ICON_WARN))
  badge.appendChild(document.createElement("span"))
  curveCell.append(svg, badge)
  tdCurve.appendChild(curveCell)

  // Max
  const tdMax = document.createElement("td")
  const inputMax = document.createElement("input")
  inputMax.type = "number"
  inputMax.min = "0"
  inputMax.className = "input input-max"
  inputMax.value = row.max
  tdMax.appendChild(inputMax)

  // Valeur courante
  const tdCurrent = document.createElement("td")
  tdCurrent.className = "current"
  const strong = document.createElement("strong")
  const unit = document.createTextNode(" px")
  const small = document.createElement("small")
  tdCurrent.append(strong, unit, small)

  // Suppression
  const tdAction = document.createElement("td")
  const btnRemove = document.createElement("button")
  btnRemove.type = "button"
  btnRemove.className = "icon-btn btn-remove"
  btnRemove.appendChild(icon(ICON_CLOSE))
  tdAction.appendChild(btnRemove)

  tr.append(tdSlug, tdMin, tdCurve, tdMax, tdCurrent, tdAction)
  updateRowLabels(tr)
  return tr
}

/** Met à jour les libellés accessibles d'une ligne selon son nom */
export function updateRowLabels(tr) {
  const slug = q(".input-slug", tr).value.trim() || "variable"
  q(".input-min", tr).setAttribute(
    "aria-label",
    `Valeur minimale de ${slug}, en pixels`,
  )
  q(".input-max", tr).setAttribute(
    "aria-label",
    `Valeur maximale de ${slug}, en pixels`,
  )
  q(".btn-remove", tr).setAttribute("aria-label", `Supprimer ${slug}`)
}

/** Lit une ligne du tableau */
export function readRow(tr) {
  return {
    slug: q(".input-slug", tr)?.value?.trim() ?? "",
    min: q(".input-min", tr)?.value ?? "",
    max: q(".input-max", tr)?.value ?? "",
  }
}

/** Met à jour courbe, badge et valeur simulée d'une ligne */
export function updateRowVisual(tr, ctx) {
  const { width, vmin, vmax, root, warn } = ctx
  const row = readRow(tr)
  const min = Number(row.min)
  const max = Number(row.max)
  const valid = row.min !== "" && row.max !== "" && Number.isFinite(min) && Number.isFinite(max)

  const x = (w) =>
    Math.max(0, Math.min(200, ((w - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)) * 200))
  const top = Math.max(min || 0, max || 0, 1)
  const y = (v) => 36 - (v / top) * 30

  const svg = q(".curve", tr)
  const strong = q(".current strong", tr)
  const small = q(".current small", tr)
  const badge = q(".badge-warn", tr)

  if (!valid) {
    svg.style.visibility = "hidden"
    strong.textContent = "–"
    small.textContent = ""
    badge.hidden = true
    return
  }

  const points = `0,${y(min)} ${x(vmin)},${y(min)} ${x(vmax)},${y(max)} 200,${y(max)}`
  svg.style.visibility = ""
  q(".curve-area", svg).setAttribute("points", `${points} 200,40 0,40`)
  q(".curve-line", svg).setAttribute("points", points)
  const marker = q(".curve-marker", svg)
  marker.setAttribute("x1", x(width))
  marker.setAttribute("x2", x(width))
  svg.setAttribute(
    "aria-label",
    `${row.slug} : ${min} px jusqu'à ${vmin} px de large, puis ${max} px dès ${vmax} px`,
  )

  const current = valueAt(row, width, vmin, vmax)
  strong.textContent = formatNumber(current, 1)
  small.textContent = `${formatNumber(current / root, 3)} rem`

  const ratio = min > 0 ? max / min : 0
  const showWarn = warn && ratio >= WARN_RATIO
  badge.hidden = !showWarn
  q("span", badge).textContent = `×${formatNumber(ratio, 1).replace(".", ",")}`
}

/** Aperçu : phrases test (typographie) ou barres (espacements) */
export function renderPreview(container, rows, ctx) {
  const { width, vmin, vmax, kind } = ctx
  container.replaceChildren()
  rows.forEach((row) => {
    const value = valueAt(row, width, vmin, vmax)
    if (!row.slug || !Number.isFinite(value)) return
    const line = document.createElement("div")
    line.className = "preview-row" + (kind === "spacing" ? " is-spacing" : "")

    const label = document.createElement("span")
    label.className = "preview-label"
    label.textContent = `${row.slug} · ${formatNumber(value, 1)}`
    line.appendChild(label)

    if (kind === "spacing") {
      const bar = document.createElement("div")
      bar.className = "preview-bar"
      bar.style.width = `${value}px`
      line.appendChild(bar)
    } else {
      const sample = document.createElement("span")
      sample.className = "preview-sample"
      sample.style.fontSize = `${value}px`
      sample.textContent = "Portez ce vieux whisky au juge blond qui fume"
      line.appendChild(sample)
    }
    container.appendChild(line)
  })
}

/** Coloration simple du CSS généré (construite avec textContent) */
export function renderCode(codeEl, css) {
  codeEl.replaceChildren()
  const lines = css.replace(/\n$/, "").split("\n")
  lines.forEach((line, i) => {
    const frag = document.createDocumentFragment()
    const trimmed = line.trim()
    if (trimmed.startsWith("/*")) {
      frag.appendChild(span("tok-comment", line))
    } else if (trimmed.startsWith("@function")) {
      const m = line.match(/^(@function )(--[\w-]+)(.*)$/)
      if (m) {
        frag.append(span("tok-at", m[1]), span("tok-name", m[2]), m[3])
      } else {
        frag.append(line)
      }
    } else {
      const m = line.match(/^(\s*)(--[\w-]+)(:.*?)(\s*\/\*.*\*\/)?$/)
      if (m) {
        frag.append(m[1], span("tok-name", m[2]), m[3])
        if (m[4]) frag.appendChild(span("tok-comment", m[4]))
      } else {
        frag.append(line)
      }
    }
    if (i < lines.length - 1) frag.append("\n")
    codeEl.appendChild(frag)
  })
  return lines.length
}

function span(cls, text) {
  const s = document.createElement("span")
  s.className = cls
  s.textContent = text
  return s
}
