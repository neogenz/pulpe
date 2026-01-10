# Implementation Plan: Global Transaction Search

## Overview

Ajouter une fonctionnalité de recherche textuelle globale dans toutes les transactions de tous les budgets de l'utilisateur. L'implémentation suit les patterns établis du projet avec Angular Material v20 et Tailwind CSS.

**Flux utilisateur:**
1. Clic sur bouton recherche (icône `search`) dans le header de la page liste des budgets
2. Dialog s'ouvre avec un champ de recherche en haut
3. L'utilisateur saisit 2+ caractères → recherche déclenchée (debounce 300ms)
4. Résultats affichés dans un tableau avec période (breadcrumb année/mois), nom, montant
5. Clic sur un résultat → ferme le dialog et navigue vers le budget concerné

## Dependencies

**Ordre d'implémentation:**
1. Shared schema (contrat API) → Backend → Frontend API → Frontend UI

**Aucune migration DB requise** - utilise les tables existantes (transactions, budgets)

---

## File Changes

### 1. `shared/schemas.ts`

**Position:** Après `transactionUpdateSchema` (~ligne 269)

- Ajouter `transactionSearchResultSchema` avec les champs:
  - `id` (uuid) - ID de la transaction
  - `name` (string) - nom de la transaction
  - `amount` (number) - montant
  - `kind` (transactionKindSchema) - income/expense/saving
  - `transactionDate` (datetime) - date de la transaction
  - `category` (string nullable) - catégorie optionnelle
  - `budgetId` (uuid) - ID du budget parent
  - `budgetName` (string) - nom du budget (ex: "Budget 2024")
  - `year` (number) - année extraite (ex: 2024)
  - `month` (number) - mois extrait 1-12
  - `monthLabel` (string) - nom du mois en français (ex: "Janvier")

- Ajouter `transactionSearchResultListSchema` avec `z.array(transactionSearchResultSchema)`

- Exporter les types `TransactionSearchResult` et `TransactionSearchResultList`

- Ajouter `transactionSearchResponseSchema` avec structure `{ success: true, data: transactionSearchResultListSchema }`

- Exporter type `TransactionSearchResponse`

### 2. `backend-nest/src/modules/transaction/dto/search-transaction.dto.ts`

**Nouveau fichier**

- Créer `SearchTransactionQueryDto`:
  - `q` (string, @IsString, @MinLength(2), @MaxLength(100)) - terme de recherche
  - Ajouter décorateurs Swagger (@ApiProperty)

- Créer `TransactionSearchResultDto` (classe pour Swagger):
  - Propriétés matchant `TransactionSearchResult` du shared
  - Décorateurs @ApiProperty pour chaque champ

- Créer `TransactionSearchResponseDto`:
  - `success` (boolean)
  - `data` (TransactionSearchResultDto[])

### 3. `backend-nest/src/modules/transaction/transaction.service.ts`

**Position:** Ajouter méthode après `findByBudgetLineId` (~ligne 68)

- Ajouter méthode `async search(query: string, supabase: AuthenticatedSupabaseClient): Promise<TransactionSearchResponse>`

- Implémentation:
  1. Construire requête Supabase avec jointure sur `budgets`:
     - SELECT transactions.*, budgets.name as budget_name
     - FROM transactions
     - JOIN budgets ON transactions.budget_id = budgets.id
  2. Filtrer avec ILIKE sur `transactions.name` et `transactions.category`:
     - `.or(`name.ilike.%${query}%,category.ilike.%${query}%`)`
  3. Ordonner par `transaction_date` DESC
  4. Limiter à 50 résultats
  5. Transformer les résultats:
     - Extraire year/month de `transactionDate`
     - Ajouter `monthLabel` en français via helper
  6. Retourner `{ success: true, data: results }`

- Ajouter helper privé `#getMonthLabel(month: number): string` avec mois français:
  - 1 → "Janvier", 2 → "Février", etc.

