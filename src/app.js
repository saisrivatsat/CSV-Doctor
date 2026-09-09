import {
  createCsvExport,
  createRepairReport,
  decodeBytes,
  doctorCsv,
} from "./csv-doctor.js";

const SAMPLE = ` Name ,Email,Joined,Account ID,Status,Email
Ada,ada@example.com,03/14/2025,00123,Active,ada@example.com
Grace;grace@example.com;15/04/2025;00456;Active;grace@example.com
 Ada ,ADA@example.com,03/14/2025,00123,Active,ada@example.com

Linus,linus@example.com,04/05/2025,1234567890123456,=REVIEW(),linus@example.com`;

const STORAGE_KEY = "csv-doctor-recipes-v1";
const PRESETS = {
  balanced: { candidates: [] },
  contacts: { candidates: ["email", "email address", "phone", "phone number"] },
  transactions: {
    candidates: ["transaction id", "reference", "reference id", "transaction", "id"],
  },
  catalog: { candidates: ["sku", "product id", "variant sku", "item id"] },
};

const EXPORT_HELP = {
  standard: "Comma-separated, UTF-8, and broadly compatible.",
  excel: "Adds a UTF-8 marker and prefixes formula-like values for spreadsheet review.",
  semicolon: "Uses semicolons for systems configured with decimal commas.",
  tsv: "Uses tabs and Unix line endings for technical tools.",
};

const state = {
  encoding: {
    confidence: "local",
    encoding: "utf-8",
    hadBom: false,
    label: "Browser text",
    replacements: 0,
  },
  fileBytes: null,
  fileName: "pasted-data.csv",
  fileSize: null,
  history: [],
  preview: "after",
  rawText: "",
  result: null,
};

const elements = {
  afterTab: document.querySelector("#after-tab"),
  beforeTab: document.querySelector("#before-tab"),
  chooseFile: document.querySelector("#choose-file"),
  copyButton: document.querySelector("#copy-button"),
  csvInput: document.querySelector("#csv-input"),
  dateDetail: document.querySelector("#date-detail"),
  dateFinding: document.querySelector("#date-finding"),
  dateOrder: document.querySelector("#date-order-select"),
  deleteRecipeButton: document.querySelector("#delete-recipe-button"),
  delimiterDetail: document.querySelector("#delimiter-detail"),
  delimiterFinding: document.querySelector("#delimiter-finding"),
  delimiterSelect: document.querySelector("#delimiter-select"),
  diagnoseButton: document.querySelector("#diagnose-button"),
  downloadButton: document.querySelector("#download-button"),
  dropZone: document.querySelector("#drop-zone"),
  duplicateDetail: document.querySelector("#duplicate-detail"),
  duplicateFinding: document.querySelector("#duplicate-finding"),
  duplicateKeyList: document.querySelector("#duplicate-key-list"),
  duplicateKeySection: document.querySelector("#duplicate-key-section"),
  duplicateToggle: document.querySelector("#duplicate-toggle"),
  emptyToggle: document.querySelector("#empty-toggle"),
  encodingDetail: document.querySelector("#encoding-detail"),
  encodingFinding: document.querySelector("#encoding-finding"),
  encodingSelect: document.querySelector("#encoding-select"),
  exportProfile: document.querySelector("#export-profile-select"),
  exportProfileDetail: document.querySelector("#export-profile-detail"),
  exportSummary: document.querySelector("#export-summary"),
  fileInput: document.querySelector("#file-input"),
  fileMeta: document.querySelector("#file-meta"),
  fileName: document.querySelector("#file-name"),
  formError: document.querySelector("#form-error"),
  healthCount: document.querySelector("#health-count"),
  healthTable: document.querySelector("#health-table"),
  headerDetail: document.querySelector("#header-detail"),
  headerFinding: document.querySelector("#header-finding"),
  headerSelect: document.querySelector("#header-select"),
  issueCount: document.querySelector("#issue-count"),
  issueList: document.querySelector("#issue-list"),
  presetSelect: document.querySelector("#preset-select"),
  previewNote: document.querySelector("#preview-note"),
  previewTable: document.querySelector("#preview-table"),
  recipeName: document.querySelector("#recipe-name"),
  recipeSelect: document.querySelector("#recipe-select"),
  repairButton: document.querySelector("#repair-button"),
  reportButton: document.querySelector("#report-button"),
  resetButton: document.querySelector("#reset-button"),
  sampleButton: document.querySelector("#sample-button"),
  saveRecipeButton: document.querySelector("#save-recipe-button"),
  toast: document.querySelector("#toast"),
  trimToggle: document.querySelector("#trim-toggle"),
  undoButton: document.querySelector("#undo-button"),
  workspace: document.querySelector("#workspace"),
};

