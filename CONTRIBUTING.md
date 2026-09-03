# Contributing

Thank you for helping make CSV cleanup safer and clearer.

## Before proposing a change

- Start with a specific broken-file scenario or user problem.
- Add a small, synthetic fixture that contains no private data.
- Favor preserving data and reporting uncertainty over guessing.
- Keep production code dependency-free unless a dependency solves a measured correctness problem.

## Local workflow

```sh
npm install
npm run check
npm test
npm run build
```

Visible interface changes should include desktop and narrow-screen screenshots. Parser changes should
include tests for quoting, row width, and any ambiguity introduced by the new case.

## Pull requests

Explain the source problem, the repair rule, what remains intentionally unchanged, and how the change
was verified. Never commit real customer files, exported data, or other personal information.
