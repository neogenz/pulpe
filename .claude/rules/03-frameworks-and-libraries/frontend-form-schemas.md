---
description: Frontend form schemas — when to create <form>.schema.ts, transforms, strict cascade, ApiClient requestSchema
paths: "frontend/projects/webapp/**/*.{ts,spec.ts}"
---

# Frontend Form Schemas

## Data model philosophy

Default: utiliser le type inféré de `pulpe-shared` directement. Zéro wrapper inutile.

2 escape hatches:

1. Form divergent du wire → `<form>.schema.ts` avec Zod `.transform()`
2. Dérivation partagée 2+ features → fonction pure dans `core/<domain>/`

Reste: `computed()` pour dérivation, Angular pipes pour formatting.

## Rule: quand créer `<form>.schema.ts`

Form shape = Wire shape 1:1 → PAS de schema.ts. Submit: `wireSchema.parse(formValue) → service`.

Form shape ≠ Wire shape → `<form>.schema.ts` avec `.object({…}).transform((input): WireType => ({…}))`.

Raisons valides de divergence:

- A. UI confirm field absent du wire (confirmPassword, confirmPin, confirmCode)
- B. UI toggle → wire timestamp (isChecked → checkedAt ISO)
- C. Field decomposition (Date monthYear → month + year)
- D. Nested UI → flat wire (conversion object → 4 fields)
- E. Hardcoded wire field (ex: isManuallyAdjusted = true)

## Pattern example (divergent)

```typescript
import { z } from "zod/v4";
import { type TransactionCreate } from "pulpe-shared";

export const transactionCreateFromFormSchema = z
  .object({
    name: z.string().min(1).max(100).trim(),
    amount: z.number().positive(),
    isChecked: z.boolean(), // UI toggle
    budgetId: z.uuid(), // context
    conversion: conversionFormSchema.nullable(), // grouped UI
  })
  .transform(
    (input): TransactionCreate => ({
      name: input.name,
      amount: input.amount,
      checkedAt: input.isChecked ? new Date().toISOString() : null,
      budgetId: input.budgetId,
      ...(input.conversion ?? {}),
    }),
  );

export type TransactionCreateFormValue = z.input<
  typeof transactionCreateFromFormSchema
>;
```

## Pattern example (1:1 — pas de schema.ts)

```typescript
import { updateUserSettingsSchema, type UpdateUserSettings } from 'pulpe-shared';

const model = signal<UpdateUserSettings>({ currency: 'CHF', payDayOfMonth: 1 });
const settingsForm = form(model);

onSubmit() {
  const dto = updateUserSettingsSchema.parse(this.model());
  this.store.update(dto);
}
```

## Placement

- `<form>.schema.ts` co-localisé avec form/dialog
- Reusable fragments (ex: `conversionFormSchema`) dans `core/<domain>/`
- Wire DTO dans `pulpe-shared/schemas.ts` uniquement

## Types

- Form value: `z.input<typeof schema>`
- DTO: `z.output<typeof schema>` ou import wire type de `pulpe-shared`
- Jamais: `type FormData = Pick<Dto, …> & {…}`

## Parse location

Dialog / container service appelle `schema.parse({...formValue, ...context})` au boundary form → store. Store + API services opèrent sur DTOs validés.

## Wire schemas: strict by default

Tous `*CreateSchema` / `*UpdateSchema` / `*BulkUpdateSchema` dans `shared/schemas.ts` utilisent `z.strictObject()`. Read schemas restent loose (DB additive).

## ApiClient request-side parsing

`post$/patch$/put$` acceptent 4ème arg `requestSchema`:

- Requis pour mutations avec body non-trivial
- Exempt via `postVoid$` / `deleteVoid$` pour bodies vides/toggles

```typescript
this.#api.post$(
  "/transactions",
  data,
  transactionResponseSchema,
  transactionCreateSchema,
);
```

## View models & derivation (non-schema concerns)

- Type local feature avec enrichment: flat si 0-1, sous-dossier `view-models/` si 2+
- JAMAIS de VM dans sous-dossier `ui/` d'une feature
- Dérivation réactive: `computed()` dans store ou component
- UI formatting (i18n, locale, date display): Angular pipe
- Aggregation / signal-dependent derivation: fonction TS pure dans `core/<domain>/`