function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function formatBytes(bytes) {
  if (bytes === null) return "Pasted data";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function selectedDuplicateColumns() {
  return [...elements.duplicateKeyList.querySelectorAll("input:checked")].map((input) =>
    Number(input.value),
  );
}

function optionsFromControls() {
  return {
    dateOrder: elements.dateOrder.value,
    delimiter: elements.delimiterSelect.value,
    duplicateColumns: selectedDuplicateColumns(),
    header: elements.headerSelect.value,
    removeDuplicates: elements.duplicateToggle.checked,
    skipEmptyRows: elements.emptyToggle.checked,
    trimWhitespace: elements.trimToggle.checked,
  };
}

function applyOptionsToControls(options) {
  elements.dateOrder.value = options.dateOrder ?? "auto";
  elements.delimiterSelect.value = options.delimiter ?? "auto";
  elements.headerSelect.value = options.header ?? "auto";
  elements.duplicateToggle.checked = options.removeDuplicates ?? true;
  elements.emptyToggle.checked = options.skipEmptyRows ?? true;
  elements.trimToggle.checked = options.trimWhitespace ?? true;
  const selected = new Set(options.duplicateColumns ?? []);
  for (const input of elements.duplicateKeyList.querySelectorAll("input")) {
    input.checked = selected.has(Number(input.value));
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function setError(message = "") {
  elements.formError.textContent = message;
  elements.formError.hidden = !message;
}

function decodeCurrentFile() {
  if (!state.fileBytes) return;
  state.encoding = decodeBytes(state.fileBytes, elements.encodingSelect.value);
  elements.csvInput.value = state.encoding.text;
}

function runDiagnosis({ scroll = false, recordHistory = false } = {}) {
  try {
    if (recordHistory && state.result) state.history.push(structuredClone(state.result.options));
    decodeCurrentFile();
    const text = elements.csvInput.value;
    state.rawText = text;
    state.result = doctorCsv(text, optionsFromControls());
    setError();
    renderResult();
    elements.workspace.hidden = false;
    elements.undoButton.disabled = state.history.length === 0;
    if (scroll) elements.workspace.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setError(error.message);
    elements.csvInput.focus();
  }
}

function renderFindings() {
  const { dates, delimiter, duplicates, header, shape } = state.result;
  elements.delimiterFinding.textContent = `${delimiter.label} detected`;
  elements.delimiterDetail.textContent = delimiter.repairedRows.length
    ? `${plural(delimiter.repairedRows.length, "mixed row")} repaired`
    : `${delimiter.confidence[0].toUpperCase()}${delimiter.confidence.slice(1)} confidence`;

  elements.headerFinding.textContent = header.generated
    ? "Headers generated"
    : header.repaired
      ? "Headers repaired"
      : "Headers detected";
  elements.headerDetail.textContent = header.changes.length
    ? plural(header.changes.length, "header change")
    : "No changes needed";

  elements.dateFinding.textContent = dates.columns.length
    ? plural(dates.columns.length, "date column")
    : "No date columns";
  elements.dateDetail.textContent = dates.ambiguousCount
    ? `${dates.convertedCount} fixed, ${dates.ambiguousCount} ${dates.ambiguousCount === 1 ? "needs" : "need"} review`
    : dates.convertedCount
      ? `${plural(dates.convertedCount, "value")} standardized`
      : "Nothing changed";

  elements.duplicateFinding.textContent = duplicates.removed
    ? `${plural(duplicates.removed, "duplicate")} removed`
    : "No duplicates";
  elements.duplicateDetail.textContent = duplicates.columns.length
    ? `Matched by ${duplicates.columns.map((index) => header.headers[index]).join(", ")}`
    : duplicates.removed
      ? "First exact copy kept"
      : "All rows are unique";

  elements.encodingFinding.textContent = state.encoding.label;
  elements.encodingDetail.textContent = state.fileBytes
    ? `${state.encoding.confidence} confidence${state.encoding.hadBom ? " · marker found" : ""}`
    : "Pasted browser text";

  elements.fileName.textContent = state.fileName;
  elements.fileMeta.textContent = `${formatBytes(state.fileSize)} · ${plural(shape.inputRecords, "record")}`;
  renderExportSummary();
}

function makeCell(text, tagName = "td") {
  const node = document.createElement(tagName);
  node.textContent = text === "" ? "—" : text;
  if (text === "") node.classList.add("empty-cell");
  return node;
}

function renderTable() {
  const after = state.preview === "after";
  const sourceRows = after ? state.result.outputRows : state.result.beforeRows;
  const shownRows = sourceRows.slice(0, after ? 13 : 12);
  const totalColumns = Math.max(0, ...shownRows.map((row) => row.length));
  const visibleColumns = Math.min(totalColumns, 10);
  const changedCells = new Set(
    state.result.changes.map((change) => `${change.line}:${change.column}`),
  );
  const changedHeaders = new Set(state.result.header.changedIndexes);
  elements.previewTable.replaceChildren();

  if (!shownRows.length) return;

  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  const rowNumberHead = document.createElement("th");
  rowNumberHead.textContent = "#";
  rowNumberHead.className = "row-number";
  headRow.append(rowNumberHead);

  const headers = after
    ? shownRows[0]
    : Array.from({ length: visibleColumns }, (_, index) => `Column ${index + 1}`);
  headers.slice(0, visibleColumns).forEach((header, column) => {
    const headerCell = makeCell(header, "th");
    headerCell.scope = "col";
    if (after && changedHeaders.has(column)) {
      headerCell.classList.add("changed-cell");
      headerCell.title = "Header repaired";
    }
    headRow.append(headerCell);
  });
  head.append(headRow);
  elements.previewTable.append(head);

  const body = document.createElement("tbody");
  const dataRows = after ? shownRows.slice(1) : shownRows;
  dataRows.forEach((row, index) => {
    const tableRow = document.createElement("tr");
    const rowNumber = document.createElement("th");
    rowNumber.scope = "row";
    rowNumber.className = "row-number";
    rowNumber.textContent = String(index + 1);
    tableRow.append(rowNumber);
    row.slice(0, visibleColumns).forEach((value, column) => {
      const dataCell = makeCell(value);
      if (after && changedCells.has(`${state.result.rowLines[index]}:${column}`)) {
        dataCell.classList.add("changed-cell");
        dataCell.title = "Value repaired";
      }
      tableRow.append(dataCell);
    });
    body.append(tableRow);
  });
  elements.previewTable.append(body);

  const rowCount = after ? state.result.shape.outputRows : state.result.shape.inputRecords;
  const rowLabel = after ? plural(rowCount, "data row") : plural(rowCount, "source record");
  const notes = [`Showing ${Math.min(dataRows.length, rowCount)} of ${rowLabel}`];
  if (totalColumns > visibleColumns) notes.push(`${totalColumns - visibleColumns} more columns in export`);
  elements.previewNote.textContent = notes.join(" · ");
}

function renderIssues() {
  const { issues } = state.result;
  elements.issueCount.textContent = plural(issues.length, "note");
  elements.issueList.replaceChildren();

  if (!issues.length) {
    const empty = document.createElement("div");
    empty.className = "issue-empty";
    empty.textContent = "No repairs were needed. The file already looks healthy.";
    elements.issueList.append(empty);
    return;
  }

  for (const issue of issues) {
    const item = document.createElement("article");
    item.className = `issue-item ${issue.severity}`;
    const mark = document.createElement("span");
    mark.className = "issue-mark";
    mark.textContent = issue.severity === "fixed" ? "✓" : "!";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = issue.title;
    const detail = document.createElement("p");
    detail.textContent = issue.detail;
    copy.append(title, detail);
    item.append(mark, copy);
    elements.issueList.append(item);
  }
}

function typeLabel(type) {
  return {
    boolean: "Yes / no",
    date: "Date",
    empty: "Empty",
    number: "Number",
    text: "Text",
  }[type] ?? type;
}

function renderColumnHealth() {
  elements.healthCount.textContent = plural(state.result.columns.length, "column");
  elements.healthTable.replaceChildren();
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const label of ["Column", "Looks like", "Filled", "Unique", "Watch"])
    headRow.append(makeCell(label, "th"));
  head.append(headRow);

  const body = document.createElement("tbody");
  for (const profile of state.result.columns) {
    const row = document.createElement("tr");
    row.append(makeCell(profile.name));
    const typeCell = makeCell(typeLabel(profile.primaryType));
    typeCell.classList.add("type-cell");
    row.append(typeCell);
    row.append(makeCell(`${profile.fillRate}%`));
    row.append(makeCell(String(profile.unique)));
    const warningCell = makeCell(profile.warnings.length ? profile.warnings.join(" · ") : "Healthy");
    warningCell.classList.add(profile.warnings.length ? "health-warning" : "health-good");
    row.append(warningCell);
    body.append(row);
  }
  elements.healthTable.append(head, body);
}

function renderDuplicateKeys() {
  const selected = new Set(state.result.options.duplicateColumns ?? []);
  elements.duplicateKeyList.replaceChildren();
  state.result.header.headers.forEach((header, column) => {
    const label = document.createElement("label");
    label.className = "key-chip";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = String(column);
    input.checked = selected.has(column);
    input.disabled = !elements.duplicateToggle.checked;
    const text = document.createElement("span");
    text.textContent = header;
    label.append(input, text);
    elements.duplicateKeyList.append(label);
  });
  elements.duplicateKeySection.disabled = !elements.duplicateToggle.checked;
}

function renderTabs() {
  const after = state.preview === "after";
  elements.afterTab.setAttribute("aria-selected", String(after));
  elements.beforeTab.setAttribute("aria-selected", String(!after));
}

function renderExportSummary() {
  if (!state.result) return;
  const profile = createCsvExport(state.result.outputRows, elements.exportProfile.value).profile;
  elements.exportSummary.textContent = `${plural(state.result.shape.outputRows, "data row")} across ${plural(state.result.shape.columns, "column")} · ${profile.label}.`;
  elements.exportProfileDetail.textContent = EXPORT_HELP[profile.key];
  elements.downloadButton.textContent = `Download .${profile.extension}`;
}

function renderResult() {
  renderFindings();
  renderTabs();
  renderTable();
  renderIssues();
  renderColumnHealth();
  renderDuplicateKeys();
}

async function loadFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    setError("That file is larger than 10 MB. Try a smaller CSV.");
    return;
  }
  state.fileBytes = new Uint8Array(await file.arrayBuffer());
  state.fileName = file.name || "data.csv";
  state.fileSize = file.size;
  state.history = [];
  elements.encodingSelect.value = "auto";
  elements.encodingSelect.disabled = false;
  decodeCurrentFile();
  runDiagnosis({ scroll: true });
}

