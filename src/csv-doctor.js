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

export const exportProfiles = [
  {
    key: "standard",
    label: "Standard CSV",
    delimiter: ",",
    lineEnding: "\r\n",
    bom: false,
    protectFormulas: false,
    extension: "csv",
  },
  {
    key: "excel",
    label: "Spreadsheet-safe CSV",
    delimiter: ",",
    lineEnding: "\r\n",
    bom: true,
    protectFormulas: true,
    extension: "csv",
  },
  {
    key: "semicolon",
    label: "Semicolon CSV",
    delimiter: ";",
    lineEnding: "\r\n",
    bom: false,
    protectFormulas: false,
    extension: "csv",
  },
  {
    key: "tsv",
    label: "Tab-separated TSV",
    delimiter: "\t",
    lineEnding: "\n",
    bom: false,
    protectFormulas: false,
    extension: "tsv",
  },
];

const ENCODING_LABELS = {
  "utf-8": "UTF-8",
  "utf-16le": "UTF-16 LE",
  "utf-16be": "UTF-16 BE",
  "windows-1252": "Windows-1252",
};

const WINDOWS_1252_SPECIALS = [
  "€", "\u0081", "‚", "ƒ", "„", "…", "†", "‡",
  "ˆ", "‰", "Š", "‹", "Œ", "\u008D", "Ž", "\u008F",
  "\u0090", "‘", "’", "“", "”", "•", "–", "—",
  "˜", "™", "š", "›", "œ", "\u009D", "ž", "Ÿ",
];

function decodeWindows1252(bytes) {
  return Array.from(bytes, (byte) => {
    if (byte >= 0x80 && byte <= 0x9f) return WINDOWS_1252_SPECIALS[byte - 0x80];
    return String.fromCodePoint(byte);
  }).join("");
}

export function decodeBytes(input, requestedEncoding = "auto") {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let encoding = requestedEncoding;
  let bomLength = 0;
  let confidence = requestedEncoding === "auto" ? "medium" : "manual";

  if (requestedEncoding === "auto") {
    if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      encoding = "utf-8";
      bomLength = 3;
      confidence = "high";
    } else if (bytes[0] === 0xff && bytes[1] === 0xfe) {
      encoding = "utf-16le";
      bomLength = 2;
      confidence = "high";
    } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      encoding = "utf-16be";
      bomLength = 2;
      confidence = "high";
    } else {
      const sampleLength = Math.min(bytes.length, 2000);
      let evenNulls = 0;
      let oddNulls = 0;
      for (let index = 0; index < sampleLength; index += 1) {
        if (bytes[index] === 0) {
          if (index % 2 === 0) evenNulls += 1;
          else oddNulls += 1;
        }
      }

      if (oddNulls > sampleLength * 0.2 && evenNulls < sampleLength * 0.05) {
        encoding = "utf-16le";
        confidence = "medium";
      } else if (evenNulls > sampleLength * 0.2 && oddNulls < sampleLength * 0.05) {
        encoding = "utf-16be";
        confidence = "medium";
      } else {
        try {
          new TextDecoder("utf-8", { fatal: true }).decode(bytes);
          encoding = "utf-8";
          confidence = "high";
        } catch {
          encoding = "windows-1252";
          confidence = "medium";
        }
      }
    }
  }

  if (!ENCODING_LABELS[encoding]) throw new Error(`Unsupported encoding: ${encoding}`);
  const contentBytes = bytes.slice(bomLength);
  const decoded = (encoding === "windows-1252"
    ? decodeWindows1252(contentBytes)
    : new TextDecoder(encoding).decode(contentBytes)
  ).replace(/^\uFEFF/, "");
  const replacements = [...decoded].filter((character) => character === "\uFFFD").length;

  return {
    confidence,
    encoding,
    hadBom: bomLength > 0,
    label: ENCODING_LABELS[encoding],
    replacements,
    text: decoded,
  };
}

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
  const changedIndexes = [];

  for (let index = 0; index < width; index += 1) {
    const original = String(input[index] ?? "");
    let header = original.trim();
    if (!header) {
      header = `Column ${index + 1}`;
      changes.push(`Named blank column ${index + 1}`);
      changedIndexes.push(index);
    } else if (header !== original) {
      changes.push(`Trimmed “${original}” to “${header}”`);
      changedIndexes.push(index);
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
      changedIndexes.push(index);
    }
    headers.push(header);
  }

  return { changedIndexes: [...new Set(changedIndexes)], changes, headers };
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
  const changes = [];
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
        changes.push({
          column,
          from: current,
          line: row.line,
          to: result.iso,
          type: "date",
        });
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

  return { ambiguousCount, changes, columns, convertedCount, rows: output };
}

