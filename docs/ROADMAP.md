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
- Configurable output delimiter and line ending
- Duplicate matching by selected key columns
- Column-level data type summary and invalid-value counts

## 0.3 — Larger and repeatable work

- Streaming parsing for files larger than the current browser limit
- Save and import repair recipes locally
- Batch processing without uploading data
- Optional CSV dialect controls for quote and escape characters

## Not planned for the core app

- Cloud file storage or accounts
- Server-side processing
- Silent guessing for ambiguous dates or malformed records
- Fuzzy duplicate deletion without an explicit review step
