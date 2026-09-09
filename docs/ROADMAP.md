# Roadmap

CSV Doctor is intentionally small. New work should improve correctness, reviewability, or practical
interoperability rather than add unrelated data tools.

## 0.1 — Local repair MVP

- Automatic delimiter detection and mixed-row repair
- Header inference and repair
- Conservative date normalization with regional override
- Exact duplicate and empty-row cleanup
- Before/after preview, repair notes, copy, and download
- Responsive interface, tests, CI, and Netlify build

## 0.2 — Better diagnosis

- Per-cell change highlighting in the preview
- Downloadable repair report alongside the cleaned CSV
- Standard CSV, spreadsheet-safe CSV, semicolon CSV, and TSV export profiles
- Duplicate matching by selected key columns
- Column-level type, fill, uniqueness, leading-zero, long-ID, and formula-risk summary
- UTF-8, UTF-16, and Windows-1252 encoding repair
- Quick setups, local repair recipes, and undo

## 0.3 — Larger and repeatable work

- Streaming parsing for files larger than the current browser limit
- Batch processing without uploading data
- Import and export repair recipes as settings-only JSON
- Optional CSV dialect controls for quote and escape characters
- Column rename, reorder, and removal with a visible change plan
- Explicit column rules for required values, number ranges, email shape, and allowed categories

## Not planned for the core app

- Cloud file storage or accounts
- Server-side processing
- Silent guessing for ambiguous dates or malformed records
- Fuzzy duplicate deletion without an explicit review step