function setPastedSource(fileName = "pasted-data.csv") {
  state.fileBytes = null;
  state.fileName = fileName;
  state.fileSize = new Blob([elements.csvInput.value]).size;
  state.history = [];
  state.encoding = {
    confidence: "local",
    encoding: "utf-8",
    hadBom: false,
    label: "Browser text",
    replacements: 0,
  };
  elements.encodingSelect.value = "auto";
  elements.encodingSelect.disabled = true;
}

function outputFileName(extension) {
  const base = state.fileName.replace(/\.(?:csv|tsv|txt)$/i, "") || "data";
  return `${base}-cleaned.${extension}`;
}

function downloadBlob(content, type, fileName) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function currentExport() {
  return createCsvExport(state.result.outputRows, elements.exportProfile.value);
}

function downloadResult() {
  if (!state.result) return;
  const output = currentExport();
  const type = output.profile.extension === "tsv" ? "text/tab-separated-values" : "text/csv";
  downloadBlob(output.content, `${type};charset=utf-8`, outputFileName(output.profile.extension));
  showToast(`${output.profile.label} downloaded`);
}

function downloadReport() {
  if (!state.result) return;
  const report = createRepairReport(state.result, {
    fileName: state.fileName,
    generatedAt: new Date().toISOString(),
  });
  const fileName = `${state.fileName.replace(/\.(?:csv|tsv|txt)$/i, "") || "data"}-repair-report.json`;
  downloadBlob(`${JSON.stringify(report, null, 2)}\n`, "application/json;charset=utf-8", fileName);
  showToast("Repair report downloaded");
}

