---
description: Angular webapp currency display - always route through shared helpers (AppCurrencyPipe, CURRENCY_METADATA.symbol, getCurrencyFormatter), never hand-roll `{{ value | number }} + {{ currency }}` concatenation. Load when editing components that render monetary amounts.
alwaysApply: false
---

# Webapp Currency Formatting

## Rule

NEVER hand-roll currency display in templates. Always route through a shared helper.

### In `feature/`, `pattern/`, `core/` layers

Use `AppCurrencyPipe` from `@core/currency` with 2 decimals:

```html
{{ value | appCurrency: currency() : '1.2-2' }}
```

This pipe wraps Angular's `CurrencyPipe` with `style: 'symbol'` + locale from `CURRENCY_METADATA`. Produces `1 234,56 €` for EUR/fr-FR, `CHF 1'234.56` for CHF/fr-CH.

### In `ui/` layer (cannot import `@core/`)

Two valid options:

1. **Formatted string via shared helper:**

```typescript
import { getCurrencyFormatter } from 'pulpe-shared';
protected readonly formatted = computed(() =>
  getCurrencyFormatter(this.currency()).format(this.amount()),
);
```

2. **Split typography (big number + small suffix)**, used when the hero design needs visual hierarchy:

```typescript
import { CURRENCY_METADATA, type SupportedCurrency } from 'pulpe-shared';

readonly currency = input<SupportedCurrency>('CHF');
protected readonly currencySymbol = computed(
  () => CURRENCY_METADATA[this.currency()].symbol,
);
```

```html
{{ amount() | number: '1.2-2' : locale() }}
<span class="text-small">{{ currencySymbol() }}</span>
```

## Anti-pattern (what broke before)

```html
<!-- ❌ Raw currency CODE as text suffix - produces "878,06 EUR" instead of "878,06 €" -->
{{ value | number: '1.2-2' : locale() }} {{ currency() }}

<!-- ❌ Inconsistent decimals across widgets for the same currency -->
{{ a | appCurrency: currency() : '1.0-0' }}   <!-- one widget -->
{{ b | appCurrency: currency() : '1.2-2' }}   <!-- another widget -->
```

## Always

- **2 decimals (`'1.2-2'`)** across dashboard, budget details, tables, pills, hero. Never 0-decimals `'1.0-0'` for visible amounts.
- **Symbol** in display (`€`, `CHF`) — never raw code `EUR` as text suffix.
- **Raw code** is fine in aria-labels — screen readers pronounce `EUR` clearer than `€`.

## Why

`CURRENCY_METADATA.symbol` is `€` for EUR, `CHF` for CHF — the canonical display. Angular's `CurrencyPipe` with `style: 'symbol'` and the locale from `CURRENCY_METADATA` already outputs `€ / CHF` correctly. Hand-rolling `{{ value | number }} + {{ currency }}` bypasses this and leaks the raw ISO code into the UI.

## Reference

- Shared helpers: `shared/src/currency.ts` (`CURRENCY_METADATA`), `shared/src/currency-format.ts` (`getCurrencyFormatter`)
- Core pipe: `frontend/projects/webapp/src/app/core/currency/app-currency.pipe.ts`
