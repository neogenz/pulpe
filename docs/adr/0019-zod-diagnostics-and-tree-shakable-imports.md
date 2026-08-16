# 0019 — Keep Zod diagnostics English with tree-shakable imports

**Status:** Accepted
**Date:** 2026-08-15
**Deciders:** Pulpe team

## Context

Pulpe localizes product-facing copy in French, English, German, and Italian. Zod errors are
technical diagnostics used at validation boundaries; they are not product copy.

With the accepted Zod 4.1 and esbuild versions, `import { z } from 'zod'` retained all 48 Zod
locale modules in the Angular initial bundle. The measured production build was 1.37 MB.
`import * as z from 'zod'` retained only Zod's default English locale and reduced the same
initial bundle to 1.14 MB without changing schema behavior.

## Decision

- Frontend and shared runtime schemas use `import * as z from 'zod'`.
- Zod keeps its default English diagnostics; application code does not configure or import
  Zod locales.
- Raw Zod diagnostics are never product copy. User-visible validation messages come from the
  localized product layer.
- ESLint rejects the named runtime import in Angular, and a unit test pins the default error
  language.
- After a Zod or esbuild upgrade, rebuild Angular with `--stats-json` and verify locale-module
  attribution before changing the bundle budget.

## Consequences

- The browser ships one small default locale instead of every Zod locale.
- Technical logs and diagnostics stay consistently English across product locales.
- Product translations remain independent from library wording.
- The import form is partly motivated by current bundler behavior. Future dependency upgrades
  require measurement rather than assuming the same tree-shaking result.
- Zod may revise exact English wording; tests assert the language and meaning, not the complete
  sentence.

## Alternatives considered

The named `z` export was rejected because it retained unused locales. Configuring Zod from the
active product locale was rejected because technical diagnostics are not user-facing copy and
would couple validation internals to UI language. Explicitly configuring English was rejected
because English is already the default and the extra locale import adds no behavior.

## References

- `.claude/rules/03-frameworks-and-libraries/3-zod@4-runtime-imports.md`
- `frontend/eslint.config.js`
- `shared/src/api-response.spec.ts`
- `frontend/angular.json`
- `aidd_docs/tasks/2026_08/2026_08_15_audit/performance.md`
- ADR-0009