async function copyResult() {
  if (!state.result) return;
  const output = currentExport();
  try {
    await navigator.clipboard.writeText(output.content);
    showToast(`${output.profile.label} copied`);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = output.content;
    helper.className = "clipboard-helper";
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    showToast(`${output.profile.label} copied`);
  }
}

function readRecipes() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function writeRecipes(recipes) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
    return true;
  } catch {
    showToast("This browser blocked local recipe storage");
    return false;
  }
}

function renderRecipes(selectedName = "") {
  const recipes = readRecipes();
  elements.recipeSelect.replaceChildren(new Option("Load a saved recipe", ""));
  for (const recipe of recipes) elements.recipeSelect.add(new Option(recipe.name, recipe.name));
  elements.recipeSelect.value = selectedName;
  elements.deleteRecipeButton.disabled = !selectedName;
}

function saveRecipe() {
  const name = elements.recipeName.value.trim();
  if (!name) {
    elements.recipeName.focus();
    showToast("Name the recipe first");
    return;
  }
  const recipes = readRecipes().filter((recipe) => recipe.name !== name);
  recipes.push({
    encoding: elements.encodingSelect.value,
    exportProfile: elements.exportProfile.value,
    name,
    options: optionsFromControls(),
  });
  recipes.sort((left, right) => left.name.localeCompare(right.name));
  if (!writeRecipes(recipes)) return;
  elements.recipeName.value = "";
  renderRecipes(name);
  showToast("Recipe saved locally");
}

