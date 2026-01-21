import { collectRows, createRow, setStatus, validateSlug, q, qa } from "./ui.js"
import { generateCSS } from "./generator.js"

const MIN_VIEWPORT = 360
const MAX_VIEWPORT = 1280
const ROOT_FONT_PX = 16

function init() {
  const clampTable = document.getElementById("clamp-table")
  const clampTbody = clampTable ? clampTable.querySelector("tbody") : null
  const spacingTable = document.getElementById("spacing-table")
  const spacingTbody = spacingTable ? spacingTable.querySelector("tbody") : null
  const btnAdd = document.getElementById("btn-add")
  const btnCopyTheme = document.getElementById("btn-copy-theme")
  const themeOutput = document.getElementById("css-output-theme")
  const status = document.getElementById("clamp-status")

  // delegate events (only if tbody elements exist)
  if (clampTbody) clampTbody.addEventListener("input", onInputChange)
  if (spacingTbody)
    spacingTbody.addEventListener("input", onInputChange)
    // when a min/max input loses focus, if the entered value is outside the range
    // (min > max) we clamp the edited value to the other side instead of swapping
  ;[clampTbody, spacingTbody].filter(Boolean).forEach((tb) => {
    tb.addEventListener("focusout", (e) => {
      const t = e.target
      if (!t.classList) return
      if (
        t.classList.contains("input-min") ||
        t.classList.contains("input-max")
      ) {
        const tr = t.closest("tr")
        if (!tr) return
        const minEl = tr.querySelector(".input-min")
        const maxEl = tr.querySelector(".input-max")
        if (!minEl || !maxEl) return
        // If one of the fields is empty the user is still typing —
        // don't enforce min<=max yet to avoid clobbering input (UX fix).
        if (minEl.value.trim() === "" || maxEl.value.trim() === "") return
        const minVal = Number(minEl.value)
        const maxVal = Number(maxEl.value)
        if (
          Number.isFinite(minVal) &&
          Number.isFinite(maxVal) &&
          minVal > maxVal
        ) {
          const slug = tr.querySelector(".input-slug")?.value?.trim() || ""
          if (t.classList.contains("input-min")) {
            // user edited min too high -> clamp min to max
            minEl.value = String(maxVal)
            setStatus(
              status,
              `Correction appliquée: ${slug}: min ajusté à ${maxVal}`,
            )
          } else {
            // user edited max too low -> clamp max to min
            maxEl.value = String(minVal)
            setStatus(
              status,
              `Correction appliquée: ${slug}: max ajusté à ${minVal}`,
            )
          }
          generateAndRender()
        }
      }
    })
  })
  // removal handler for both tables (event delegation)
  ;[clampTbody, spacingTbody].filter(Boolean).forEach((tb) => {
    tb.addEventListener("click", (e) => {
      const t = e.target
      if (t.classList.contains("btn-remove")) {
        const tr = t.closest("tr")
        if (tr) tr.remove()
        generateAndRender()
      }
    })
  })

  if (btnAdd && clampTbody) {
    btnAdd.addEventListener("click", () => {
      const tr = createRow("new-slug", "", "")
      clampTbody.appendChild(tr)
      // focus the slug input
      tr.querySelector(".input-slug").focus()
    })
  }

  const btnAddSpacing = document.getElementById("btn-add-spacing")
  if (btnAddSpacing && spacingTbody) {
    btnAddSpacing.addEventListener("click", () => {
      const tr = createRow("new-slug", "", "")
      spacingTbody.appendChild(tr)
      tr.querySelector(".input-slug").focus()
    })
  }

  // per-output copy buttons
  if (btnCopyTheme) {
    btnCopyTheme.addEventListener("click", async () => {
      try {
        const text = themeOutput ? themeOutput.value : ""
        await navigator.clipboard.writeText(text)
        setStatus(status, "theme.css copié")
        const prev = btnCopyTheme.textContent
        btnCopyTheme.textContent = "Copié !"
        setTimeout(() => (btnCopyTheme.textContent = prev), 900)
      } catch (err) {
        setStatus(status, "Impossible de copier theme.css")
      }
    })
  }

  // initial generation
  generateAndRender()

  function onInputChange(e) {
    // basic validation: if slug invalid, mark aria-invalid
    const input = e.target
    if (input.classList && input.classList.contains("input-slug")) {
      const val = input.value.trim().toLowerCase()
      if (!validateSlug(val)) {
        input.setAttribute("aria-invalid", "true")
      } else {
        input.removeAttribute("aria-invalid")
      }
    }

    generateAndRender()
  }

  function generateAndRender() {
    // collect rows from both tables and concatenate
    const rows = []
    if (clampTable) rows.push(...collectRows(clampTable))
    if (spacingTable) rows.push(...collectRows(spacingTable))
    // run validation
    const invalid = rows.some(
      (r) =>
        !validateSlug(String(r.slug).trim().toLowerCase()) ||
        !Number.isFinite(r.min) ||
        !Number.isFinite(r.max),
    )
    if (invalid) {
      setStatus(
        status,
        "Entrée invalide détectée — vérifiez les slugs et les valeurs numériques",
      )
    } else {
      setStatus(status, "CSS généré")
    }

    const result = generateCSS(rows, {
      minViewport: MIN_VIEWPORT,
      maxViewport: MAX_VIEWPORT,
      rootFontPx: ROOT_FONT_PX,
    })
    if (themeOutput) {
      themeOutput.value = result.themeCss || ""
    }

    // Render graphs (update visual styles)
    const allTrs = []
    if (clampTable)
      allTrs.push(...Array.from(clampTable.querySelectorAll("tbody tr")))
    if (spacingTable)
      allTrs.push(...Array.from(spacingTable.querySelectorAll("tbody tr")))

    allTrs.forEach((tr) => {
      updateGraphVisual(tr)
    })
  }

  function updateGraphVisual(tr) {
    if (!tr) return
    const minInput = tr.querySelector(".input-min")
    const maxInput = tr.querySelector(".input-max")
    const graphDiv = tr.querySelector(".graph-visual")

    if (minInput && maxInput && graphDiv) {
      const minPx = Number(minInput.value)
      const maxPx = Number(maxInput.value)

      if (Number.isFinite(minPx) && Number.isFinite(maxPx)) {
        // We want realistic height representation.
        // Let's assume the container height is roughly 96px (6rem).
        // But we don't need to know the container height if we use PX in calc() for the "gap" from top?
        // Actually, to draw from bottom up:
        // height of bar = value px.
        // clip-path: polygon(...)
        // standard coordinates: top-left (0 0).
        // We want bottom-left to be (0, 100%).
        // Top-left of the BAR should be (0, 100% - value_px).

        // Note: If value > container height, it will be clipped by the div itself, which is fine.

        // Set css variable or direct style?
        // clip-path: polygon(
        //   0% calc(100% - ${minPx}px),
        //   100% calc(100% - ${maxPx}px),
        //   100% 100%,
        //   0% 100%
        // );

        // To animate this, we can just set the style.
        const poly = `polygon(0% calc(100% - ${minPx}px), 100% calc(100% - ${maxPx}px), 100% 100%, 0% 100%)`

        // We need to apply this to the pseudo-element? No, pseudo-elements are hard to style inline.
        // Let's style the div itself or an inner element?
        // The CSS used .graph-visual::before { ... transition: clip-path ... }
        // We cannot set inline styles on pseudo-elements.
        // We can set a custom property on the parent div and use it in CSS.

        graphDiv.style.setProperty("--clip-path", poly)
        graphDiv.style.height = `${Math.max(minPx, maxPx)}px`
      }
    }
  }
}

// start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init)
} else {
  init()
}