function removeDuplicateRows(rows, requestedColumns = []) {
  const seen = new Set();
  const output = [];
  const removedLines = [];
  const requested = Array.isArray(requestedColumns) ? requestedColumns : [];
  const columns = [...new Set(requested.map(Number).filter(Number.isInteger))];

  for (const row of rows) {
    const selected = columns.length ? columns.map((column) => row.cells[column] ?? "") : row.cells;
    const normalized = columns.length
      ? selected.map((value) => String(value).trim().toLocaleLowerCase())
      : selected;
    if (columns.length && normalized.every((value) => value === "")) {
      output.push(row);
      continue;
    }
    const key = JSON.stringify(normalized);
    if (seen.has(key)) {
      removedLines.push(row.line);
    } else {
      seen.add(key);
      output.push(row);
    }
  }

  return { columns, removedLines, rows: output };
}

function isFormulaLike(value) {
  const text = String(value);
  if (/^[+-]\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(text)) return false;
  return /^[=+\-@\t\r\n]/.test(text);
}

function formulaLikeCells(rows) {
  const matches = [];
  for (const row of rows) {
    for (let column = 0; column < row.cells.length; column += 1) {
      if (isFormulaLike(String(row.cells[column]).trim())) {
        matches.push({ column, line: row.line });
      }
    }
  }
  return matches;
}