function loadRecipe() {
  const recipe = readRecipes().find((candidate) => candidate.name === elements.recipeSelect.value);
  elements.deleteRecipeButton.disabled = !recipe;
  if (!recipe || !state.result) return;
  state.history.push(structuredClone(state.result.options));
  applyOptionsToControls(recipe.options);
  if (state.fileBytes) elements.encodingSelect.value = recipe.encoding ?? "auto";
  elements.exportProfile.value = recipe.exportProfile ?? "standard";
  runDiagnosis();
  showToast(`Loaded “${recipe.name}”`);
}

function deleteRecipe() {
  const name = elements.recipeSelect.value;
  if (!name) return;
  if (!window.confirm(`Delete the local recipe “${name}”?`)) return;
  if (!writeRecipes(readRecipes().filter((recipe) => recipe.name !== name))) return;
  renderRecipes();
  showToast(`Deleted “${name}”`);
}

function applyPreset() {
  if (!state.result) return;
  state.history.push(structuredClone(state.result.options));
  const preset = PRESETS[elements.presetSelect.value] ?? PRESETS.balanced;
  const headers = state.result.header.headers.map((header) => header.toLocaleLowerCase());
  const candidateIndex = preset.candidates
    .map((candidate) => headers.indexOf(candidate))
    .find((index) => index >= 0);
  for (const input of elements.duplicateKeyList.querySelectorAll("input")) input.checked = false;
  if (candidateIndex !== undefined) {
    const match = elements.duplicateKeyList.querySelector(`input[value="${candidateIndex}"]`);
    if (match) match.checked = true;
  }
  elements.duplicateToggle.checked = true;
  elements.trimToggle.checked = true;
  elements.emptyToggle.checked = true;
  runDiagnosis();
  showToast(
    candidateIndex === undefined && preset.candidates.length
      ? "Preset applied; no matching key column was found"
      : "Quick setup applied",
  );
}

