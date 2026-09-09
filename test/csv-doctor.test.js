import test from "node:test";
import assert from "node:assert/strict";

import {
  createCsvExport,
  createRepairReport,
  decodeBytes,
  detectDelimiter,
  detectHeader,
  doctorCsv,
  parseDateValue,
  serializeCsv,
} from "../src/csv-doctor.js";

test("detects commas while ignoring commas inside quoted values", () => {
  const result = detectDelimiter('name,note\nAda,"Hello, world"\nGrace,"Still, good"');
  assert.equal(result.key, "comma");
  assert.equal(result.expectedWidth, 2);
  assert.equal(result.confidence, "high");
});

test("detects semicolon and tab separated files", () => {
  assert.equal(detectDelimiter("name;city\nAda;London\nGrace;New York").key, "semicolon");
  assert.equal(detectDelimiter("name\tcity\nAda\tLondon\nGrace\tNew York").key, "tab");
});

test("repairs a row that switches to a different delimiter", () => {
  const result = doctorCsv("name,email,date\nAda,a@example.com,03/14/2025\nGrace;g@example.com;15/04/2025");
  assert.equal(result.delimiter.key, "comma");
  assert.equal(result.delimiter.repairedRows.length, 1);
  assert.equal(result.beforeRows[2][0], "Grace;g@example.com;15/04/2025");
  assert.deepEqual(result.rows[1], ["Grace", "g@example.com", "2025-04-15"]);
});

test("parses quoted line breaks and escaped quotes", () => {
  const result = doctorCsv('name,note\nAda,"Line one\nLine two"\nGrace,"Said ""hello"""');
  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0][1], "Line one\nLine two");
  assert.equal(result.rows[1][1], 'Said "hello"');
  assert.match(result.cleanedCsv, /"Line one\nLine two"/);
});

test("detects likely headers and rejects a data-first row", () => {
  assert.equal(detectHeader([["name", "email", "joined"], ["Ada", "a@example.com", "2025-03-14"]]), true);
  assert.equal(detectHeader([["Ada", "a@example.com", "2025-03-14"], ["Grace", "g@example.com", "2025-04-15"]]), false);
});

test("fills blank headers, trims labels, and makes duplicate names unique", () => {
  const result = doctorCsv(" Name ,,Name\nAda,42,Ada");
  assert.deepEqual(result.header.headers, ["Name", "Column 2", "Name (2)"]);
  assert.equal(result.header.generated, false);
  assert.equal(result.header.repaired, 3);
});

test("generates headers when the first row contains data", () => {
  const result = doctorCsv("Ada,a@example.com,03/14/2025\nGrace,g@example.com,15/04/2025");
  assert.equal(result.header.generated, true);
  assert.deepEqual(result.header.headers, ["Column 1", "Column 2", "Column 3"]);
  assert.equal(result.rows.length, 2);
});

test("normalizes safe dates and leaves ambiguous dates unchanged by default", () => {
  const result = doctorCsv("name,joined\nAda,03/14/2025\nGrace,15/04/2025\nLinus,04/05/2025");
  assert.deepEqual(result.rows.map((row) => row[1]), ["2025-03-14", "2025-04-15", "04/05/2025"]);
  assert.equal(result.dates.convertedCount, 2);
  assert.equal(result.dates.ambiguousCount, 1);
});

test("uses an explicit day-first preference for ambiguous dates", () => {
  const result = doctorCsv("name,joined\nLinus,04/05/2025", { dateOrder: "dmy" });
  assert.equal(result.rows[0][1], "2025-05-04");
  assert.equal(result.dates.ambiguousCount, 0);
});

test("parses ISO and written dates without locale-dependent Date parsing", () => {
  assert.deepEqual(parseDateValue("2025-2-9"), { ambiguous: false, iso: "2025-02-09" });
  assert.deepEqual(parseDateValue("March 14, 2025"), { ambiguous: false, iso: "2025-03-14" });
  assert.deepEqual(parseDateValue("14 Mar 2025"), { ambiguous: false, iso: "2025-03-14" });
  assert.equal(parseDateValue("02/30/2025"), null);
});

test("removes exact duplicates after trimming and date repair", () => {
  const result = doctorCsv("name,date\nAda,03/14/2025\n Ada ,2025-03-14\nGrace,04/15/2025");
  assert.equal(result.duplicates.removed, 1);
  assert.equal(result.rows.length, 2);
});

