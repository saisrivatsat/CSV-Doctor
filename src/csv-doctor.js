const DELIMITER_OPTIONS = [
  { key: "comma", value: ",", label: "Comma" },
  { key: "semicolon", value: ";", label: "Semicolon" },
  { key: "tab", value: "\t", label: "Tab" },
  { key: "pipe", value: "|", label: "Pipe" },
];

const HEADER_WORDS = new Set([
  "address",
  "amount",
  "city",
  "company",
  "country",
  "created",
  "customer",
  "date",
  "description",
  "email",
  "first name",
  "id",
  "joined",
  "last name",
  "name",
  "order",
  "phone",
  "postal code",
  "price",
  "product",
  "quantity",
  "state",
  "status",
  "title",
  "total",
  "updated",
  "zip",
]);

const MONTHS = new Map([
  ["jan", 1],
  ["january", 1],
  ["feb", 2],
  ["february", 2],
  ["mar", 3],
  ["march", 3],
  ["apr", 4],
  ["april", 4],
  ["may", 5],
  ["jun", 6],
  ["june", 6],
  ["jul", 7],
  ["july", 7],
  ["aug", 8],
  ["august", 8],
  ["sep", 9],
  ["sept", 9],
  ["september", 9],
  ["oct", 10],
  ["october", 10],
  ["nov", 11],
  ["november", 11],
  ["dec", 12],
  ["december", 12],
]);

export const delimiters = DELIMITER_OPTIONS.map((option) => ({ ...option }));

function normalizeSource(text) {
  return String(text ?? "").replace(/^\uFEFF/, "");
}

function isBlankRow(row) {
  return row.every((cell) => String(cell).trim() === "");
}

function splitLogicalRecords(source) {
  const records = [];
  let record = "";
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (character === '"') {
      if (inQuotes && source[index + 1] === '"') {
        record += '""';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      record += character;
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      records.push({ text: record, line: recordLine });
      record = "";
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      line += 1;
      recordLine = line;
      continue;
    }

    if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      record += "\n";
      line += 1;
      continue;
    }

    record += character;
  }

  if (record !== "" || records.length === 0) records.push({ text: record, line: recordLine });

  return { records, unclosedQuote: inQuotes };
}