function undoRepairs() {
  const previous = state.history.pop();
  if (!previous) return;
  applyOptionsToControls(previous);
  runDiagnosis();
  showToast("Previous repair settings restored");
}

elements.chooseFile.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files[0]));
elements.diagnoseButton.addEventListener("click", () => {
  setPastedSource();
  runDiagnosis({ scroll: true });
});
elements.repairButton.addEventListener("click", () => {
  runDiagnosis({ recordHistory: true });
  showToast("Repairs updated");
});
elements.sampleButton.addEventListener("click", () => {
  elements.csvInput.value = SAMPLE;
  setPastedSource("messy-sample.csv");
  runDiagnosis({ scroll: true });
});
elements.resetButton.addEventListener("click", () => {
  state.fileBytes = null;
  state.rawText = "";
  state.result = null;
  state.fileName = "pasted-data.csv";
  state.fileSize = null;
  state.history = [];
  elements.csvInput.value = "";
  elements.fileInput.value = "";
  elements.workspace.hidden = true;
  elements.csvInput.focus();
  window.scrollTo({ top: 0, behavior: "smooth" });
});
elements.beforeTab.addEventListener("click", () => {
  state.preview = "before";
  renderTabs();
  renderTable();
});
elements.afterTab.addEventListener("click", () => {
  state.preview = "after";
  renderTabs();
  renderTable();
});
elements.downloadButton.addEventListener("click", downloadResult);
elements.reportButton.addEventListener("click", downloadReport);
elements.copyButton.addEventListener("click", copyResult);
elements.exportProfile.addEventListener("change", renderExportSummary);
elements.presetSelect.addEventListener("change", applyPreset);
elements.undoButton.addEventListener("click", undoRepairs);
elements.saveRecipeButton.addEventListener("click", saveRecipe);
elements.recipeSelect.addEventListener("change", loadRecipe);
elements.deleteRecipeButton.addEventListener("click", deleteRecipe);
elements.duplicateToggle.addEventListener("change", () => {
  elements.duplicateKeySection.disabled = !elements.duplicateToggle.checked;
  for (const input of elements.duplicateKeyList.querySelectorAll("input"))
    input.disabled = !elements.duplicateToggle.checked;
});
elements.csvInput.addEventListener("input", () => {
  if (!state.fileBytes) return;
  state.fileBytes = null;
  elements.encodingSelect.disabled = true;
  state.encoding.label = "Browser text";
});

for (const eventName of ["dragenter", "dragover"]) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("dragging");
  });
}
elements.dropZone.addEventListener("drop", (event) => loadFile(event.dataTransfer.files[0]));

elements.encodingSelect.disabled = true;
renderRecipes();
