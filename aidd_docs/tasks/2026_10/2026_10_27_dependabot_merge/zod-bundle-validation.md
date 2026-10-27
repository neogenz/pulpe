# Zod 4.6.6 bundle validation

Measured on 2026-10-27 with Node.js 24.22.1, Angular 22.2.1, identical generated frontend configuration and production builds.

Baseline: `main` at `66d267a2f` (Zod 4.1.13). Candidate application source: PR #832 at `89fd00f96` (Zod 4.6.6).

Command, run from `frontend/` for both revisions:

```sh
pnpm exec ng build --stats-json
```

| Measurement                                                 |  Baseline | Candidate |
| ----------------------------------------------------------- | --------: | --------: |
| Initial bundle, raw (rounded)                               |   1.16 MB |   1.20 MB |
| Initial bundle, Angular estimated transfer                  | 256.66 kB | 266.77 kB |
| `main-*.js`, raw bytes                                      | 1,029,362 | 1,068,910 |
| `main-*.js`, gzip bytes                                     |   285,635 |   297,185 |
| Zod contribution across output chunks, raw bytes from stats |    64,399 |   102,620 |

The estimated initial transfer increases by 10.11 kB (about 3.9%). Both builds pass the configured initial-bundle budgets: 1.25 MB warning and 1.5 MB error. The full initial bundle measurement includes shared startup chunks; the entrypoint measurement above also records the requested `main.js` comparison.
