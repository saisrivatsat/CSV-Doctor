# CSV Doctor product brief

## Problem

Small CSV defects often stop imports, reports, migrations, and analysis. People commonly receive a
file whose separator is unclear, whose first row is not usable as a header, whose dates mix regional
formats, or whose records repeat. Fixing those defects by hand is slow and risky, while uploading
business data to an unknown converter creates an avoidable privacy concern.

## Product promise

CSV Doctor turns a structurally messy text table into a reviewable, standard CSV entirely on the
user's device. It explains what it changed and asks for a human decision where the data is genuinely
ambiguous.

## MVP user journey

1. Drop a `.csv`, `.tsv`, or `.txt` file, or paste its contents.
2. Run a diagnosis using conservative automatic settings.
3. Review delimiter, header, date, duplicate, and structure findings.
4. Override delimiter, header presence, or ambiguous date order if necessary.
5. Compare the original interpretation with the repaired result.
6. Copy or download a comma-separated export.

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

### Dates

- Normalize ISO-like, unambiguous numeric, and English month-name dates to `YYYY-MM-DD`.
- Never use locale-dependent runtime date parsing.
- Leave month/day versus day/month values unchanged in automatic mode.
- Apply an explicit regional order only when the user selects it.

### Duplicates and structure

- Remove only exact duplicate rows after enabled cleanup.
- Keep the first copy.
- Preserve extra data columns and pad short records.
- Surface malformed quotes and uneven row widths for review.

## Privacy and trust

- File contents are read by browser APIs and never sent over a network.
- The app has no account, server, analytics, cookies, or local persistence.
- The content security policy blocks network connections in the deployed app.
- Exported CSV can contain formula-like values; the app warns without changing potentially valid data.

## MVP success criteria

- All core repair rules pass deterministic automated tests.
- A user can complete the workflow with keyboard controls on desktop and mobile widths.
- The interface clearly distinguishes fixed findings from warnings that need review.
- A production build deploys as a static Netlify site without environment variables.
