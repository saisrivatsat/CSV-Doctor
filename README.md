# CSV Doctor

Diagnose and repair messy CSV files without uploading them anywhere.

CSV Doctor is a dependency-free browser utility for the small data problems that block larger
workflows: unknown separators, rows that switch delimiters, missing or repeated headers, mixed
date formats, blank lines, and exact duplicate records. It shows every automatic repair in a
before/after review and exports a standard comma-separated file.

## Features

- Detects comma, semicolon, tab, and pipe separators
- Repairs individual rows that accidentally use a different supported separator
- Preserves quoted separators, escaped quotes, and multiline cells
- Detects whether the first row is a header
- Trims header labels, fills blank labels, and makes duplicate names unique
- Generates neutral column names when a file has no header
- Normalizes safe date values to `YYYY-MM-DD`
- Leaves ambiguous dates unchanged until the user chooses month-first or day-first
- Removes exact duplicate rows after cleanup while keeping the first copy
- Pads short rows instead of discarding their data and reports remaining structure warnings
- Warns about formula-like values before the export is opened in spreadsheet software
- Supports paste, file drop, before/after preview, copy, and download
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
- Formula-like values are reported but not rewritten because they may be intentional data.
- Duplicate removal is exact after enabled whitespace and date cleanup; fuzzy matching is out of scope.

## Project documents

- [Product brief](docs/PRODUCT.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing guide](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

[MIT](LICENSE)