test("can preserve duplicate and empty rows when cleanup is disabled", () => {
  const result = doctorCsv("name\nAda\n\nAda", {
    removeDuplicates: false,
    skipEmptyRows: false,
  });
  assert.deepEqual(result.rows, [["Ada"], [""], ["Ada"]]);
});

test("pads short malformed rows without discarding their data", () => {
  const result = doctorCsv("name,email,city\nAda,a@example.com,London\nGrace,g@example.com");
  assert.deepEqual(result.rows[1], ["Grace", "g@example.com", ""]);
  assert.equal(result.shape.malformedRows, 1);
});

test("warns about formula-like values but preserves them", () => {
  const result = doctorCsv("name,value\nAda,=2+2");
  assert.equal(result.rows[0][1], "=2+2");
  assert.ok(result.issues.some((issue) => issue.type === "security"));
});

test("serializes commas, quotes, newlines, and surrounding spaces safely", () => {
  const output = serializeCsv([["name", "note"], [" Ada ", 'A "quote", here']]);
  assert.equal(output, 'name,note\r\n" Ada ","A ""quote"", here"\r\n');
});

test("detects UTF-8, UTF-16, and Windows-1252 file encodings locally", () => {
  const utf8 = decodeBytes(new Uint8Array([0xef, 0xbb, 0xbf, 0x61, 0x2c, 0x62]));
  assert.equal(utf8.encoding, "utf-8");
  assert.equal(utf8.hadBom, true);
  assert.equal(utf8.text, "a,b");

  const utf16 = decodeBytes(
    Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from("a,b", "utf16le")]),
  );
  assert.equal(utf16.encoding, "utf-16le");
  assert.equal(utf16.text, "a,b");

  const windows = decodeBytes(new Uint8Array([0x70, 0x72, 0x69, 0x63, 0x65, 0x2c, 0x80]));
  assert.equal(windows.encoding, "windows-1252");
  assert.equal(windows.text, "price,€");
});

test("removes key-based duplicates case-insensitively but keeps blank keys", () => {
  const result = doctorCsv("name,email\nAda,A@example.com\nOther,a@example.com\nBlank,\nBlank,", {
    duplicateColumns: [1],
  });
  assert.equal(result.duplicates.removed, 1);
  assert.deepEqual(result.duplicates.columns, [1]);
  assert.deepEqual(result.rows, [["Ada", "A@example.com"], ["Blank", ""], ["Blank", ""]]);
});

test("profiles risky identifier and formula-like columns without altering values", () => {
  const result = doctorCsv(
    "Account ID,Amount,Note\n00123,-12.50,=REVIEW()\n1234567890123456,15,",
  );
  const id = result.columns.find((column) => column.name === "Account ID");
  const amount = result.columns.find((column) => column.name === "Amount");
  const note = result.columns.find((column) => column.name === "Note");
  assert.equal(id.leadingZeros, 1);
  assert.equal(id.longIntegers, 1);
  assert.equal(amount.formulas, 0);
  assert.equal(note.formulas, 1);
  assert.ok(note.warnings.includes("1 blank"));
});

test("records cell and header changes for review", () => {
  const result = doctorCsv(" Name ,Joined\n Ada ,03/14/2025");
  assert.deepEqual(result.header.changedIndexes, [0]);
  assert.ok(result.changes.some((change) => change.type === "whitespace" && change.column === 0));
  assert.ok(result.changes.some((change) => change.type === "date" && change.column === 1));
});

test("builds spreadsheet-safe and TSV export profiles", () => {
  const rows = [["name", "value"], ["Ada", "=2+2"]];
  const excel = createCsvExport(rows, "excel");
  assert.equal(excel.content, "\uFEFFname,value\r\nAda,'=2+2\r\n");
  assert.equal(excel.profile.extension, "csv");

  const tsv = createCsvExport(rows, "tsv");
  assert.equal(tsv.content, "name\tvalue\nAda\t=2+2\n");
  assert.equal(tsv.profile.extension, "tsv");
});

test("creates a metadata-only repair report without copying source records", () => {
  const result = doctorCsv(" Name ,email\n Ada ,ada@example.com");
  const report = createRepairReport(result, {
    fileName: "contacts.csv",
    generatedAt: "2026-09-09T00:00:00.000Z",
  });
  assert.equal(report.fileName, "contacts.csv");
  assert.equal(report.version, "0.2.0");
  assert.equal(report.shape.outputRows, 1);
  assert.equal(JSON.stringify(report).includes("ada@example.com"), false);
  assert.equal(JSON.stringify(report).includes("Ada"), false);
});
