---
description: Transloco i18n conventions for the Angular webapp
paths:
  - "frontend/**/*.{ts,html,json}"
---

# Transloco i18n

## Overview

Webapp strings live in `frontend/projects/webapp/public/i18n/`, one catalog per language.
`fr.json` is the source: French is the default language and the fallback for any missing key.
The library is `@jsverse/transloco` v8+.

The arrested translation of each product term — and the register each language uses — lives in
`docs/I18N.md`. Do not restate it here or in a component.

## Key Naming

Use dot-notation camelCase: `domain.subDomain.key`

```
auth.login.title
auth.signup.submit
budget.loadError
common.cancel
form.emailRequired
```

## Template Usage

Import `TranslocoPipe` and use the `transloco` pipe:

```typescript
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  imports: [TranslocoPipe],
  template: `
    <h1>{{ 'auth.login.title' | transloco }}</h1>
    <button>{{ 'common.save' | transloco }}</button>
    <!-- With parameters -->
    <p>{{ 'budget.payDayHint' | transloco: { day: selectedDay() } }}</p>
  `,
})
```

## TypeScript Usage

Inject `TranslocoService` and use `translate()`:

```typescript
import { TranslocoService } from '@jsverse/transloco';

@Service()
export class MyService {
  readonly #transloco = inject(TranslocoService);

  getMessage(): string {
    return this.#transloco.translate('common.error');
  }

  getMessageWithParam(name: string): string {
    return this.#transloco.translate('budget.checkLabel', { name });
  }
}
```

## Test Setup

Always include `...provideTranslocoForTest()` in TestBed providers:

```typescript
import { provideTranslocoForTest } from '@app/testing/transloco-testing';

TestBed.configureTestingModule({
  providers: [
    ...provideTranslocoForTest(),
  ],
});
```

## JSON Structure

`public/i18n/fr.json` is organized by domain:

```json
{
  "common": { "save": "Enregistrer", "cancel": "Annuler" },
  "auth": {
    "login": { "title": "...", "submit": "..." },
    "signup": { "title": "...", "submit": "..." }
  },
  "budget": { "loadError": "..." },
  "form": { "emailRequired": "..." },
  "errors": { "generic": "..." }
}
```

## Rules

- **NEVER** hardcode strings in templates or TS files — always use transloco keys
- **ALWAYS** add a new key to all four catalogs, `fr.json` first — a key present only in
  `fr.json` renders the French text inside the German app, in production, silently
- Four catalogs (`fr`, `en`, `de`, `it`); `fr.json` is the source and the fallback
- Keys must be camelCase and descriptive
- Group by domain, not by component
- Use parameter interpolation `{{ param }}` for dynamic values
- Import `TranslocoPipe` in standalone component imports array — do NOT use `TranslocoModule`

## Infrastructure Files

- Loader: `src/app/core/i18n/transloco-loader.ts`
- Config: `src/app/core/i18n/transloco-config.ts` — exports `provideAppTransloco()`
- Provider registered in: `src/app/core/core.ts` via `...provideAppTransloco()`
- Test helper: `src/app/testing/transloco-testing.ts` — exports `provideTranslocoForTest()`
