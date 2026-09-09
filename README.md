# CSV Doctor

Diagnose and repair messy CSV files without uploading them anywhere.

CSV Doctor is a dependency-free browser utility for the small data problems that block larger
workflows: unknown separators, old text encodings, damaged headers, mixed dates, risky IDs, blank
lines, and duplicate records. It shows automatic repairs in a before/after review and offers export
profiles for common destinations.

## Features

- Detects comma, semicolon, tab, and pipe separators
- Detects UTF-8, UTF-16, and Windows-1252 files, with a manual encoding override
- Repairs individual rows that accidentally use a different supported separator
- Preserves quoted separators, escaped quotes, and multiline cells
- Detects whether the first row is a header
- Trims header labels, fills blank labels, and makes duplicate names unique
- Generates neutral column names when a file has no header
- Normalizes safe date values to `YYYY-MM-DD`
- Leaves ambiguous dates unchanged until the user chooses month-first or day-first
- Removes exact duplicates or matches duplicates using selected key columns such as email, ID, or SKU
- Pads short rows instead of discarding their data and reports remaining structure warnings
- Highlights repaired headers and values and supports one-step undo
- Reports column fill rate, likely type, unique values, leading zeros, long IDs, and formula-like cells
- Includes quick setups for contacts, transactions, and product catalogs
- Saves reusable repair recipes locally; recipes contain settings only, never CSV contents
- Exports standard CSV, spreadsheet-safe CSV, semicolon CSV, or TSV
- Downloads a metadata-only JSON repair report for troubleshooting or audit notes
- Supports paste, file drop, before/after preview, copy, and download for files up to 10 MB
- Runs entirely in the browser with no backend, account, analytics, or external dependencies

## Run locally

CSV Doctor requires Node.js 20 or newer.

```sh
npm run dev
```

Open <http://127.0.0.1:4174>.

## Verify a change

```sh
npm run check
npm test
npm run build
```

## Deploy on Netlify

Import this repository into Netlify. The included `netlify.toml` defines the build command,
publish directory, Node version, security headers, and single-page fallback. No environment
variables are required.

## Repair principles

CSV Doctor favors preserving information over guessing:

- A row is only re-read with another delimiter when that produces the file's expected column count.
- Ambiguous numeric dates such as `04/05/2025` stay unchanged in automatic mode.
- Extra cells are retained, and short rows are padded with empty cells.
- Formula-like values are reported but only prefixed when the user selects the spreadsheet-safe export.
- Duplicate key matching is case-insensitive and keeps rows whose selected key fields are all blank.
- Leading-zero and long-integer warnings help protect ZIP codes, account numbers, and IDs from
  spreadsheet auto-formatting.

## Standards and safety notes

- Parsing follows the quoting and line-break conventions documented in [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180).
- Date output uses the calendar-date form from [ISO 8601](https://www.iso.org/iso-8601-date-and-time-format.html).
- The spreadsheet-safe profile mitigates [CSV formula injection](https://owasp.org/www-community/attacks/CSV_Injection) while leaving the standard export unchanged.

## Project documents

- [Product brief](docs/PRODUCT.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

[MIT](LICENSE)