function parseRecord(record, delimiter) {
  const fields = [];
  const errors = [];
  let field = "";
  let inQuotes = false;
  let justClosedQuote = false;

  for (let index = 0; index < record.length; index += 1) {
    const character = record[index];

    if (inQuotes) {
      if (character === '"' && record[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        inQuotes = false;
        justClosedQuote = true;
      } else {
        field += character;
      }
      continue;
    }

    if (character === delimiter) {
      fields.push(field);
      field = "";
      justClosedQuote = false;
      continue;
    }

    if (character === '"' && field.trim() === "") {
      field = "";
      inQuotes = true;
      justClosedQuote = false;
      continue;
    }

    if (justClosedQuote && character.trim() !== "") {
      errors.push("Characters found after a closing quote");
    }

    field += character;
    justClosedQuote = false;
  }

  if (inQuotes) errors.push("Unclosed quoted field");
  fields.push(field);
  return { fields, errors };
}

function countOutsideQuotes(record, delimiter) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < record.length; index += 1) {
    if (record[index] === '"') {
      if (inQuotes && record[index + 1] === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (!inQuotes && record[index] === delimiter) {
      count += 1;
    }
  }

  return count;
}

function mode(values) {
  const counts = new Map();
  let winner = values[0] ?? 1;
  let winnerCount = 0;

  for (const value of values) {
    const count = (counts.get(value) ?? 0) + 1;
    counts.set(value, count);
    if (count > winnerCount || (count === winnerCount && value > winner)) {
      winner = value;
      winnerCount = count;
    }
  }

  return { value: winner, count: winnerCount };
}

function scoreDelimiter(records, delimiter) {
  const sample = records.filter((record) => record.text.trim() !== "").slice(0, 100);
  const parsed = sample.map((record) => parseRecord(record.text, delimiter));
  const widths = parsed.map((result) => result.fields.length);
  const commonWidth = mode(widths);
  const occurrences = sample.reduce(
    (sum, record) => sum + countOutsideQuotes(record.text, delimiter),
    0,
  );
  const parseErrors = parsed.reduce((sum, result) => sum + result.errors.length, 0);
  const consistency = sample.length ? commonWidth.count / sample.length : 0;
  const score =
    commonWidth.value > 1
      ? consistency * 100 + Math.min(commonWidth.value, 20) * 3 + Math.min(occurrences, 24) - parseErrors * 8
      : 0;

  return {
    consistency,
    expectedWidth: commonWidth.value,
    occurrences,
    score,
  };
}

export function detectDelimiter(text) {
  const source = normalizeSource(text);
  const { records } = splitLogicalRecords(source);
  const ranked = DELIMITER_OPTIONS.map((option) => ({
    ...option,
    ...scoreDelimiter(records, option.value),
  })).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const runnerUp = ranked[1];
  const gap = best.score - runnerUp.score;
  const confidence = best.score === 0 ? "low" : gap >= 30 ? "high" : gap >= 12 ? "medium" : "low";

  return { ...best, confidence, candidates: ranked };
}

function delimiterFromOption(option, source) {
  if (!option || option === "auto") return detectDelimiter(source);
  const match = DELIMITER_OPTIONS.find((candidate) => candidate.key === option || candidate.value === option);
  if (!match) throw new Error(`Unsupported delimiter option: ${option}`);
  const { records } = splitLogicalRecords(source);
  return {
    ...match,
    ...scoreDelimiter(records, match.value),
    confidence: "manual",
    candidates: [],
  };
}

function parseRows(source, delimiterResult, skipEmptyRows) {
  const split = splitLogicalRecords(source);
  const nonBlank = split.records.filter((record) => record.text.trim() !== "");
  const initialWidths = nonBlank.map(
    (record) => parseRecord(record.text, delimiterResult.value).fields.length,
  );
  const expectedWidth = Math.max(1, mode(initialWidths).value);
  const rows = [];
  const originalRows = [];
  const repairs = [];
  const problems = [];
  let blankRowsRemoved = 0;

  for (const record of split.records) {
    let parsed = parseRecord(record.text, delimiterResult.value);

    if (isBlankRow(parsed.fields) && skipEmptyRows) {
      blankRowsRemoved += 1;
      continue;
    }

    originalRows.push({ cells: [...parsed.fields], line: record.line });

    if (expectedWidth > 1 && parsed.fields.length === 1) {
      const alternate = DELIMITER_OPTIONS.filter(
        (option) => option.value !== delimiterResult.value,
      )
        .map((option) => ({ option, parsed: parseRecord(record.text, option.value) }))
        .find(
          (candidate) =>
            candidate.parsed.fields.length === expectedWidth &&
            candidate.parsed.errors.length === 0 &&
            countOutsideQuotes(record.text, candidate.option.value) > 0,
        );

      if (alternate) {
        parsed = alternate.parsed;
        repairs.push({
          line: record.line,
          from: alternate.option.label,
          to: delimiterResult.label,
        });
      }
    }

    if (parsed.fields.length !== expectedWidth) {
      problems.push({
        line: record.line,
        actual: parsed.fields.length,
        expected: expectedWidth,
      });
    }

    for (const error of parsed.errors) problems.push({ line: record.line, error });
    rows.push({ cells: parsed.fields, line: record.line });
  }

  return {
    blankRowsRemoved,
    expectedWidth,
    originalRows,
    problems,
    repairs,
    rows,
    unclosedQuote: split.unclosedQuote,
  };
}

function isNumber(value) {
  return /^[-+]?[$£€]?\d[\d,]*(?:\.\d+)?%?$/.test(value.trim());
}

function isBoolean(value) {
  return /^(?:true|false|yes|no)$/i.test(value.trim());
}

function validDate(year, month, day) {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isoDate(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDateValue(value, dateOrder = "auto") {
  const input = String(value).trim();
  if (!input) return null;

  let match = input.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match.map(Number);
    return validDate(year, month, day)
      ? { ambiguous: false, iso: isoDate(year, month, day) }
      : null;
  }

  match = input.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (match) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    let month;
    let day;
    let ambiguous = false;

    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    } else if (second > 12 && first <= 12) {
      month = first;
      day = second;
    } else if (first <= 12 && second <= 12) {
      ambiguous = first !== second;
      if (dateOrder === "auto" && ambiguous) return { ambiguous: true, iso: null };
      if (dateOrder === "dmy") {
        day = first;
        month = second;
      } else {
        month = first;
        day = second;
      }
    } else {
      return null;
    }

    return validDate(year, month, day)
      ? { ambiguous, iso: isoDate(year, month, day) }
      : null;
  }

  match = input.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (match) {
    const month = MONTHS.get(match[1].toLowerCase());
    const day = Number(match[2]);
    const year = Number(match[3]);
    return month && validDate(year, month, day)
      ? { ambiguous: false, iso: isoDate(year, month, day) }
      : null;
  }

  match = input.match(/^(\d{1,2})\s+([A-Za-z]+),?\s+(\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = MONTHS.get(match[2].toLowerCase());
    const year = Number(match[3]);
    return month && validDate(year, month, day)
      ? { ambiguous: false, iso: isoDate(year, month, day) }
      : null;
  }

  return null;
}

function dataType(value) {
  const trimmed = value.trim();
  if (!trimmed) return "empty";
  if (isNumber(trimmed)) return "number";
  if (isBoolean(trimmed)) return "boolean";
  if (parseDateValue(trimmed)) return "date";
  return "text";
}

export function detectHeader(rows) {
  if (!rows.length || isBlankRow(rows[0])) return false;
  const first = rows[0].map((value) => String(value).trim());
  const populated = first.filter(Boolean);
  if (!populated.length) return false;

  const firstDataLike = populated.filter((value) => dataType(value) !== "text").length;
  const uniqueRatio = new Set(populated.map((value) => value.toLowerCase())).size / populated.length;
  const wordMatches = populated.filter((value) => HEADER_WORDS.has(value.toLowerCase())).length;
  const identifierRatio =
    populated.filter((value) => /^[A-Za-z][A-Za-z0-9 _-]{0,40}$/.test(value)).length /
    populated.length;
  let typeContrast = 0;

  for (let column = 0; column < first.length; column += 1) {
    if (dataType(first[column]) !== "text") continue;
    const following = rows
      .slice(1, 8)
      .map((row) => dataType(String(row[column] ?? "")))
      .filter((type) => type !== "empty");
    if (following.length && following.filter((type) => type !== "text").length / following.length >= 0.6) {
      typeContrast += 1;
    }
  }

  let score = 0;
  if (firstDataLike === 0) score += 1.5;
  if (uniqueRatio >= 0.8) score += 0.5;
  if (identifierRatio >= 0.8) score += 0.75;
  score += Math.min(2, wordMatches * 1.25);
  score += Math.min(2, typeContrast);

  return score >= 2.75;
}

function repairHeaders(input, width) {
  const headers = [];
  const seen = new Map();
  const changes = [];

  for (let index = 0; index < width; index += 1) {
    const original = String(input[index] ?? "");
    let header = original.trim();
    if (!header) {
      header = `Column ${index + 1}`;
      changes.push(`Named blank column ${index + 1}`);
    } else if (header !== original) {
      changes.push(`Trimmed “${original}” to “${header}”`);
    }

    const key = header.toLowerCase();
    const occurrence = (seen.get(key) ?? 0) + 1;
    seen.set(key, occurrence);
    if (occurrence > 1) {
      const base = header;
      let suffix = occurrence;
      do {
        header = `${base} (${suffix})`;
        suffix += 1;
      } while (seen.has(header.toLowerCase()));
      seen.set(header.toLowerCase(), 1);
      changes.push(`Renamed duplicate “${base}” to “${header}”`);
    }
    headers.push(header);
  }

  return { changes, headers };
}

function normalizeWidth(rows, width) {
  return rows.map((row) => {
    const cells = [...row.cells];
    while (cells.length < width) cells.push("");
    return { ...row, cells };
  });
}

function normalizeDates(rows, headers, dateOrder) {
  const columns = [];
  let ambiguousCount = 0;
  let convertedCount = 0;
  const output = rows.map((row) => ({ ...row, cells: [...row.cells] }));

  for (let column = 0; column < headers.length; column += 1) {
    const values = output.map((row) => String(row.cells[column] ?? "")).filter((value) => value.trim());
    if (!values.length) continue;
    const parsed = values.map((value) => parseDateValue(value, dateOrder));
    const dateLikeCount = parsed.filter(Boolean).length;
    const minimum = Math.min(2, values.length);
    if (dateLikeCount < minimum || dateLikeCount / values.length < 0.6) continue;

    let columnConverted = 0;
    let columnAmbiguous = 0;
    for (const row of output) {
      const current = String(row.cells[column] ?? "");
      const result = parseDateValue(current, dateOrder);
      if (!result) continue;
      if (result.ambiguous && !result.iso) {
        columnAmbiguous += 1;
      } else if (result.iso && result.iso !== current.trim()) {
        row.cells[column] = result.iso;
        columnConverted += 1;
      }
    }

    ambiguousCount += columnAmbiguous;
    convertedCount += columnConverted;
    columns.push({
      ambiguous: columnAmbiguous,
      converted: columnConverted,
      index: column,
      name: headers[column],
    });
  }

  return { ambiguousCount, columns, convertedCount, rows: output };
}

function removeDuplicateRows(rows) {
  const seen = new Set();
  const output = [];
  const removedLines = [];

  for (const row of rows) {
    const key = JSON.stringify(row.cells);
    if (seen.has(key)) {
      removedLines.push(row.line);
    } else {
      seen.add(key);
      output.push(row);
    }
  }

  return { removedLines, rows: output };
}

function formulaLikeCells(rows) {
  const matches = [];
  for (const row of rows) {
    for (let column = 0; column < row.cells.length; column += 1) {
      if (/^[=+@]/.test(String(row.cells[column]).trim())) {
        matches.push({ column, line: row.line });
      }
    }
  }
  return matches;
}

function escapeCsvCell(value, delimiter) {
  const string = String(value ?? "");
  if (
    string.includes(delimiter) ||
    string.includes('"') ||
    string.includes("\n") ||
    string.includes("\r") ||
    /^\s|\s$/.test(string)
  ) {
    return `"${string.replaceAll('"', '""')}"`;
  }
  return string;
}

export function serializeCsv(rows, delimiter = ",") {
  return `${rows
    .map((row) => row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter))
    .join("\r\n")}\r\n`;
}

export function doctorCsv(text, userOptions = {}) {
  const source = normalizeSource(text);
  if (!source.trim()) throw new Error("Add CSV data before running the diagnosis.");

  const options = {
    dateOrder: "auto",
    delimiter: "auto",
    header: "auto",
    removeDuplicates: true,
    skipEmptyRows: true,
    trimWhitespace: true,
    ...userOptions,
  };
  const delimiter = delimiterFromOption(options.delimiter, source);
  const parsed = parseRows(source, delimiter, options.skipEmptyRows);
  if (!parsed.rows.length) throw new Error("No data rows were found.");

  const widestRow = Math.max(parsed.expectedWidth, ...parsed.rows.map((row) => row.cells.length));
  const normalizedRows = normalizeWidth(parsed.rows, widestRow);
  const beforeWidth = Math.max(widestRow, ...parsed.originalRows.map((row) => row.cells.length));
  const beforeRows = normalizeWidth(parsed.originalRows, beforeWidth).map((row) => [...row.cells]);
  const rawRows = normalizedRows.map((row) => ({ ...row, cells: [...row.cells] }));
  const headerDetected = detectHeader(rawRows.map((row) => row.cells));
  const hasHeader =
    options.header === "present" || (options.header === "auto" && headerDetected);
  const sourceHeader = hasHeader ? rawRows.shift().cells : [];
  const repairedHeaders = repairHeaders(sourceHeader, widestRow);
  const headerChanges = hasHeader
    ? repairedHeaders.changes
    : [`Generated ${widestRow} column name${widestRow === 1 ? "" : "s"}`];

  let workingRows = rawRows;
  let trimmedCells = 0;
  if (options.trimWhitespace) {
    workingRows = workingRows.map((row) => ({
      ...row,
      cells: row.cells.map((cell) => {
        const trimmed = String(cell).trim();
        if (trimmed !== cell) trimmedCells += 1;
        return trimmed;
      }),
    }));
  }

  const dateResult = normalizeDates(
    workingRows,
    repairedHeaders.headers,
    options.dateOrder,
  );
  workingRows = dateResult.rows;

  const duplicateResult = options.removeDuplicates
    ? removeDuplicateRows(workingRows)
    : { removedLines: [], rows: workingRows };
  workingRows = duplicateResult.rows;

  const formulaCells = formulaLikeCells(workingRows);
  const issues = [];
  if (parsed.repairs.length) {
    issues.push({
      detail: `${parsed.repairs.length} row${parsed.repairs.length === 1 ? " was" : "s were"} re-read with a different separator.`,
      severity: "fixed",
      title: "Mixed delimiters repaired",
      type: "delimiter",
    });
  }
  if (parsed.problems.length || parsed.unclosedQuote) {
    issues.push({
      detail: `${parsed.problems.length + (parsed.unclosedQuote ? 1 : 0)} structure warning${parsed.problems.length + (parsed.unclosedQuote ? 1 : 0) === 1 ? " needs" : "s need"} review. Data was preserved and shorter rows were padded.`,
      severity: "warning",
      title: "Uneven or malformed rows remain",
      type: "structure",
    });
  }
  if (headerChanges.length) {
    issues.push({
      detail: headerChanges.join("; "),
      severity: "fixed",
      title: hasHeader ? "Headers cleaned" : "Headers added",
      type: "header",
    });
  }
  if (dateResult.convertedCount) {
    issues.push({
      detail: `${dateResult.convertedCount} date value${dateResult.convertedCount === 1 ? " was" : "s were"} normalized to YYYY-MM-DD.`,
      severity: "fixed",
      title: "Dates standardized",
      type: "date",
    });
  }
  if (dateResult.ambiguousCount) {
    issues.push({
      detail: `${dateResult.ambiguousCount} value${dateResult.ambiguousCount === 1 ? " could" : "s could"} mean month/day or day/month. Choose a date order to fix them.`,
      severity: "warning",
      title: "Ambiguous dates left unchanged",
      type: "date",
    });
  }
  if (duplicateResult.removedLines.length) {
    issues.push({
      detail: `${duplicateResult.removedLines.length} repeated row${duplicateResult.removedLines.length === 1 ? " was" : "s were"} removed; the first copy was kept.`,
      severity: "fixed",
      title: "Exact duplicates removed",
      type: "duplicate",
    });
  }
  if (parsed.blankRowsRemoved) {
    issues.push({
      detail: `${parsed.blankRowsRemoved} empty row${parsed.blankRowsRemoved === 1 ? " was" : "s were"} removed.`,
      severity: "fixed",
      title: "Empty rows removed",
      type: "empty",
    });
  }
  if (formulaCells.length) {
    issues.push({
      detail: `${formulaCells.length} cell${formulaCells.length === 1 ? " starts" : "s start"} with =, +, or @. Review before opening the export in spreadsheet software.`,
      severity: "warning",
      title: "Formula-like values detected",
      type: "security",
    });
  }

  const outputRows = [repairedHeaders.headers, ...workingRows.map((row) => row.cells)];
  return {
    beforeRows,
    cleanedCsv: serializeCsv(outputRows),
    delimiter: {
      confidence: delimiter.confidence,
      key: delimiter.key,
      label: delimiter.label,
      repairedRows: parsed.repairs,
      value: delimiter.value,
    },
    duplicates: {
      removed: duplicateResult.removedLines.length,
      removedLines: duplicateResult.removedLines,
    },
    dates: dateResult,
    header: {
      changes: headerChanges,
      detected: headerDetected,
      generated: !hasHeader,
      headers: repairedHeaders.headers,
      repaired: repairedHeaders.changes.length,
    },
    issues,
    options,
    outputRows,
    rows: workingRows.map((row) => row.cells),
    shape: {
      blankRowsRemoved: parsed.blankRowsRemoved,
      columns: repairedHeaders.headers.length,
      inputRecords: parsed.rows.length,
      malformedRows: parsed.problems.length + (parsed.unclosedQuote ? 1 : 0),
      outputRows: workingRows.length,
      trimmedCells,
    },
  };
}
