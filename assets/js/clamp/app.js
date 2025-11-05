import {
  collectRows,
  createRow,
  setStatus,
  validateSlug,
  q,
  qa,
} from "./ui.js";
import { generateCSS } from "./generator.js";

const MIN_VIEWPORT = 360;
const MAX_VIEWPORT = 1280;
const ROOT_FONT_PX = 16;

function init() {
  const clampTable = document.getElementById("clamp-table");
  const clampTbody = clampTable ? clampTable.querySelector("tbody") : null;
  const spacingTable = document.getElementById("spacing-table");
  const spacingTbody = spacingTable
    ? spacingTable.querySelector("tbody")
    : null;
  const btnAdd = document.getElementById("btn-add");
  const btnCopyTheme = document.getElementById("btn-copy-theme");
  const btnCopyTokens = document.getElementById("btn-copy-tokens");
  const themeOutput = document.getElementById("css-output-theme");
  const tokensOutput = document.getElementById("css-output-tokens");
  const status = document.getElementById("clamp-status");

  // delegate events (only if tbody elements exist)
  if (clampTbody) clampTbody.addEventListener("input", onInputChange);
  if (spacingTbody) spacingTbody.addEventListener("input", onInputChange);
  // when a min/max input loses focus, if the entered value is outside the range
  // (min > max) we clamp the edited value to the other side instead of swapping
  [clampTbody, spacingTbody].filter(Boolean).forEach((tb) => {
    tb.addEventListener("focusout", (e) => {
      const t = e.target;
      if (!t.classList) return;
      if (
        t.classList.contains("input-min") ||
        t.classList.contains("input-max")
      ) {
        const tr = t.closest("tr");
        if (!tr) return;
        const minEl = tr.querySelector(".input-min");
        const maxEl = tr.querySelector(".input-max");
        if (!minEl || !maxEl) return;
        const minVal = Number(minEl.value);
        const maxVal = Number(maxEl.value);
        if (
          Number.isFinite(minVal) &&
          Number.isFinite(maxVal) &&
          minVal > maxVal
        ) {
          const slug = tr.querySelector(".input-slug")?.value?.trim() || "";
          if (t.classList.contains("input-min")) {
            // user edited min too high -> clamp min to max
            minEl.value = String(maxVal);
            setStatus(
              status,
              `Correction appliquée: ${slug}: min ajusté à ${maxVal}`
            );
          } else {
            // user edited max too low -> clamp max to min
            maxEl.value = String(minVal);
            setStatus(
              status,
              `Correction appliquée: ${slug}: max ajusté à ${minVal}`
            );
          }
          generateAndRender();
        }
      }
    });
  });
  // removal handler for both tables (event delegation)
  [clampTbody, spacingTbody].filter(Boolean).forEach((tb) => {
    tb.addEventListener("click", (e) => {
      const t = e.target;
      if (t.classList.contains("btn-remove")) {
        const tr = t.closest("tr");
        if (tr) tr.remove();
        generateAndRender();
      }
    });
  });

  if (btnAdd && clampTbody) {
    btnAdd.addEventListener("click", () => {
      const tr = createRow("new-slug", "", "");
      clampTbody.appendChild(tr);
      // focus the slug input
      tr.querySelector(".input-slug").focus();
    });
  }

  const btnAddSpacing = document.getElementById("btn-add-spacing");
  if (btnAddSpacing && spacingTbody) {
    btnAddSpacing.addEventListener("click", () => {
      const tr = createRow("new-slug", "", "");
      spacingTbody.appendChild(tr);
      tr.querySelector(".input-slug").focus();
    });
  }

  // per-output copy buttons
  if (btnCopyTheme) {
    btnCopyTheme.addEventListener("click", async () => {
      try {
        const text = themeOutput ? themeOutput.value : "";
        await navigator.clipboard.writeText(text);
        setStatus(status, "theme.css copié");
        const prev = btnCopyTheme.textContent;
        btnCopyTheme.textContent = "Copié !";
        setTimeout(() => (btnCopyTheme.textContent = prev), 900);
      } catch (err) {
        setStatus(status, "Impossible de copier theme.css");
      }
    });
  }
  if (btnCopyTokens) {
    btnCopyTokens.addEventListener("click", async () => {
      try {
        const text = tokensOutput ? tokensOutput.value : "";
        await navigator.clipboard.writeText(text);
        setStatus(status, "theme-tokens.css copié");
        const prev = btnCopyTokens.textContent;
        btnCopyTokens.textContent = "Copié !";
        setTimeout(() => (btnCopyTokens.textContent = prev), 900);
      } catch (err) {
        setStatus(status, "Impossible de copier theme-tokens.css");
      }
    });
  }

  // initial generation
  generateAndRender();

  function onInputChange(e) {
    // basic validation: if slug invalid, mark aria-invalid
    const input = e.target;
    if (input.classList && input.classList.contains("input-slug")) {
      const val = input.value.trim().toLowerCase();
      if (!validateSlug(val)) {
        input.setAttribute("aria-invalid", "true");
      } else {
        input.removeAttribute("aria-invalid");
      }
    }

    generateAndRender();
  }

  function generateAndRender() {
    // collect rows from both tables and concatenate
    const rows = [];
    if (clampTable) rows.push(...collectRows(clampTable));
    if (spacingTable) rows.push(...collectRows(spacingTable));
    // run validation
    const invalid = rows.some(
      (r) =>
        !validateSlug(String(r.slug).trim().toLowerCase()) ||
        !Number.isFinite(r.min) ||
        !Number.isFinite(r.max)
    );
    if (invalid) {
      setStatus(
        status,
        "Entrée invalide détectée — vérifiez les slugs et les valeurs numériques"
      );
    } else {
      setStatus(status, "CSS généré");
    }

    const result = generateCSS(rows, {
      minViewport: MIN_VIEWPORT,
      maxViewport: MAX_VIEWPORT,
      rootFontPx: ROOT_FONT_PX,
    });
    if (typeof result === "string") {
      // backward compatibility: if generator returns a combined string
      if (themeOutput) themeOutput.value = result;
      if (tokensOutput) tokensOutput.value = "";
    } else {
      if (themeOutput) themeOutput.value = result.themeCss || "";
      if (tokensOutput) tokensOutput.value = result.tokensCss || "";
    }
  }
}

// start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
