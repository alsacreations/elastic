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
  const clampTbody = clampTable.querySelector("tbody");
  const spacingTable = document.getElementById("spacing-table");
  const spacingTbody = spacingTable.querySelector("tbody");
  const btnAdd = document.getElementById("btn-add");
  const btnCopy = document.getElementById("btn-copy");
  const themeOutput = document.getElementById("css-output-theme");
  const tokensOutput = document.getElementById("css-output-tokens");
  const status = document.getElementById("clamp-status");

  // delegate events
  clampTbody.addEventListener("input", onInputChange);
  spacingTbody.addEventListener("input", onInputChange);
  // when a min/max input loses focus, if the entered value is outside the range
  // (min > max) we clamp the edited value to the other side instead of swapping
  [clampTbody, spacingTbody].forEach((tb) => {
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
  [clampTbody, spacingTbody].forEach((tb) => {
    tb.addEventListener("click", (e) => {
      const t = e.target;
      if (t.classList.contains("btn-remove")) {
        const tr = t.closest("tr");
        if (tr) tr.remove();
        generateAndRender();
      }
    });
  });

  btnAdd.addEventListener("click", () => {
    const tr = createRow("new-slug", "", "");
    clampTbody.appendChild(tr);
    // focus the slug input
    tr.querySelector(".input-slug").focus();
  });

  const btnAddSpacing = document.getElementById("btn-add-spacing");
  btnAddSpacing.addEventListener("click", () => {
    const tr = createRow("new-slug", "", "");
    spacingTbody.appendChild(tr);
    tr.querySelector(".input-slug").focus();
  });

  btnCopy.addEventListener("click", async () => {
    try {
      // copy combined CSS (theme + tokens)
      const combined = `${themeOutput.value}\n${tokensOutput.value}`;
      await navigator.clipboard.writeText(combined);
      setStatus(status, "CSS copié dans le presse-papier");
    } catch (err) {
      setStatus(status, "Impossible de copier");
    }
  });

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
    const rows = [...collectRows(clampTable), ...collectRows(spacingTable)];
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
      themeOutput.value = result;
      tokensOutput.value = "";
    } else {
      themeOutput.value = result.themeCss || "";
      tokensOutput.value = result.tokensCss || "";
    }
  }
}

// start when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
