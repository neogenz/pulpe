# Epic: Suivi des lignes budgétaires réalisées

## User Stories

| US | Description | Critères clés |
|----|-------------|---------------|
| US-1 | Cocher une ligne budgétaire comme réalisée | Checkbox zone actions, date auto, style barré + opacity |
| US-2 | Décocher une ligne budgétaire | Reset style, suppression date |
| US-3 | Afficher la date de réalisation | Format MM.DD proche checkbox |
| US-4 | Solde réalisé dans budget-table | revenus cochés - dépenses cochées - épargnes cochées |
| US-5 | Solde réalisé dans current-month | Même formule que US-4 |

## Résumé technique spécifié

| Élément | Valeur |
|---------|--------|
| Champ DB | `checked_at: timestamp \| null` sur `budget_line` |
| Format date | `MM.DD` (ex: 01.15) |
| Style coché | `text-decoration: line-through` + `opacity: 0.6` |
| Position checkbox | Zone actions (droite) |
| Calcul solde | revenus cochés − dépenses cochées − épargnes cochées |

---

## Codebase Context

### 1. Modèle budget_line

#### Schéma Zod (source de vérité)
**Fichier**: `shared/schemas.ts:174-209`
```typescript
// Schéma actuel (à modifier)
export const budgetLineSchema = z.object({
  id: z.string().uuid(),
  budgetId: z.string().uuid(),
  templateLineId: z.string().uuid().nullable(),
  savingsGoalId: z.string().uuid().nullable(),
  name: z.string().min(1).max(255),
  amount: z.number().positive(),
  kind: transactionKindSchema,
  recurrence: recurrenceSchema,
  isManuallyAdjusted: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // TODO: Ajouter checkedAt: z.string().datetime().nullable().optional()
});
```

#### Types Database (auto-générés)
**Fichier**: `backend-nest/src/types/database.types.ts:37-77`
- Généré automatiquement via `bun run generate-types:local`
- Types Row, Insert, Update seront mis à jour après migration

#### Table PostgreSQL
**Fichier**: `backend-nest/schema.sql:313-326`
```sql
CREATE TABLE budget_line (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    budget_id uuid NOT NULL,
    template_line_id uuid,
    savings_goal_id uuid,
    name character varying(255) NOT NULL,
    amount numeric(15,2) NOT NULL,
    recurrence recurrence NOT NULL,
    is_manually_adjusted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    kind transaction_kind NOT NULL,
    -- TODO: Ajouter checked_at timestamp with time zone
    CONSTRAINT budget_line_amount_check CHECK ((amount > (0)::numeric))
);
```

### 2. Composants UI

#### budget-table.ts
**Fichier**: `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-table/budget-table.ts`

**Structure clé**:
- Lines 82-645: Template avec table Material (desktop) + cards (mobile)
- Lines 494-592: Colonne "actions" avec menu contextuel
- Lines 693-701: Colonnes définies: `name, planned, spent, remaining, balance, recurrence, actions`

**Pattern opacity existant** (ligne en chargement):
```html
<!-- Line 132 (mobile) -->
[class.opacity-50]="item.metadata.isLoading"

<!-- Line 602 (desktop) -->
[class.opacity-50]="row.metadata.isLoading"
[class.pointer-events-none]="row.metadata.isLoading"
```

#### current-month.ts
**Fichier**: `frontend/projects/webapp/src/app/feature/current-month/current-month.ts`

**Structure clé**:
- Lines 173-177: RecurringExpensesList (budget lines fixed/one_off)
- Lines 178-183: OneTimeExpensesList (transactions variables)
- Lines 257-269: Mapping budget lines en FinancialEntryModel

#### financial-entry.ts
**Fichier**: `frontend/projects/webapp/src/app/feature/current-month/components/financial-entry.ts`

**Pattern mat-checkbox existant** (commenté mais présent):
```html
<!-- Lines 59-64 (actuellement commenté) -->
<mat-checkbox
  [checked]="data().isChecked"
  (change)="toggleCheck($event.checked)"
  (click)="$event.stopPropagation()">
</mat-checkbox>
```

**Pattern date existant**:
```html
<!-- Line 88 -->
{{ data().createdAt | date: 'dd.MM.yyyy' : '' : 'fr-CH' }}
```

### 3. Calculs de solde

#### budget-formulas.ts (shared)
**Fichier**: `shared/src/calculators/budget-formulas.ts`

```typescript
// Lines 49-62: Revenus
calculateTotalIncome(budgetLines) = sum(lines.filter(kind === 'income'))

// Lines 74-87: Dépenses + Épargne
calculateTotalExpenses(budgetLines) = sum(lines.filter(kind === 'expense' || kind === 'saving'))

// Lines 109-114: Solde final
calculateEndingBalance = available - totalExpenses
```

**Adaptation nécessaire pour solde réalisé**:
```typescript
// Nouveau: Filtrer uniquement les lignes cochées
calculateRealizedBalance(budgetLines) {
  const checkedLines = budgetLines.filter(l => l.checkedAt !== null);
  const income = sum(checkedLines.filter(kind === 'income'));
  const expenses = sum(checkedLines.filter(kind === 'expense' || kind === 'saving'));
  return income - expenses;
}
```

