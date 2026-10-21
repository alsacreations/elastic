import {
  createRow,
  isFormatSupported,
  readRow,
  renderCode,
  renderPreview,
  setStatus,
  updateRowLabels,
  updateRowVisual,
  validateSlug,
  q,
  qa,
  RANGE_MIN,
  RANGE_MAX,
} from "./ui.js"
import { generateCSS } from "./generator.js"

const STORAGE_KEY = "elastic-config"

const DEFAULTS = {
  vw: 768,
  vmin: 360,
  vmax: 1280,
  root: 16,
  format: "clamp",
  text: [
    { slug: "text-s", min: 14, max: 14 },
    { slug: "text-m", min: 16, max: 18 },
    { slug: "text-l", min: 18, max: 20 },
  ],
  spacing: [
    { slug: "spacing-xs", min: 4, max: 4 },
    { slug: "spacing-s", min: 8, max: 16 },
    { slug: "spacing-m", min: 16, max: 32 },
  ],
}

/* ----------------------------------
 * Sauvegarde : URL (partage) + navigateur
 * ---------------------------------- */

/*
 * Format lisible : #t=text-s:14:14,text-m:16:18&s=spacing-xs:4:4
 *   (+ vmin, vmax, root, f uniquement s'ils diffèrent des défauts).
 * La largeur simulée (vw) n'est pas partagée : elle reste locale.
 * Chaque composant est encodé individuellement : « : » et « , »
 * restent des séparateurs fiables même si un slug en contient.
 */

const enc = encodeURIComponent

function encodeRows(rows) {
  return rows.map((r) => [r.slug, r.min, r.max].map(enc).join(":")).join(",")
}

function decodeRows(str) {
  if (!str) return []
  return str.split(",").map((item) => {
    const [slug = "", min = "", max = ""] = item
      .split(":")
      .map(decodeURIComponent)
    return { slug, min, max }
  })
}

function encodeConfig(cfg) {
  const params = [
    ["vmin", cfg.vmin, DEFAULTS.vmin],
    ["vmax", cfg.vmax, DEFAULTS.vmax],
    ["root", cfg.root, DEFAULTS.root],
    ["f", cfg.format, DEFAULTS.format],
  ]
    .filter(([, value, fallback]) => value !== fallback)
    .map(([key, value]) => `${key}=${enc(value)}`)
  return [
    ...params,
    `t=${encodeRows(cfg.text)}`,
    `s=${encodeRows(cfg.spacing)}`,
  ].join("&")
}

function decodeConfig(hash) {
  try {
    const params = Object.fromEntries(
      hash.split("&").map((pair) => {
        const i = pair.indexOf("=")
        return i === -1 ? [pair, ""] : [pair.slice(0, i), pair.slice(i + 1)]
      }),
    )
    if ("c" in params) return decodeLegacyConfig(params.c)
    if (!("t" in params || "s" in params)) return null
    return sanitize({
      vw: decodeURIComponent(params.vw ?? ""),
      vmin: decodeURIComponent(params.vmin ?? ""),
      vmax: decodeURIComponent(params.vmax ?? ""),
      root: decodeURIComponent(params.root ?? ""),
      format: decodeURIComponent(params.f ?? ""),
      text: decodeRows(params.t),
      spacing: decodeRows(params.s),
    })
  } catch {
    return null
  }
}

/* Anciens liens : JSON encodé en base64 (#c=…) */
function decodeLegacyConfig(str) {
  try {
    const b64 = str.replace(/-/g, "+").replace(/_/g, "/")
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    return sanitize(JSON.parse(new TextDecoder().decode(bytes)))
  } catch {
    return null
  }
}

function sanitize(cfg) {
  if (!cfg || typeof cfg !== "object") return null
  const num = (v, d) => (v !== "" && Number.isFinite(Number(v)) ? Number(v) : d)
  const rows = (list, d) =>
    Array.isArray(list)
      ? list
          .filter((r) => r && typeof r.slug === "string")
          .slice(0, 50)
          .map((r) => ({
            slug: r.slug.slice(0, 40),
            min: num(r.min, ""),
            max: num(r.max, ""),
          }))
      : d
  return {
    vw: num(cfg.vw, DEFAULTS.vw),
    vmin: num(cfg.vmin, DEFAULTS.vmin),
    vmax: num(cfg.vmax, DEFAULTS.vmax),
    root: num(cfg.root, DEFAULTS.root),
    format: ["progress", "function"].includes(cfg.format)
      ? cfg.format
      : "clamp",
    text: rows(cfg.text, DEFAULTS.text),
    spacing: rows(cfg.spacing, DEFAULTS.spacing),
  }
}

function loadStored() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return sanitize(JSON.parse(stored))
  } catch {
    /* stockage indisponible : on garde les valeurs par défaut */
  }
  return null
}

function loadConfig() {
  const stored = loadStored()
  const hash = location.hash.slice(1)
  if (hash) {
    const fromUrl = decodeConfig(hash)
    if (fromUrl) {
      /* La largeur simulée n'est pas dans l'URL : on reprend la locale */
      if (stored && !hash.startsWith("c=")) fromUrl.vw = stored.vw
      return fromUrl
    }
  }
  return stored ?? structuredClone(DEFAULTS)
}

