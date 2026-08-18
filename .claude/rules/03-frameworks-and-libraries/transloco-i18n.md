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

## Dates and Plurals

The two defects no gate catches. A frozen locale and a hardcoded plural both compile, lint,
build and test clean: `budget-list.mapper.ts` imported `frCH` from `date-fns/locale` while
`year-calendar.ts` interpolated `'budget'` / `'budgets'` into its template, and `ng build`,
`pnpm quality`, the unit suite and `pnpm test:lexicon` were all green with both live. A German
screenshot was the only thing that saw them.

Dates follow the interface language (`docs/I18N.md`) and `LOCALE_ID` is its only injection
point. `core/locale.ts` is the one file allowed to name a `date-fns` locale, because it *is*
the language → locale map and it feeds `MAT_DATE_LOCALE`. Everywhere else, inject `LOCALE_ID`
and thread it down to whatever formats — never a literal handed to `Intl`, never a second
import from `date-fns/locale`:

```typescript
readonly #locale = inject(LOCALE_ID);
// …handed to the mapper, which formats with it and nothing else
new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
```

A count-dependent string is a `…One` / `…Many` key pair picked by a `count === 1` ternary. No
ICU plugin is installed, and all four languages sit in CLDR `one` / `other`, so this ternary is
the plural mechanism:

```html
{{
  (n === 1 ? 'yearCalendar.budgetCountOne' : 'yearCalendar.budgetCountMany')
    | transloco: { count: n }
}}
```

## Rules

- **NEVER** hardcode strings in templates or TS files — always use transloco keys
- **NEVER** hardcode a locale — inject `LOCALE_ID`, per *Dates and Plurals* above
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