- Gérer les erreurs avec `BusinessException.fromSupabaseError`

### 4. `backend-nest/src/modules/transaction/transaction.controller.ts`

**Imports à ajouter:** `Query` de `@nestjs/common`

**Position:** Ajouter endpoint avant `@Get(':id')` (~ligne 100)

- Ajouter endpoint `@Get('search')`:
  - `@ApiOperation({ summary: 'Recherche globale dans toutes les transactions' })`
  - `@ApiQuery({ name: 'q', description: 'Terme de recherche (min 2 caractères)', required: true })`
  - `@ApiResponse({ status: 200, type: TransactionSearchResponseDto })`
  - `@ApiBadRequestResponse` pour query invalide

- Signature: `async search(@Query('q') query: string, @User() user, @SupabaseClient() supabase)`

- Validation: Si `query.length < 2`, throw BadRequestException

- Appeler `this.transactionService.search(query, supabase)`

### 5. `frontend/projects/webapp/src/app/core/transaction/transaction-api.ts`

**Imports à ajouter:** `transactionSearchResponseSchema` de `@pulpe/shared`

**Position:** Ajouter méthode après `toggleCheck$` (~ligne 66)

- Ajouter méthode `search$(query: string): Observable<TransactionSearchResponse>`:
  - GET request vers `${this.#apiUrl}/search` avec params `{ q: query }`
  - Parser réponse avec `transactionSearchResponseSchema`
  - Pattern: suivre `findByBudget$` pour la structure

### 6. `frontend/projects/webapp/src/app/feature/budget/budget-list/search-transactions-dialog/search-transactions-dialog.ts`

**Nouveau fichier**

**Structure du composant:**

- Selector: `pulpe-search-transactions-dialog`
- Standalone: true
- ChangeDetection: OnPush

**Imports Angular Material:**
- MatDialogModule (MAT_DIALOG_DATA, MatDialogRef)
- MatFormFieldModule
- MatInputModule
- MatIconModule
- MatButtonModule
- MatTableModule
- MatProgressSpinnerModule

**Imports Angular:**
- ReactiveFormsModule (FormControl)
- CurrencyPipe

**Imports RxJS:**
- debounceTime, distinctUntilChanged, filter, switchMap, catchError

**Template structure:**

1. `<h2 mat-dialog-title>` - "Rechercher une transaction"

2. `<mat-dialog-content>`:
   - Champ de recherche mat-form-field:
     - `appearance="outline"`
     - mat-icon `search` en prefix
     - Input avec `[formControl]="searchControl"` et placeholder "Nom ou description..."
     - Bouton clear (mat-icon `close`) en suffix si valeur présente

   - Zone de résultats:
     - `@if (isLoading())` → MatSpinner centré avec "Recherche en cours..."
     - `@else if (searchResults().length > 0)` → mat-table avec colonnes:
       - `period`: Affiche `{{ row.year }} / {{ row.monthLabel }}` (style breadcrumb)
       - `name`: Nom de la transaction
       - `amount`: Montant formaté avec CurrencyPipe CHF
       - Rows cliquables avec `(click)="selectResult(row)"`
     - `@else if (searchControl.value && !isLoading())` → État vide "Aucun résultat trouvé"

3. `<mat-dialog-actions align="end">`:
   - Bouton "Fermer" avec mat-dialog-close

**Logique composant:**

- `searchControl = new FormControl<string>('')`
- `searchResults = signal<TransactionSearchResult[]>([])`
- `isLoading = signal(false)`
- `displayedColumns = ['period', 'name', 'amount']`

- Constructor: Injecter `TransactionApi`, `MatDialogRef`

- ngOnInit ou constructor effect:
  - Souscrire à `searchControl.valueChanges.pipe(...)`
  - debounceTime(300)
  - distinctUntilChanged()
  - filter(term => term.trim().length >= 2)
  - tap(() => isLoading.set(true))
  - switchMap(term => transactionApi.search$(term))
  - Mettre à jour `searchResults` et `isLoading`
  - catchError: afficher erreur, retourner tableau vide

