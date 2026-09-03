# Security policy

## Supported version

Only the latest deployed version is supported.

## Data handling

CSV Doctor processes file contents in the browser. It has no backend, analytics, cookies, or local
persistence. The deployment policy blocks outbound connections, so data is not uploaded by the app.

CSV exports may contain cells beginning with `=`, `+`, or `@`. Some spreadsheet applications can
interpret those values as formulas. CSV Doctor reports them and preserves the original data; review
such values before opening an export in spreadsheet software or importing data from an untrusted
source.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature instead of opening a public issue. Include
reproduction steps, expected impact, and any suggested mitigation. Do not include private or real
customer data in a report.
