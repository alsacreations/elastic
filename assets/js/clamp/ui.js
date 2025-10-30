// ui.js
// Helpers to manage the editable table, events, and accessibility

export function q(sel, ctx = document) {
  return ctx.querySelector(sel);
}
export function qa(sel, ctx = document) {
  return Array.from(ctx.querySelectorAll(sel));
}

export function collectRows(tableEl) {
  const rows = [];
  const trs = Array.from(tableEl.querySelectorAll("tbody tr"));
  trs.forEach((tr) => {
    const slug = tr.querySelector(".input-slug")?.value?.trim() ?? "";
    const min = tr.querySelector(".input-min")?.value ?? "";
    const max = tr.querySelector(".input-max")?.value ?? "";
    if (!slug || !min || !max) return;
    rows.push({ slug, min: Number(min), max: Number(max) });
  });
  return rows;
}

export function createRow(slug = "", min = "", max = "") {
  const tr = document.createElement("tr");

  const tdSlug = document.createElement("td");
  const inputSlug = document.createElement("input");
  inputSlug.type = "text";
  inputSlug.className = "input-slug";
  inputSlug.value = slug;
  inputSlug.setAttribute("aria-label", "slug");
  tdSlug.appendChild(inputSlug);

  const tdMin = document.createElement("td");
  const inputMin = document.createElement("input");
  inputMin.type = "number";
  inputMin.className = "input-min";
  inputMin.value = min;
  inputMin.setAttribute("aria-label", "min en pixels");
  tdMin.appendChild(inputMin);

  const tdMax = document.createElement("td");
  const inputMax = document.createElement("input");
  inputMax.type = "number";
  inputMax.className = "input-max";
  inputMax.value = max;
  inputMax.setAttribute("aria-label", "max en pixels");
  tdMax.appendChild(inputMax);

  const tdAction = document.createElement("td");
  const btnRemove = document.createElement("button");
  btnRemove.type = "button";
  btnRemove.className = "btn-remove";
  btnRemove.setAttribute("aria-label", "Supprimer la ligne");
  btnRemove.textContent = "✕";
  tdAction.appendChild(btnRemove);

  tr.appendChild(tdSlug);
  tr.appendChild(tdMin);
  tr.appendChild(tdMax);
  tr.appendChild(tdAction);

  return tr;
}

export function setStatus(msgEl, text) {
  if (!msgEl) return;
  msgEl.textContent = text;
}

export function validateSlug(slug) {
  // allow lowercase letters, numbers and hyphens
  return /^[a-z0-9\-]+$/.test(slug);
}
