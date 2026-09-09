# CSV Doctor product brief

## Problem

Small CSV defects often stop imports, reports, migrations, and analysis. People commonly receive a
file whose separator or encoding is unclear, whose first row is not usable as a header, whose dates
mix regional formats, whose identifiers are at risk of spreadsheet conversion, or whose records
repeat. Fixing those defects by hand is slow and risky, while uploading business data to an unknown
converter creates an avoidable privacy concern.

## Product promise

CSV Doctor turns a structurally messy text table into a reviewable, standard CSV entirely on the
user's device. It explains what it changed and asks for a human decision where the data is genuinely
ambiguous.

## MVP user journey

1. Drop a `.csv`, `.tsv`, or `.txt` file, or paste its contents.
2. Run a diagnosis using conservative automatic settings.
3. Review delimiter, encoding, header, date, duplicate, structure, and column-health findings.
4. Choose a quick setup, override uncertain rules, or select duplicate key columns.
5. Compare the original interpretation with highlighted repairs and undo when needed.
6. Save the settings as a local recipe for recurring files.
7. Copy or download the appropriate CSV/TSV profile and, when useful, a metadata-only repair report.

## Functional rules

### Delimiters

- Consider comma, semicolon, tab, and pipe.
- Prefer the delimiter that produces the most consistent multi-column records.
- Ignore delimiter characters inside quoted fields.
- Re-read a single-column outlier with another delimiter only when it matches the dominant width.

### Headers

- Infer header presence from label shape, common field names, uniqueness, and type contrast.
- Let the user explicitly override the inference.
- Trim labels, name blanks as `Column N`, and suffix duplicates as `Name (2)`.

### Encodings

- Auto-detect UTF-8, UTF-16 little-endian, UTF-16 big-endian, and Windows-1252 byte streams.
- Honor Unicode byte-order markers and allow a manual override for uncertain legacy files.
- Report replacement characters instead of silently claiming a clean decode.

### Dates

- Normalize ISO-like, unambiguous numeric, and English month-name dates to `YYYY-MM-DD`.
- Never use locale-dependent runtime date parsing.
- Leave month/day versus day/month values unchanged in automatic mode.
- Apply an explicit regional order only when the user selects it.

### Duplicates, identifiers, and structure

- Remove exact duplicate rows or compare an explicit set of selected key columns after cleanup.
- Keep the first copy.
- Compare selected keys case-insensitively, while preserving records with entirely blank keys.
- Preserve extra data columns and pad short records.
- Surface malformed quotes and uneven row widths for review.
- Warn when columns contain leading zeros, 16-plus-digit integers, or mixed data types.

### Repeatability and export

- Provide destination profiles for standard CSV, spreadsheet-safe CSV, semicolon CSV, and TSV.
- Prefix formula-like values only in the explicitly selected spreadsheet-safe profile.
- Keep a one-level history of applied rule changes and expose undo.
- Persist named recipes in browser storage; recipes contain rule selections only.
- Export a JSON report containing repair metadata and counts, not source row values.

## Privacy and trust

- File contents are read by browser APIs and never sent over a network.
- The app has no account, server, analytics, or cookies.
- Saved recipes use browser storage and contain settings only; CSV contents are never persisted.
- The content security policy blocks network connections in the deployed app.
- Standard exports preserve formula-like values; the spreadsheet-safe profile prefixes them.

## MVP success criteria

- All core repair rules pass deterministic automated tests.
- A user can complete the workflow with keyboard controls on desktop and mobile widths.
- The interface clearly distinguishes fixed findings from warnings that need review.
- A production build deploys as a static Netlify site without environment variables.