- `clearSearch()`: Reset searchControl et searchResults

- `selectResult(result: TransactionSearchResult)`:
  - Fermer dialog avec `dialogRef.close(result)`

**Styles:**
- Table avec fond transparent
- Rows avec hover effect
- Breadcrumb period en `text-on-surface-variant` plus petit
- Amount aligné à droite

### 7. `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.ts`

**Imports à ajouter:**
- `SearchTransactionsDialogComponent` depuis `./search-transactions-dialog/search-transactions-dialog`
- `Router` depuis `@angular/router` (si pas déjà présent)

**Template modification (ligne ~80, avant le bouton "Ajouter un budget"):**

- Ajouter bouton icône search:
  ```html
  <button
    matIconButton
    (click)="openSearchDialog()"
    matTooltip="Rechercher dans les transactions"
    aria-label="Rechercher"
    data-testid="search-transactions-btn"
  >
    <mat-icon>search</mat-icon>
  </button>
  ```

**Composant - méthode à ajouter (~après openCreateBudgetDialog):**

- `openSearchDialog()`:
  1. Ouvrir dialog avec config responsive (suivre pattern de `openCreateBudgetDialog`)
  2. S'abonner à `afterClosed()`
  3. Si résultat retourné (TransactionSearchResult):
     - Naviguer vers `/budget/${result.budgetId}` avec queryParams `{ month: result.month, year: result.year }`

---

## Testing Strategy

### Backend Tests

**Fichier:** `backend-nest/src/modules/transaction/transaction.service.spec.ts`

- Tester `search()`:
  - Cas nominal: query valide retourne résultats avec tous les champs
  - Cas aucun résultat: retourne tableau vide
  - Cas erreur Supabase: throw BusinessException

**Fichier:** `backend-nest/src/modules/transaction/transaction.controller.spec.ts`

- Tester endpoint GET /search:
  - Query valide → 200 avec résultats
  - Query trop courte (<2 chars) → 400 Bad Request
  - Non authentifié → 401

### Frontend Tests

**Fichier:** `frontend/projects/webapp/src/app/feature/budget/budget-list/search-transactions-dialog/search-transactions-dialog.spec.ts`

- Tester composant:
  - Affiche champ de recherche vide à l'ouverture
  - Ne déclenche pas de recherche si moins de 2 caractères
  - Affiche spinner pendant le chargement
  - Affiche résultats dans le tableau après recherche
  - Affiche "Aucun résultat" si tableau vide
  - Ferme dialog et retourne résultat au clic sur une ligne
  - Clear button reset la recherche

**Fichier:** `frontend/projects/webapp/src/app/feature/budget/budget-list/budget-list-page.spec.ts`

- Ajouter test:
  - Bouton recherche présent et ouvre le dialog
  - Navigation après sélection d'un résultat

---

## Manual Verification

1. Accéder à la page liste des budgets
2. Vérifier présence du bouton recherche (icône loupe)
3. Cliquer → dialog s'ouvre
4. Saisir 1 caractère → pas de recherche
5. Saisir 2+ caractères → recherche se déclenche après 300ms
6. Vérifier format des résultats (période en breadcrumb, nom, montant)
7. Cliquer sur un résultat → navigation vers le bon budget
8. Tester le bouton clear
9. Tester fermeture du dialog

---

## Rollout Considerations

- **Pas de migration DB** - utilise les données existantes
- **Pas de feature flag** - fonctionnalité additive sans impact sur l'existant
- **Performance** - Limité à 50 résultats, recherche debounced
- **RLS** - La requête Supabase hérite automatiquement des policies existantes (user ne voit que ses propres transactions)

---

## Next Step

Exécuter `/epct:code 27-global-transaction-search` pour implémenter le plan.