#### budget-calculator.ts (frontend)
**Fichier**: `frontend/projects/webapp/src/app/core/budget/budget-calculator.ts`
- Service frontend qui délègue aux formules shared
- Peut filtrer les lignes avant appel aux formulas

### 4. Patterns existants

#### Mat-checkbox dans le projet
**Fichier**: `frontend/projects/webapp/src/app/feature/onboarding/steps/registration.ts:97-122`
```html
<mat-checkbox
  formControlName="acceptTerms"
  [disabled]="store.isLoading()"
  data-testid="accept-terms-checkbox">
  J'accepte les conditions...
</mat-checkbox>
```

#### Styling conditionnel Tailwind
```html
[class.opacity-50]="condition"
[class.pointer-events-none]="condition"
[class.line-through]="condition"  <!-- À ajouter -->
```

---

## Documentation Insights

### Angular Material MatCheckbox

#### API essentielle
```typescript
// Imports
import { MatCheckboxModule } from '@angular/material/checkbox';

// Inputs
checked: boolean        // État coché
disabled: boolean       // Désactivé
color: 'primary' | 'accent' | 'warn'
labelPosition: 'before' | 'after'

// Events
(change): MatCheckboxChange  // { source, checked }
```

#### Pattern avec Signals (recommandé)
```typescript
@Component({
  template: `
    @for (line of budgetLines(); track line.id) {
      <mat-checkbox
        [checked]="!!line.checkedAt"
        (change)="onCheck(line.id, $event.checked)"
        (click)="$event.stopPropagation()">
      </mat-checkbox>
    }
  `
})
export class BudgetTableComponent {
  budgetLines = signal<BudgetLine[]>([]);

  onCheck(id: string, checked: boolean) {
    // Appel API pour mettre à jour checked_at
  }
}
```

---

## Research Findings (UX Best Practices)

### Position checkbox
- **Standard**: À gauche du label
- **Exception budget-table**: Zone actions à droite (déjà établi dans le projet)
- **Taille minimum**: 24×24px desktop, 44×44px mobile (zone cliquable)

### Feedback visuel après coche
**Recommandation**: Combinaison opacity + line-through
```css
/* État coché */
.checked-line {
  opacity: 0.6;
  text-decoration: line-through;
}
```

**Alternative si line-through illisible sur montants**:
- Opacity 60% seule
- Badge/icon checkmark vert

### Format date timestamp
- **Spécifié**: `MM.DD` (ex: "01.15")
- **Alternative UX**: Format relatif "Aujourd'hui 14:30" avec tooltip absolu
- **Pattern projet**: `dd.MM.yyyy` avec locale fr-CH

### Animation
- Durée transition: 300ms
- Ripple effect Material (natif)
- Fade pour état complété

### Accessibilité
- `aria-label` si pas de label visible
- Focus visible (outline)
- Zone cliquable incluant label

---

## Key Files

| Fichier | Purpose |
|---------|---------|
| `shared/schemas.ts:174-209` | Schéma Zod BudgetLine - ajouter `checkedAt` |
| `backend-nest/schema.sql:313-326` | Table PostgreSQL - migration à créer |
| `backend-nest/src/types/database.types.ts:37-77` | Types auto-générés |
| `frontend/.../budget-table/budget-table.ts` | Composant table principale |
| `frontend/.../budget-table/budget-table-models.ts:30-45` | TableItem interface |
| `frontend/.../current-month/current-month.ts` | Page mois courant |
| `frontend/.../components/financial-entry.ts:59-64` | Pattern checkbox existant |
| `shared/src/calculators/budget-formulas.ts:49-114` | Formules calcul solde |

---

## Patterns to Follow

1. **Zod schema first**: Modifier `shared/schemas.ts` avant tout
2. **Migration Supabase**: Créer dans `backend-nest/supabase/migrations/`
3. **Regenerate types**: `bun run generate-types:local` après migration
4. **Signals for state**: Pas d'Observables, utiliser signals Angular
5. **Tailwind conditionals**: `[class.opacity-50]="condition"`
6. **Material checkbox**: Import MatCheckboxModule, pattern (change)/(click)
7. **Date format projet**: DatePipe avec `'dd.MM' : '' : 'fr-CH'` pour MM.DD

---

## Dependencies

### Ordre d'implémentation
1. Migration DB (`checked_at` column)
2. Regenerate types
3. Update Zod schema
4. Backend service (endpoint check/uncheck)
5. Frontend budget-table (checkbox + styling)
6. Frontend current-month (même logique)
7. Calcul solde réalisé (formulas + affichage)

### Modules Angular à importer
- `MatCheckboxModule` (déjà dans projet)
- `DatePipe` (déjà utilisé)

### Services à modifier
- `BudgetLineService` (backend): Ajouter méthode check/uncheck
- `BudgetCalculator` (frontend): Ajouter calcul solde réalisé
- `BudgetFormulas` (shared): Ajouter `calculateRealizedBalance`

---

## Points d'attention

1. **Performance**: Le calcul du solde réalisé doit être computed/memoized
2. **Optimistic update**: Mettre à jour l'UI immédiatement, rollback si erreur API
3. **Accessibilité**: Aria-label sur checkbox sans label visible
4. **Mobile**: Zone cliquable suffisante (44px minimum)
5. **UX feedback**: Animation de transition fluide (300ms)
