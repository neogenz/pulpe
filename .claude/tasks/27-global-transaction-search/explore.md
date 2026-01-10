# Task: Global Transaction Search

Ajouter une recherche textuelle globale dans toutes les transactions de tous les budgets.

## Fonctionnalité demandée

- Bouton recherche (icône loop) sur la page liste des budgets, à côté de "Ajouter un budget"
- Dialog avec champ de recherche en haut
- Recherche par description ou nom de transaction
- Résultats avec breadcrumb affichant année/mois de la transaction trouvée

---

## Codebase Context

### Page Liste des Budgets

**Fichier principal:** `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts`

- **Lignes 53-93**: Header avec titre et boutons d'action
- **Lignes 58-80**: Boutons icône (matIconButton) avec tooltips pour aide et export
- **Lignes 81-91**: Bouton primaire (matButton="filled") pour "Ajouter un budget"
- **Emplacement cible**: Ajouter le bouton recherche entre l'export et "Ajouter un budget"

```html
<!-- Pattern existant ligne 58-80 -->
<button matIconButton
        matTooltip="Exporter tous les budgets"
        aria-label="Exporter tous les budgets"
        (click)="exportAllBudgets()">
  <mat-icon>download</mat-icon>
</button>

<!-- NOUVEAU: Bouton recherche à ajouter ici -->

<button matButton="filled"
        (click)="openCreateBudgetDialog()">
  <mat-icon>add</mat-icon>
  Ajouter un budget
</button>
```

### Dialogs Existants (Patterns à suivre)

**Référence principale:** `budget-list/create-budget/budget-creation-dialog.ts`
- Structure: `h2 mat-dialog-title`, `mat-dialog-content`, `mat-dialog-actions align="end"`
- Injection: `inject(MAT_DIALOG_DATA)`, `inject(MatDialogRef)`
- Configuration responsive: `{ width: '600px', maxWidth: isHandset ? '100dvw' : '90vw' }`

**Dialog avec tableau:** `budget-details/allocated-transactions-dialog/allocated-transactions-dialog.ts`
- Lignes 96-145: `mat-table` avec colonnes (date, name, amount, actions)
- Lignes 146-154: État vide avec icône centrée et message
- **Pattern idéal pour afficher les résultats de recherche**

### Types Transaction

**Schéma Zod:** `shared/schemas.ts:215-248`

```typescript
// Champs recherchables
- name: string (1-100 chars) // RECHERCHE PRINCIPALE
- category: string | null (max 100) // RECHERCHE SECONDAIRE
- transactionDate: string (ISO datetime) // Pour breadcrumb année/mois
- kind: 'income' | 'expense' | 'saving'
- amount: number
- budgetId: string (uuid) // Pour identifier le budget parent
```

### Services API

**Frontend:** `core/transaction/transaction-api.ts:1-68`
- Pas d'endpoint de recherche globale existant
- À ajouter: `searchAll$(query: string): Observable<SearchResult[]>`

**Backend:** `backend-nest/src/modules/transaction/transaction.controller.ts`
- Endpoints existants: GET /budget/:budgetId, POST /, PATCH /:id, DELETE /:id
- **À créer:** `GET /transactions/search?q=query`

### Backend Service

**Fichier:** `backend-nest/src/modules/transaction/transaction.service.ts`
- Logique métier pour les transactions
- **À ajouter:** méthode `searchAll(userId: string, query: string)`

---

## Documentation Insights

### MatDialog v20

```typescript
// Ouvrir un dialog
const dialogRef = this.dialog.open(SearchDialogComponent, {
  width: '600px',
  maxWidth: '90vw',
  data: { initialQuery: '' },
  enterAnimationDuration: 300,
  exitAnimationDuration: 200
});

dialogRef.afterClosed().subscribe(result => {
  if (result) {
    // Naviguer vers la transaction sélectionnée
  }
});
```

### Search Input avec debounce

```typescript
searchControl = new FormControl<string>('');

// Debounce 300ms pour éviter les appels API excessifs
this.searchControl.valueChanges.pipe(
  debounceTime(300),
  distinctUntilChanged(),
  filter(term => term.trim().length >= 2),
  switchMap(term => this.transactionApi.searchAll$(term))
).subscribe(results => {
  this.searchResults.set(results);
});
```

### MatFormField avec icône

```html
<mat-form-field appearance="outline" subscriptSizing="dynamic">
  <mat-label>Rechercher</mat-label>
  <input matInput
         [formControl]="searchControl"
         placeholder="Nom ou description..."
         autocomplete="off">
  <mat-icon matIconPrefix>search</mat-icon>
  @if (searchControl.value) {
    <button mat-icon-button matIconSuffix (click)="clearSearch()" aria-label="Effacer">
      <mat-icon>close</mat-icon>
    </button>
  }
</mat-form-field>
```

---

## Key Files

