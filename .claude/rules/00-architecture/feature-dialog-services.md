---
description: "When dialog methods belong in a feature-level service vs. opening MatDialog directly"
paths: "frontend/**/feature/**/*.ts"
---

# Feature Dialog Services

## Rule

A method belongs in a feature-level `*-dialog.service.ts` if **AT LEAST ONE** of these is true:

| Condition | Why |
|-----------|-----|
| Reused by 2+ components in the feature | DRY for `MatDialog.open` config + result handling |
| Polymorphic UI: opens `MatDialog` on desktop, `MatBottomSheet` on mobile | Single place to encode the dialog↔sheet decision |
| Wraps a generic dialog (e.g., `ConfirmationDialog`) with feature-specific transloco copy | Pre-localized convenience method |
| Wraps a generic dialog with snackbar feedback (e.g., `notifyMutationSuccess`) | Cohesive notification flow |

If **NONE** apply: open `MatDialog` directly in the consumer with `inject(MatDialog)` — don't add a method.

## Anti-patterns

| Don't | Why |
|-------|-----|
| Method called from a single consumer with no polymorphism, no shared config | Indirection without value — adds to god service |
| Method that parses Zod / transforms form value into wire DTO | DTO transform belongs in the form's `onSubmit` (form owns its schema) |
| Method that decides routing or store mutations after dialog closes | Service opens dialogs and returns results — caller decides what to do |
| Adding `isMobile` flag where the SAME dialog is used regardless of viewport | Service should branch on viewport ONLY when dialog↔sheet differs |

## Decision tree (new developer)

```
Need a confirmation dialog with feature copy?
  → use dialogService.confirm{X}() (or add one if it doesn't exist)

Need different UI on mobile (bottom-sheet) vs desktop (dialog)?
  → use dialogService.open{X}() (the service hides the branching)

Need to open a dialog that's already opened elsewhere in this feature?
  → use the existing dialogService.open{X}()

None of the above?
  → inject(MatDialog) in your component, open directly
```

## Example: pure dialog open (single consumer, no polymorphism)

```typescript
// component.ts — open directly, no service method needed
readonly #dialog = inject(MatDialog);

async showSettings(): Promise<void> {
  const dialogRef = this.#dialog.open(SettingsDialog, {
    data: { userId: this.userId() } satisfies SettingsDialogData,
    width: '480px',
  });
  const result = await firstValueFrom(dialogRef.afterClosed());
  if (result) { /* handle */ }
}
```

## Example: polymorphic dialog/sheet (belongs in service)

```typescript
// feature-dialog.service.ts
readonly #dialog = inject(MatDialog);
readonly #bottomSheet = inject(MatBottomSheet);
readonly #injector = inject(Injector);

async openAllocatedTransactions(
  data: AllocatedTransactionsDialogData,
  isMobile: boolean,
): Promise<AllocatedTransactionsResult | undefined> {
  if (isMobile) {
    const sheetRef = this.#bottomSheet.open(
      AllocatedTransactionsBottomSheet,
      { data, injector: this.#injector },
    );
    return firstValueFrom(sheetRef.afterDismissed());
  }

  const dialogRef = this.#dialog.open(AllocatedTransactionsDialog, {
    data,
    width: '800px',
  });
  return firstValueFrom(dialogRef.afterClosed());
}
```

## Example: confirmation wrapper (belongs in service)

```typescript
// feature-dialog.service.ts
readonly #dialog = inject(MatDialog);
readonly #transloco = inject(TranslocoService);

async confirmDelete(options: ConfirmDeleteOptions): Promise<boolean> {
  const dialogRef = this.#dialog.open(ConfirmationDialog, {
    data: {
      title: options.title,
      message: options.message,
      confirmText: this.#transloco.translate('common.delete'),
      confirmColor: 'warn',
    } satisfies ConfirmationDialogData,
    width: '400px',
  });
  const confirmed = await firstValueFrom(dialogRef.afterClosed());
  return confirmed === true;
}
```

## Cross-feature reuse

If 2+ features need the same confirmation flow (e.g., delete confirmation), extract to `core/dialogs/` as a generic service. Don't reimplement per feature.

## Where DTO parsing lives

DTO parsing (`schema.parse(formValue)`) lives in the form's `onSubmit`, NOT in the dialog service. The form owns its schema (`<form>.schema.ts` co-located). The dialog service is a transparent passthrough — it forwards form output to the caller, optionally adding context (e.g., entity id). See `frontend-form-schemas.md` for the full rule.

## Service registration

Register dialog services in the route configuration, not `providedIn: 'root'`:

```typescript
// feature.routes.ts
export default [
  {
    path: '',
    providers: [BudgetDetailsDialogService],
    children: [
      { path: '', loadComponent: () => import('./list-page') },
      { path: ':id', loadComponent: () => import('./detail-page') },
    ],
  },
] satisfies Routes;
```

See `feature-architecture.md` for full service scoping rules.

## Reference

- Existing services: `feature/budget/budget-details/budget-details-dialog.service.ts`, `feature/budget-templates/budget-templates-dialog.service.ts`
- Schema rule: `.claude/rules/03-frameworks-and-libraries/frontend-form-schemas.md`
- Service registration: `.claude/rules/00-architecture/feature-architecture.md`