function saveConfig(cfg) {
  const encoded = encodeConfig(cfg)
  history.replaceState(null, "", `#${encoded}`)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg))
  } catch {
    /* stockage indisponible */
  }
}

/* ----------------------------------
 * Application
 * ---------------------------------- */

function init() {
  const el = {
    range: q("#vw-range"),
    vwValue: q("#vw-value"),
    vwEchoes: qa(".vw-echo"),
    band: q(".ruler-track"),
    rulerMin: q("#ruler-min"),
    rulerMax: q("#ruler-max"),
    presets: qa(".presets .chip"),
    tabs: qa('[role="tab"]'),
    panels: { text: q("#panel-text"), spacing: q("#panel-spacing") },
    tbodies: {
      text: q("#clamp-table tbody"),
      spacing: q("#spacing-table tbody"),
    },
    counts: { text: q("#count-text"), spacing: q("#count-spacing") },
    note: q("#a11y-note"),
    preview: q("#preview-list"),
    supportNote: q("#support-note"),
    supportFormat: q("#support-format"),
    vmin: q("#opt-vmin"),
    vmax: q("#opt-vmax"),
    root: q("#opt-root"),
    formats: qa("[data-format]"),
    code: q("#css-output-theme"),
    codeLines: q("#code-lines"),
    btnAdd: q("#btn-add"),
    btnCopy: q("#btn-copy-theme"),
    btnShare: q("#btn-share"),
    btnReset: q("#btn-reset"),
    status: q("#clamp-status"),
  }

  let cfg = loadConfig()
  let activeTab = "text"

  /* --- Rendu initial --- */

  function fillTables() {
    ;["text", "spacing"].forEach((kind) => {
      const tbody = el.tbodies[kind]
      tbody.replaceChildren(...cfg[kind].map((row) => createRow(row)))
    })
  }

  function fillSettings() {
    el.range.value = cfg.vw
    el.vmin.value = cfg.vmin
    el.vmax.value = cfg.vmax
    el.root.value = cfg.root
  }

  function readTables() {
    cfg.text = qa("tr", el.tbodies.text).map(readRow)
    cfg.spacing = qa("tr", el.tbodies.spacing).map(readRow)
  }

  /* --- Mise à jour --- */

  function update({ save = true } = {}) {
    readTables()
    const width = Number(cfg.vw)
    const vmin = Number(cfg.vmin)
    const vmax = Number(cfg.vmax)
    const root = Number(cfg.root) > 0 ? Number(cfg.root) : 16

    // Règle
    el.vwValue.textContent = width
    el.vwEchoes.forEach((n) => (n.textContent = width))
    const ratio = (w) =>
      Math.max(0, Math.min(1, (w - RANGE_MIN) / (RANGE_MAX - RANGE_MIN)))
    el.band.style.setProperty("--band-start", ratio(vmin))
    el.band.style.setProperty("--band-end", ratio(vmax))
    el.band.style.setProperty("--min-shift", ratio(vmin) < 0.04 ? "0" : "-50%")
    el.band.style.setProperty(
      "--max-shift",
      ratio(vmax) > 0.92 ? "-100%" : "-50%",
    )
    el.rulerMin.textContent = `${vmin} min`
    el.rulerMax.textContent = `max ${vmax}`
    el.presets.forEach((b) =>
      b.setAttribute("aria-pressed", String(Number(b.dataset.width) === width)),
    )

    // Lignes
    let anyWarn = false
    ;["text", "spacing"].forEach((kind) => {
      qa("tr", el.tbodies[kind]).forEach((tr) => {
        updateRowVisual(tr, { width, vmin, vmax, root, warn: kind === "text" })
        if (kind === "text" && !q(".badge-warn", tr).hidden) anyWarn = true
      })
      el.counts[kind].textContent = cfg[kind].length
    })
    el.note.hidden = !anyWarn

    // Aperçu (non simulé si le navigateur ne comprend pas le format)
    const supported = isFormatSupported(cfg.format)
    el.supportNote.hidden = supported
    el.supportFormat.textContent =
      cfg.format === "function" ? "@function" : `${cfg.format}()`
    renderPreview(el.preview, cfg[activeTab], {
      width,
      vmin,
      vmax,
      kind: activeTab,
      simulate: supported,
    })

    // Format
    el.formats.forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.format === cfg.format)),
    )

    // Code
    const rows = [...cfg.text, ...cfg.spacing]
      .filter((r) => r.slug && r.min !== "" && r.max !== "")
      .map((r) => ({ slug: r.slug, min: Number(r.min), max: Number(r.max) }))
    const invalid = rows.some(
      (r) =>
        !validateSlug(r.slug.toLowerCase()) ||
        !Number.isFinite(r.min) ||
        !Number.isFinite(r.max),
    )
    const { themeCss } = generateCSS(rows, {
      minViewport: vmin,
      maxViewport: vmax,
      rootFontPx: root,
      format: cfg.format,
    })
    const count = renderCode(el.code, themeCss)
    el.code.dataset.raw = themeCss
    el.codeLines.textContent = `${count} lignes`
    setStatus(
      el.status,
      invalid
        ? "Entrée invalide : vérifiez les noms et les valeurs numériques"
        : "",
    )

    if (save) saveConfig(cfg)
  }

  /* --- Onglets --- */

  function selectTab(kind, focus = false) {
    activeTab = kind
    el.tabs.forEach((tab) => {
      const on = tab.getAttribute("aria-controls") === `panel-${kind}`
      tab.setAttribute("aria-selected", String(on))
      tab.tabIndex = on ? 0 : -1
      if (on && focus) tab.focus()
    })
    el.panels.text.hidden = kind !== "text"
    el.panels.spacing.hidden = kind !== "spacing"
    update({ save: false })
  }

  el.tabs.forEach((tab, i) => {
    tab.addEventListener("click", () =>
      selectTab(tab.getAttribute("aria-controls").replace("panel-", "")),
    )
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return
      const next =
        el.tabs[
          (i + (e.key === "ArrowRight" ? 1 : -1) + el.tabs.length) %
            el.tabs.length
        ]
      selectTab(next.getAttribute("aria-controls").replace("panel-", ""), true)
    })
  })

  /* --- Règle et préréglages --- */

  el.range.addEventListener("input", () => {
    cfg.vw = Number(el.range.value)
    update()
  })

  el.presets.forEach((b) =>
    b.addEventListener("click", () => {
      cfg.vw = Number(b.dataset.width)
      el.range.value = cfg.vw
      update()
    }),
  )

  /* --- Réglages --- */

  ;[
    ["vmin", el.vmin],
    ["vmax", el.vmax],
    ["root", el.root],
  ].forEach(([key, input]) =>
    input.addEventListener("input", () => {
      if (input.value === "" || !Number.isFinite(Number(input.value))) return
      cfg[key] = Number(input.value)
      update()
    }),
  )

  el.formats.forEach((b) =>
    b.addEventListener("click", () => {
      cfg.format = b.dataset.format
      update()
    }),
  )

  /* --- Tableaux --- */

  Object.values(el.tbodies).forEach((tbody) => {
    tbody.addEventListener("input", (e) => {
      const input = e.target
      if (input.classList.contains("input-slug")) {
        const ok = validateSlug(input.value.trim().toLowerCase())
        if (ok) input.removeAttribute("aria-invalid")
        else input.setAttribute("aria-invalid", "true")
        updateRowLabels(input.closest("tr"))
      }
      update()
    })

    // min > max : on ramène la valeur éditée sur l'autre borne
    tbody.addEventListener("focusout", (e) => {
      const t = e.target
      if (!t.matches(".input-min, .input-max")) return
      const tr = t.closest("tr")
      const minEl = q(".input-min", tr)
      const maxEl = q(".input-max", tr)
      if (minEl.value.trim() === "" || maxEl.value.trim() === "") return
      const min = Number(minEl.value)
      const max = Number(maxEl.value)
      if (!(min > max)) return
      const slug = q(".input-slug", tr).value.trim()
      if (t === minEl) {
        minEl.value = String(max)
        setStatus(el.status, `${slug} : min ajusté à ${max}`)
      } else {
        maxEl.value = String(min)
        setStatus(el.status, `${slug} : max ajusté à ${min}`)
      }
      update()
    })

    tbody.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn-remove")
      if (!btn) return
      const tr = btn.closest("tr")
      const next = tr.nextElementSibling || tr.previousElementSibling
      const slug = q(".input-slug", tr).value.trim()
      tr.remove()
      update()
      setStatus(el.status, `${slug} supprimée`)
      if (next) q(".input-slug", next).focus()
      else el.btnAdd.focus()
    })
  })

  el.btnAdd.addEventListener("click", () => {
    const tr = createRow({
      slug: activeTab === "text" ? "text-new" : "spacing-new",
      min: 16,
      max: 24,
    })
    el.tbodies[activeTab].appendChild(tr)
    update()
    const slug = q(".input-slug", tr)
    slug.focus()
    slug.select()
  })

  /* --- Actions --- */

  function flash(button, text) {
    const label = q(".btn-label", button)
    const prev = label.textContent
    label.textContent = text
    setTimeout(() => (label.textContent = prev), 1200)
  }

  el.btnCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(el.code.dataset.raw || "")
      flash(el.btnCopy, "Copié !")
      setStatus(el.status, "theme.css copié")
    } catch {
      setStatus(el.status, "Impossible de copier theme.css")
    }
  })

  el.btnShare.addEventListener("click", async () => {
    saveConfig(cfg)
    try {
      await navigator.clipboard.writeText(location.href)
      flash(el.btnShare, "Lien copié !")
      setStatus(el.status, "Lien de partage copié")
    } catch {
      setStatus(el.status, "Impossible de copier le lien")
    }
  })

  el.btnReset.addEventListener("click", () => {
    cfg = structuredClone(DEFAULTS)
    fillSettings()
    fillTables()
    update()
    setStatus(el.status, "Configuration réinitialisée")
  })

  /* --- Démarrage --- */

  fillSettings()
  fillTables()
  update({ save: false })
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