function escapeCsvCell(value, delimiter, protectFormulas = false) {
  let string = String(value ?? "");
  if (protectFormulas && isFormulaLike(string.trimStart())) string = `'${string}`;
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

export function serializeCsv(rows, delimiter = ",", userOptions = {}) {
  const options = {
    bom: false,
    lineEnding: "\r\n",
    protectFormulas: false,
    ...userOptions,
  };
  const output = `${rows
    .map((row) =>
      row.map((cell) => escapeCsvCell(cell, delimiter, options.protectFormulas)).join(delimiter),
    )
    .join(options.lineEnding)}${options.lineEnding}`;
  return `${options.bom ? "\uFEFF" : ""}${output}`;
}

export function createCsvExport(rows, profileKey = "standard") {
  const profile = exportProfiles.find((candidate) => candidate.key === profileKey);
  if (!profile) throw new Error(`Unsupported export profile: ${profileKey}`);
  return {
    content: serializeCsv(rows, profile.delimiter, profile),
    profile: { ...profile },
  };
}

function profileColumns(rows, headers) {
  return headers.map((name, column) => {
    const values = rows.map((row) => String(row.cells[column] ?? ""));
    const populated = values.filter((value) => value !== "");
    const typeCounts = new Map();
    for (const value of populated) {
      const type = dataType(value);
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
    }
    const rankedTypes = [...typeCounts.entries()].sort((left, right) => right[1] - left[1]);
    const leadingZeros = populated.filter((value) => /^0\d{2,}$/.test(value)).length;
    const longIntegers = populated.filter((value) => /^[+-]?\d{16,}$/.test(value)).length;
    const formulas = populated.filter((value) => isFormulaLike(value.trim())).length;
    const unique = new Set(populated.map((value) => value.toLocaleLowerCase())).size;
    const warnings = [];
    if (values.length - populated.length) warnings.push(`${values.length - populated.length} blank`);
    if (rankedTypes.length > 1) warnings.push("mixed types");
    if (leadingZeros) warnings.push(`${leadingZeros} leading zero`);
    if (longIntegers) warnings.push(`${longIntegers} long ID`);
    if (formulas) warnings.push(`${formulas} formula-like`);

    return {
      column,
      fillRate: values.length ? Math.round((populated.length / values.length) * 100) : 0,
      formulas,
      leadingZeros,
      longIntegers,
      name,
      primaryType: rankedTypes[0]?.[0] ?? "empty",
      typeCounts: Object.fromEntries(rankedTypes),
      unique,
      warnings,
    };
  });
}

export function createRepairReport(result, metadata = {}) {
  return {
    product: "CSV Doctor",
    version: "0.2.0",
    fileName: metadata.fileName ?? null,
    generatedAt: metadata.generatedAt ?? null,
    delimiter: result.delimiter,
    header: {
      changes: result.header.changes,
      detected: result.header.detected,
      generated: result.header.generated,
      headers: result.header.headers,
    },
    dates: {
      ambiguousCount: result.dates.ambiguousCount,
      columns: result.dates.columns,
      convertedCount: result.dates.convertedCount,
    },
    duplicates: result.duplicates,
    shape: result.shape,
    columns: result.columns,
    issues: result.issues,
    changes: result.changes.map(({ column, line, type }) => ({ column, line, type })),
  };
}

export function doctorCsv(text, userOptions = {}) {
  const source = normalizeSource(text);
  if (!source.trim()) throw new Error("Add CSV data before running the diagnosis.");

  const options = {
    dateOrder: "auto",
    delimiter: "auto",
    duplicateColumns: [],
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
  const cellChanges = [];
  if (options.trimWhitespace) {
    workingRows = workingRows.map((row) => ({
      ...row,
      cells: row.cells.map((cell, column) => {
        const trimmed = String(cell).trim();
        if (trimmed !== cell) {
          trimmedCells += 1;
          cellChanges.push({
            column,
            from: cell,
            line: row.line,
            to: trimmed,
            type: "whitespace",
          });
        }
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
  cellChanges.push(...dateResult.changes);

  const duplicateResult = options.removeDuplicates
    ? removeDuplicateRows(workingRows, options.duplicateColumns)
    : { columns: [], removedLines: [], rows: workingRows };
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
    const duplicateLabels = duplicateResult.columns.map(
      (column) => repairedHeaders.headers[column] ?? `Column ${column + 1}`,
    );
    issues.push({
      detail: `${duplicateResult.removedLines.length} repeated row${duplicateResult.removedLines.length === 1 ? " was" : "s were"} removed${duplicateLabels.length ? ` using ${duplicateLabels.join(", ")}` : ""}; the first copy was kept.`,
      severity: "fixed",
      title: duplicateLabels.length ? "Key-based duplicates removed" : "Exact duplicates removed",
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
      detail: `${formulaCells.length} cell${formulaCells.length === 1 ? " starts" : "s start"} with a spreadsheet formula character. Review it or choose the spreadsheet-safe export.`,
      severity: "warning",
      title: "Formula-like values detected",
      type: "security",
    });
  }

  const outputRows = [repairedHeaders.headers, ...workingRows.map((row) => row.cells)];
  const delimiterChanges = parsed.repairs.flatMap((repair) => {
    const row = workingRows.find((candidate) => candidate.line === repair.line);
    return row
      ? row.cells.map((value, column) => ({
          column,
          from: null,
          line: repair.line,
          to: value,
          type: "delimiter",
        }))
      : [];
  });
  const changes = [...delimiterChanges, ...cellChanges].filter((change) =>
    workingRows.some((row) => row.line === change.line),
  );
  const columns = profileColumns(workingRows, repairedHeaders.headers);
  return {
    beforeRows,
    changes,
    cleanedCsv: serializeCsv(outputRows),
    columns,
    delimiter: {
      confidence: delimiter.confidence,
      key: delimiter.key,
      label: delimiter.label,
      repairedRows: parsed.repairs,
      value: delimiter.value,
    },
    duplicates: {
      columns: duplicateResult.columns,
      removed: duplicateResult.removedLines.length,
      removedLines: duplicateResult.removedLines,
    },
    dates: dateResult,
    header: {
      changes: headerChanges,
      detected: headerDetected,
      generated: !hasHeader,
      headers: repairedHeaders.headers,
      changedIndexes: hasHeader
        ? repairedHeaders.changedIndexes
        : repairedHeaders.headers.map((_, index) => index),
      repaired: repairedHeaders.changes.length,
    },
    issues,
    options,
    outputRows,
    rows: workingRows.map((row) => row.cells),
    rowLines: workingRows.map((row) => row.line),
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
