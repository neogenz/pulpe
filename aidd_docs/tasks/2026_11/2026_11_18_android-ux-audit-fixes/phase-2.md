---
status: done
---

# Instruction: Movement sheet: visible back from the prevision picker

## Architecture projection

```txt
.
└── android/
    └── src/
        ├── core/
        │   └── ui/
        │       ├── sheet.spec.tsx ✏️
        │       └── sheet.tsx ✏️
        └── features/
            └── transactions/
                └── components/
                    ├── transaction-sheet.spec.tsx ✏️
                    └── transaction-sheet.tsx ✏️
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | From the repo root: `pnpm install --frozen-lockfile && pnpm --filter pulpe-shared build:esm` | Jest runs | cli |
| Happy path | Real `FormModal` with `onBack` and `showsBackButton` | A back icon button labelled `common.back` (« Revenir ») renders left of the title and calls `onBack` | cli |
| Edge case | `FormModal` with `onBack` alone (reconcile accounts sheet) | No header back button | cli |
| Edge case | `FormModal` busy | Back button disabled, like the X | cli |
| Happy path | Movement sheet: type a description and `12,`, tap « Autre », press the back button | Form shows again with description, amount and the raw decimal entry `12,` kept | cli |
| Edge case | Movement sheet on the form step | No back button; X, backdrop and system back keep their current paths | cli |

## Tasks to do

### `1)` Header back button on opt-in

> While the movement sheet shows the prevision picker (« Autre »), a visible back arrow returns to the form, as the native back button does on iOS (`MovementSheet.swift:215`, `navigationDestination`). Today only the system back works and the X discards the whole draft.

1. In `sheet.tsx` `FormModal`, add an optional `showsBackButton` prop, effective only when `onBack` is set. Render an `IconButton icon="arrow-left"` before the heading, `onPress={onBack}`, `disabled={isBusy}`, `accessibilityLabel={t("common.back")}`, with a 48 × 48 dp touch target using `TOUCH_TARGET` (Paper's default `IconButton` is 40 × 40). `onRequestClose`, the X and the backdrop keep their current behavior.
2. In `transaction-sheet.tsx` (~l.407), pass `showsBackButton={isPickingLine}`. Do not touch `reconcile-accounts-sheet.tsx`: it has its own footer back button.
3. The prevision picker unmounts `AmountField`, which keeps the raw typed text locally: make sure going back restores description, amount and an in-progress decimal entry such as `12,` (lift the raw text into the sheet's state if needed).
4. Specs: `sheet.spec.tsx` on the real `FormModal` (absent by default, absent with `onBack` alone, present with both, calls `onBack`, disabled while busy). `transaction-sheet.spec.tsx` mocks `FormModal`: extend the mock to render the back button from these props. Use the real `AmountField` for the round-trip test (its current mock only offers `120` and `500`): type `12,`, open « Autre », return, and assert the description, the displayed `12,`, and the submitted numeric amount `12`. Preserve the existing reset and quick-amount behavior.
5. Verify: `pnpm --dir android run quality`, `pnpm --dir android exec jest src/core/ui src/features/transactions src/features/current-month`. Do not commit; report the changed files.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | On the prevision picker step a « Revenir » arrow is visible and returns to the form |
| 1 | No other `FormModal` caller shows a header back button |
| 1 | Going back keeps the description, the amount and an in-progress decimal entry |
