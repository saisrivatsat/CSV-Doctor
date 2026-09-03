import { doctorCsv } from "./csv-doctor.js";

const SAMPLE = ` Name ,Email,Joined,Email
Ada,ada@example.com,03/14/2025,ada@example.com
Grace;grace@example.com;15/04/2025;grace@example.com
Ada,ada@example.com,03/14/2025,ada@example.com

Linus,linus@example.com,04/05/2025,linus@example.com`;

const state = {
  fileName: "pasted-data.csv",
  fileSize: null,
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
  delimiterDetail: document.querySelector("#delimiter-detail"),
  delimiterFinding: document.querySelector("#delimiter-finding"),
  delimiterSelect: document.querySelector("#delimiter-select"),
  diagnoseButton: document.querySelector("#diagnose-button"),
  downloadButton: document.querySelector("#download-button"),
  dropZone: document.querySelector("#drop-zone"),
  duplicateDetail: document.querySelector("#duplicate-detail"),
  duplicateFinding: document.querySelector("#duplicate-finding"),
  duplicateToggle: document.querySelector("#duplicate-toggle"),
  emptyToggle: document.querySelector("#empty-toggle"),
  exportSummary: document.querySelector("#export-summary"),
  fileInput: document.querySelector("#file-input"),
  fileMeta: document.querySelector("#file-meta"),
  fileName: document.querySelector("#file-name"),
  formError: document.querySelector("#form-error"),
  headerDetail: document.querySelector("#header-detail"),
  headerFinding: document.querySelector("#header-finding"),
  headerSelect: document.querySelector("#header-select"),
  issueCount: document.querySelector("#issue-count"),
  issueList: document.querySelector("#issue-list"),
  previewNote: document.querySelector("#preview-note"),
  previewTable: document.querySelector("#preview-table"),
  repairButton: document.querySelector("#repair-button"),
  resetButton: document.querySelector("#reset-button"),
  sampleButton: document.querySelector("#sample-button"),
  toast: document.querySelector("#toast"),
  trimToggle: document.querySelector("#trim-toggle"),
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

function optionsFromControls() {
  return {
    dateOrder: elements.dateOrder.value,
    delimiter: elements.delimiterSelect.value,
    header: elements.headerSelect.value,
    removeDuplicates: elements.duplicateToggle.checked,
    skipEmptyRows: elements.emptyToggle.checked,
    trimWhitespace: elements.trimToggle.checked,
  };
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

function runDiagnosis({ scroll = false } = {}) {
  const text = elements.csvInput.value;
  try {
    state.rawText = text;
    state.result = doctorCsv(text, optionsFromControls());
    setError();
    renderResult();
    elements.workspace.hidden = false;
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
    ? `${plural(dates.columns.length, "date column")}`
    : "No date columns";
  elements.dateDetail.textContent = dates.ambiguousCount
    ? `${dates.convertedCount} fixed, ${dates.ambiguousCount} ${dates.ambiguousCount === 1 ? "needs" : "need"} review`
    : dates.convertedCount
      ? `${plural(dates.convertedCount, "value")} standardized`
      : "Nothing changed";

  elements.duplicateFinding.textContent = duplicates.removed
    ? `${plural(duplicates.removed, "duplicate")} removed`
    : "No duplicates";
  elements.duplicateDetail.textContent = duplicates.removed
    ? "First copy kept"
    : "All rows are unique";

  elements.fileName.textContent = state.fileName;
  elements.fileMeta.textContent = `${formatBytes(state.fileSize)} · ${plural(shape.inputRecords, "record")}`;
  elements.exportSummary.textContent = `${plural(shape.outputRows, "data row")} across ${plural(shape.columns, "column")}, standardized as comma-separated CSV.`;
}

function cell(text, tagName = "td") {
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
  for (const header of headers.slice(0, visibleColumns)) {
    const headerCell = cell(header, "th");
    headerCell.scope = "col";
    headRow.append(headerCell);
  }
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
    for (const value of row.slice(0, visibleColumns)) tableRow.append(cell(value));
    body.append(tableRow);
  });
  elements.previewTable.append(body);

  const rowCount = after ? state.result.shape.outputRows : state.result.shape.inputRecords;
  const rowLabel = after ? plural(rowCount, "data row") : plural(rowCount, "source record");
  const notes = [`Showing ${Math.min(dataRows.length, rowCount)} of ${rowLabel}`];
  if (totalColumns > visibleColumns) notes.push(`${totalColumns - visibleColumns} more columns available in export`);
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

function renderTabs() {
  const after = state.preview === "after";
  elements.afterTab.setAttribute("aria-selected", String(after));
  elements.beforeTab.setAttribute("aria-selected", String(!after));
}

function renderResult() {
  renderFindings();
  renderTabs();
  renderTable();
  renderIssues();
}

async function loadFile(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) {
    setError("That file is larger than 10 MB. Try a smaller CSV.");
    return;
  }
  const text = await file.text();
  state.fileName = file.name || "data.csv";
  state.fileSize = file.size;
  elements.csvInput.value = text;
  runDiagnosis({ scroll: true });
}

function cleanedFileName() {
  const base = state.fileName.replace(/\.(?:csv|tsv|txt)$/i, "") || "data";
  return `${base}-cleaned.csv`;
}

function downloadResult() {
  if (!state.result) return;
  const blob = new Blob([state.result.cleanedCsv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = cleanedFileName();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Cleaned CSV downloaded");
}

async function copyResult() {
  if (!state.result) return;
  try {
    await navigator.clipboard.writeText(state.result.cleanedCsv);
    showToast("Cleaned CSV copied");
  } catch {
    const helper = document.createElement("textarea");
    helper.value = state.result.cleanedCsv;
    helper.className = "clipboard-helper";
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
    showToast("Cleaned CSV copied");
  }
}

elements.chooseFile.addEventListener("click", () => elements.fileInput.click());
elements.fileInput.addEventListener("change", () => loadFile(elements.fileInput.files[0]));
elements.diagnoseButton.addEventListener("click", () => {
  state.fileName = "pasted-data.csv";
  state.fileSize = new Blob([elements.csvInput.value]).size;
  runDiagnosis({ scroll: true });
});
elements.repairButton.addEventListener("click", () => {
  runDiagnosis();
  showToast("Repairs updated");
});
elements.sampleButton.addEventListener("click", () => {
  elements.csvInput.value = SAMPLE;
  state.fileName = "messy-sample.csv";
  state.fileSize = new Blob([SAMPLE]).size;
  runDiagnosis({ scroll: true });
});
elements.resetButton.addEventListener("click", () => {
  state.rawText = "";
  state.result = null;
  state.fileName = "pasted-data.csv";
  state.fileSize = null;
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
elements.copyButton.addEventListener("click", copyResult);

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
