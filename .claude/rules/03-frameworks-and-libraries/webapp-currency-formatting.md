---
description: Angular webapp currency display - dual policy aggregation (entiers '1.0-0') vs ligne ('1.2-2') via AppCurrencyPipe / CURRENCY_METADATA. Symbole `€`/`CHF` toujours, jamais raw code text. Load when editing components that render monetary amounts.
alwaysApply: false
---

# Webapp Currency Formatting

## Rule

NEVER hand-roll currency display in templates. Always route through a shared helper. Apply the dual decimal policy below.

## Decimal policy (aggregation vs ligne)

| Catégorie | Décimales | digitsInfo | Exemples |
|-----------|-----------|------------|----------|
| **AGGREGATION** | 0 | `'1.0-0'` | hero `disponible`, hero `solde du mois`, pills `Revenus/Dépenses/Épargne`, totaux dashboard, soldes/balances, `consumed` total enveloppe, `remaining` enveloppe, `cumulativeBalance` table, `exceededBy`, cartes mois liste, totaux templates, soldes balance sheet |
| **LIGNE** | 2 | `'1.2-2'` | montant prévu d'une `budget_line` individuelle, montant d'une `transaction` individuelle, ligne table `Prévu` |
| **aria-label / VoiceOver** | n/a | `code` ISO (`EUR`/`CHF`) en raw text | accessibility uniquement — lecteurs d'écran prononcent `EUR` plus clairement que `€` |

> **Heuristique**: si le montant est une **somme**, un **total** ou un **solde dérivé** (`amount - consumed`, `consumption.consumed`, `consumption.remaining`, etc.) → aggregation `'1.0-0'`. Si c'est la valeur **directement portée par une seule entité** (un `budget_line.amount`, un `transaction.amount`) → ligne `'1.2-2'`.

## In `feature/`, `pattern/`, `core/` layers

Use `AppCurrencyPipe` from `@core/currency` with the right digitsInfo:

```html
<!-- Aggregation: hero, pills, totaux, soldes -->
{{ totalAmount | appCurrency: currency() : '1.0-0' }}

<!-- Ligne: budget_line / transaction individuelle -->
{{ line.amount | appCurrency: currency() : '1.2-2' }}
```

This pipe wraps Angular's `CurrencyPipe` with `style: 'symbol'` + locale from `CURRENCY_CONFIG`. Produces:
- Aggregation EUR/fr-FR: `1 235 €`
- Aggregation CHF/fr-CH: `CHF 1'235`
- Ligne EUR/fr-FR: `1 234,56 €`
- Ligne CHF/fr-CH: `CHF 1'234.56`

## In `ui/` layer (cannot import `@core/`)

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
<!-- Aggregation hero: 0 décimales -->
{{ amount() | number: '1.0-0' : locale() }}
<span class="text-small">{{ currencySymbol() }}</span>
```

For aggregations in the `ui/` layer, use `'1.0-0'`. For lines in the `ui/` layer (rare — most line displays live in `feature/`), use `'1.2-2'`.

## Anti-patterns

```html
<!-- ❌ Raw currency CODE as text suffix - produces "878 EUR" instead of "878 €" -->
{{ value | number: '1.0-0' : locale() }} {{ currency() }}

<!-- ❌ Wrong digitsInfo for category — aggregation in 1.2-2 -->
{{ totalConsumed | appCurrency: currency() : '1.2-2' }}   <!-- aggregation -->

<!-- ❌ Wrong digitsInfo for category — ligne in 1.0-0 -->
{{ budgetLine.amount | appCurrency: currency() : '1.0-0' }}   <!-- ligne -->

<!-- ❌ Direct CurrencyPipe natif (bypass de la config centralisée) -->
{{ value | currency: currency() : 'symbol' : '1.0-0' : locale() }}

<!-- ❌ Hardcoded currency code dans une chaîne i18n -->
"Ton compte ≈ {{ amount }} CHF"
<!-- → la string i18n laisse le pipe injecter le symbole : -->
"Ton compte ≈ {{ amount }}"
```

## Always

- **Aggregation `'1.0-0'`** : hero, pills, totaux, soldes, balances, `consumed/remaining/exceededBy` enveloppe, cumulativeBalance, cartes mois liste, hero dashboard, year overview cards, savings summary, widgets, template totals.
- **Ligne `'1.2-2'`** : `budget_line.amount`, `transaction.amount`, table cell `Prévu`, dialogs ligne individuelle.
- **Symbole** dans le display (`€`, `CHF`) — JAMAIS raw code `EUR/CHF` text suffix dans une card / hero / pill.
- **Raw code** uniquement dans aria-label, VoiceOver, et phrases de taux (`1 EUR = 0.94 CHF`).
- **i18n strings** ne hardcodent JAMAIS `EUR/CHF/€` en suffixe d'un `{{ amount }}` — le pipe inclut déjà le symbole.

## Why dual policy

Aggregations sont scannées rapidement (hero, pills, listes). Les centimes ajoutent du bruit visuel sans valeur d'information sur des sommes mensuelles à 4-5 chiffres. Les lignes individuelles (transactions, prévisions unitaires) gardent les centimes parce que c'est l'unité comptable de base — la valeur exacte saisie par l'utilisateur.

`CURRENCY_METADATA.symbol` est `€` pour EUR, `CHF` pour CHF — le canonical display. Angular's `CurrencyPipe` with `style: 'symbol'` and the locale from `CURRENCY_METADATA` already outputs `€ / CHF` correctement. Hand-rolling `{{ value | number }} + {{ currency }}` bypass cela et leak le raw ISO code dans l'UI.

## Reference

- Shared helpers: `shared/src/currency.ts` (`CURRENCY_METADATA`), `shared/src/currency-format.ts` (`getCurrencyFormatter`)
- Core pipe: `frontend/projects/webapp/src/app/core/currency/app-currency.pipe.ts`
- iOS analog: `ios/Pulpe/Shared/Extensions/Decimal+Extensions.swift` (`asCurrency` ↔ `asCompactCurrency`, `asAmount` ↔ `asCompactAmount`)
