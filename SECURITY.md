# Security policy

## Supported version

Only the latest deployed version is supported.

## Data handling

CSV Doctor processes file contents in the browser. It has no backend, analytics, or cookies. The
deployment policy blocks outbound connections, so file data is not uploaded by the app. Named repair
recipes use browser storage, but contain only selected rules and export preferences—not file names,
cell values, or CSV contents.

Standard CSV exports may contain cells beginning with `=`, `+`, `-`, or `@`. Some spreadsheet
applications can interpret those values as formulas. CSV Doctor reports them and preserves the
original data. Its spreadsheet-safe profile prefixes formula-like values with an apostrophe, but
users should still review untrusted data before opening it in spreadsheet software.

The repair report contains findings, counts, column names, and change metadata. It does not include
source rows or cell values, although file and column names can themselves be sensitive.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature instead of opening a public issue. Include
reproduction steps, expected impact, and any suggested mitigation. Do not include private or real
customer data in a report.