| Purpose | Path | Lines |
|---------|------|-------|
| Page liste budgets | `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts` | 53-93 (header) |
| Dialog création budget | `frontend/projects/webapp/src/app/feature/budget/budget-list/create-budget/budget-creation-dialog.ts` | Pattern complet |
| Dialog transactions allouées | `frontend/projects/webapp/src/app/feature/budget/budget-details/allocated-transactions-dialog/allocated-transactions-dialog.ts` | 96-145 (table) |
| Schémas Transaction | `shared/schemas.ts` | 215-248 |
| API Transaction frontend | `frontend/projects/webapp/src/app/core/transaction/transaction-api.ts` | 1-68 |
| Controller Transaction backend | `backend-nest/src/modules/transaction/transaction.controller.ts` | 1-224 |
| Service Transaction backend | `backend-nest/src/modules/transaction/transaction.service.ts` | 1-100 |

---

## Patterns to Follow

### 1. Dialog Structure

```typescript
@Component({
  selector: 'app-search-transactions-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTableModule,
    ReactiveFormsModule,
  ],
  template: `
    <h2 mat-dialog-title>Rechercher une transaction</h2>
    <mat-dialog-content>
      <!-- Search input + Results table -->
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton mat-dialog-close>Fermer</button>
    </mat-dialog-actions>
  `
})
export class SearchTransactionsDialogComponent {
  readonly #dialogRef = inject(MatDialogRef<SearchTransactionsDialogComponent>);
}
```

### 2. Button Conventions

```html
<!-- Icon button avec tooltip -->
<button matIconButton
        matTooltip="Rechercher dans les transactions"
        aria-label="Rechercher dans les transactions"
        (click)="openSearchDialog()">
  <mat-icon>search</mat-icon>
</button>
```

### 3. Table Results

```html
<table mat-table [dataSource]="searchResults()">
  <!-- Date column avec breadcrumb -->
  <ng-container matColumnDef="period">
    <th mat-header-cell *matHeaderCellDef>Période</th>
    <td mat-cell *matCellDef="let t">
      {{ t.year }} / {{ t.monthLabel }}
    </td>
  </ng-container>

  <!-- Name column -->
  <ng-container matColumnDef="name">
    <th mat-header-cell *matHeaderCellDef>Nom</th>
    <td mat-cell *matCellDef="let t">{{ t.name }}</td>
  </ng-container>

  <!-- Amount column -->
  <ng-container matColumnDef="amount">
    <th mat-header-cell *matHeaderCellDef>Montant</th>
    <td mat-cell *matCellDef="let t">{{ t.amount | currency:'EUR' }}</td>
  </ng-container>

  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
  <tr mat-row *matRowDef="let row; columns: displayedColumns;"
      (click)="navigateToTransaction(row)"></tr>
</table>
```

### 4. API Service Pattern

```typescript
// transaction-api.ts - À ajouter
searchAll$(query: string): Observable<TransactionSearchResult[]> {
  return this.#http.get<TransactionSearchResult[]>(
    `${this.#apiUrl}/search`,
    { params: { q: query } }
  );
}
```

---

## Dependencies

### Frontend

- `MatDialogModule` - Dialog container
- `MatFormFieldModule` + `MatInputModule` - Search input
- `MatIconModule` - Icons (search, close)
- `MatTableModule` - Results display
- `MatButtonModule` - Buttons
- `MatTooltipModule` - Button tooltip
- `ReactiveFormsModule` - Form control
- `CurrencyPipe`, `DatePipe` - Formatting

### Backend

- Nouveau endpoint `GET /transactions/search`
- Nouveau DTO pour les résultats de recherche
- Query Supabase avec recherche texte (ILIKE)

### Schéma Partagé

- Nouveau type `TransactionSearchResult` avec champs enrichis (budgetName, year, month, monthLabel)

---

## Architecture proposée

### Nouveaux fichiers à créer

```
frontend/projects/webapp/src/app/feature/budget/budget-list/
├── search-transactions-dialog/
│   └── search-transactions-dialog.ts    # Dialog component
│
backend-nest/src/modules/transaction/
├── dto/
│   └── search-transaction.dto.ts        # DTO pour recherche
│
shared/
└── schemas.ts                           # + TransactionSearchResult schema
```

### Modifications de fichiers existants

1. `budget-list-page.ts` - Ajouter bouton et méthode openSearchDialog()
2. `transaction-api.ts` - Ajouter searchAll$()
3. `transaction.controller.ts` - Ajouter endpoint search
4. `transaction.service.ts` - Ajouter logique de recherche
5. `shared/schemas.ts` - Ajouter TransactionSearchResultSchema

---

## Questions à clarifier

1. **Minimum de caractères** pour déclencher la recherche ? (suggéré: 2)
2. **Pagination** des résultats ? (suggéré: non, limiter à 50 résultats)
3. **Navigation** après sélection d'un résultat ? (suggéré: ouvrir le budget concerné)
4. **Tri des résultats** ? (suggéré: par date décroissante)

---

## Next Step

Exécuter `/epct:plan 27-global-transaction-search` pour créer le plan d'implémentation détaillé.
