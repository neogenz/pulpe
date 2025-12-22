# Epic : Transactions allouées aux prévisions budgétaires

## Contexte

Actuellement, les transactions dans Pulpe s'ajoutent au budget global sans distinction. L'utilisateur ne peut pas savoir combien il a consommé sur une enveloppe budgétaire spécifique (ex: "Essence", "Repas", "Loisirs").

Cette Epic introduit le concept de **Transaction allouée** : une transaction optionnellement liée à une ligne budgétaire (BudgetLine) pour un suivi précis de la consommation par enveloppe.

---

## Besoin utilisateur

**En tant qu'** utilisateur de Pulpe
**Je veux** enregistrer mes dépenses réelles sur des lignes budgétaires spécifiques
**Afin de** savoir précisément combien j'ai consommé et combien il me reste sur chaque enveloppe (Essence, Repas, Loyer, etc.)

---

## Concepts métier

### Terminologie

| Concept | Description | Exemple |
|---------|-------------|---------|
| **Budget Line** (Code) | Montant planifié pour une enveloppe | "Essence : 120 CHF" |
| **"prévisions"** (UI) | Terme UI pour Budget Line | "prévisions" |
| **Transaction allouée** | Dépense/revenu réel lié à une Budget Line | "Plein d'essence : 65 CHF" |
| **Transaction libre** | Dépense/revenu non lié (comportement actuel) | "Cadeau imprévu : 50 CHF" |
| **Montant prévu** | `budgetLine.amount` | 120 CHF |
| **Montant consommé** | Σ(transactions allouées à cette ligne) | 65 CHF |
| **Montant restant (ligne)** | Prévu - Consommé | 55 CHF |
| **Available** (global) | Income + Rollover | "Disponible à dépenser" |
| **Remaining** (global) | Available - Expenses | "Restant du mois" |

### Règles métier

- Une transaction peut être **allouée** (liée à une BudgetLine) ou **libre** (comportement actuel préservé)
- Une transaction allouée doit avoir le même `kind` que sa BudgetLine (`income`/`expense`/`saving`)
- Une transaction allouée doit appartenir au même budget que sa BudgetLine
- Le montant minimum d'une transaction = 0.01 CHF (zéro refusé)
- On peut allouer plusieurs transactions à la même BudgetLine
- Les transactions allouées impactent le **Remaining** (restant disponible du mois) global

---

## Tâches techniques

### T1 - Backend : Modèle de données et validation
**Durée estimée :** 1-2 jours
**Dépendances :** Aucune

#### Travaux
- [ ] Migration Supabase : ajouter colonne `budget_line_id UUID NULL` à table `transaction`
- [ ] Ajouter contrainte FK : `transaction.budget_line_id → budget_line.id`
- [ ] Mettre à jour schéma Zod dans `@pulpe/shared` : `transactionCreateSchema` avec `budgetLineId?: z.uuid()`
- [ ] Régénérer types backend : `bun run generate-types:local`
- [ ] Backend : Validation dans `TransactionService.create()` :
  - Si `budgetLineId` fourni : vérifier `budgetLine.budgetId === transaction.budgetId`
  - Si `budgetLineId` fourni : vérifier `budgetLine.kind === transaction.kind`
  - Montant > 0 CHF
- [ ] Tests unitaires : `transaction.service.spec.ts` (cas valides + erreurs validation)

#### Critères d'acceptation
- [ ] Given: BudgetLine "Essence" (budgetId=A, kind=expense)
- [ ] When: Création transaction avec budgetLineId valide et kind=expense
- [ ] Then: Transaction créée avec succès
- [ ] When: Création transaction avec budgetLineId invalide (autre budget)
- [ ] Then: Erreur 400 "BudgetLine does not belong to this budget"
- [ ] When: Création transaction avec kind différent de BudgetLine
- [ ] Then: Erreur 400 "Transaction kind must match BudgetLine kind"

---

### T2 - Backend : Calculs métier
**Durée estimée :** 1 jour
**Dépendances :** T1 (colonne `budget_line_id` existe)

#### Travaux
- [ ] Service : Créer méthode `BudgetLineService.getConsumedAmount(budgetLineId: string): number`
  - Somme des `transaction.amount` où `transaction.budget_line_id = budgetLineId`
- [ ] Service : Créer méthode `BudgetLineService.getRemainingAmount(budgetLineId: string): number`
  - Formule : `budgetLine.amount - consumedAmount`
- [ ] Service : Mettre à jour `BudgetService.calculateRemaining(budgetId: string)`
  - Ancienne formule : `(income + rollover) - Σ(budgetLines) - Σ(transactions)`
  - Nouvelle formule : `(income + rollover) - Σ(budgetLines) - Σ(transactions)` (inchangée, car transactions allouées ET libres déjà comptées)
- [ ] Tests unitaires : Calculs avec transactions allouées + libres mélangées

#### Critères d'acceptation
- [ ] Given: BudgetLine "Repas" 700 CHF + 2 transactions (100 CHF + 50 CHF)
- [ ] When: Appel `getConsumedAmount()`
- [ ] Then: Retourne 150 CHF
- [ ] When: Appel `getRemainingAmount()`
- [ ] Then: Retourne 550 CHF
- [ ] Given: Budget 5000 CHF revenus, 4500 CHF prévisions, transaction allouée 65 CHF
- [ ] When: Calcul `remaining` global
- [ ] Then: `5000 - 4500 - 65 = 435 CHF`

---

### T3 - Backend : API enrichie
**Durée estimée :** 1 jour
**Dépendances :** T2 (calculs disponibles)

#### Travaux
- [ ] Créer DTO response `BudgetLineWithTransactionsDto` :
  ```typescript
  {
    budgetLine: BudgetLine,
    consumedAmount: number,
    remainingAmount: number,
    allocatedTransactions: Transaction[]
  }
  ```
- [ ] Endpoint `GET /budgets/:id/lines` : Retourner array de `BudgetLineWithTransactionsDto`
- [ ] Endpoint `GET /budget-lines/:id/transactions` : Retourner transactions allouées triées par date desc
- [ ] Mettre à jour `GET /budgets/:id` : Inclure `remaining` global mis à jour
- [ ] Swagger : Documenter nouveaux endpoints et schémas
- [ ] Tests d'intégration : Appels API avec données réelles

#### Critères d'acceptation
- [ ] Given: BudgetLine avec 3 transactions allouées
- [ ] When: `GET /budgets/:id/lines`
- [ ] Then: Retourne `consumedAmount`, `remainingAmount`, `allocatedTransactions[]`
- [ ] And: Transactions triées par `transactionDate` descendant

---

### T4 - Frontend : Affichage enrichi
**Durée estimée :** 2 jours
**Dépendances :** T3 (API retourne les données)

#### Travaux
- [ ] Créer type `BudgetLineWithTransactions` (miroir du DTO backend)
- [ ] Mettre à jour `budget-line-api.ts` : Appeler `GET /budgets/:id/lines`
- [ ] Étendre `budget-table-data-provider.ts` :
  - Ajouter colonnes "Montant consommé" et "Montant restant"
  - Créer signal `expandedLines = signal<Set<string>>(new Set())`
- [ ] Mettre à jour template `budget-table.ts` :
  - Ajouter chips Material "X CHF dépensés · Y CHF restants"
  - Ajouter `mat-expansion-panel` par ligne
  - Afficher liste des transactions allouées dans panel
  - Afficher message "Aucune transaction enregistrée" si vide
  - Optionnel : `mat-progress-bar` (consommé/prévu)
- [ ] Tests unitaires : `budget-table.spec.ts` avec données mockées

#### Critères d'acceptation
- [ ] Given: BudgetLine "Repas" 700 CHF + 2 transactions (100 CHF + 50 CHF)
- [ ] When: Affichage du tableau budget
- [ ] Then: Ligne affiche "700 CHF prévu · 150 CHF dépensés · 550 CHF restants"
- [ ] When: Clic expansion
- [ ] Then: Panel affiche 2 transactions triées par date (plus récente en premier)
- [ ] And: Chaque transaction affiche date, description, montant

---

### T5 - Frontend : Interactions CRUD
**Durée estimée :** 2-3 jours
**Dépendances :** T4 (affichage existe)

#### Travaux
- [ ] Créer `AllocatedTransactionDialogComponent` :
  - Formulaire : montant (required, > 0), description (required), date (default: aujourd'hui)
  - Champs cachés auto-remplis : `budgetLineId`, `kind`, `budgetId`
  - Mode création + mode édition
- [ ] Ajouter bouton "[+ Ajouter une transaction]" dans expansion panel
- [ ] Ajouter icônes actions (✏️ éditer, 🗑️ supprimer) sur chaque transaction
- [ ] Créer dialog confirmation suppression Material
- [ ] Gestion optimiste :
  - Update signal local immédiatement
  - Rollback si API échoue
- [ ] Snackbar Material : "Transaction enregistrée" / "Transaction supprimée" / "Erreur: ..."
- [ ] Tests unitaires : Dialog component + interactions

#### Critères d'acceptation
- [ ] Given: BudgetLine "Essence" visible
- [ ] When: Clic "Ajouter une transaction"
- [ ] Then: Dialog s'ouvre avec formulaire vide, date = aujourd'hui
- [ ] When: Saisie 65 CHF + "Plein d'essence" + clic "Enregistrer"
- [ ] Then: Dialog se ferme, ligne affichée immédiatement (optimistic), snackbar confirmé
- [ ] When: Clic icône "éditer" sur transaction
- [ ] Then: Dialog s'ouvre pré-rempli, modification possible (sauf budgetLineId/kind)
- [ ] When: Clic icône "supprimer"
- [ ] Then: Dialog confirmation "Supprimer cette transaction ?"
- [ ] When: Confirmation
- [ ] Then: Transaction disparaît, montants recalculés

---

### T6 - Tests E2E complets
**Durée estimée :** 1 jour
**Dépendances :** T5 (toutes fonctionnalités implémentées)

#### Travaux
- [ ] Créer `budget-allocated-transactions.spec.ts` (Playwright)
- [ ] Scénario 1 : Création transaction allouée depuis ligne budgétaire
- [ ] Scénario 2 : Modification transaction existante
- [ ] Scénario 3 : Suppression transaction (avec annulation puis confirmation)
- [ ] Scénario 4 : Vérification calculs (prévu/consommé/restant)
- [ ] Scénario 5 : Transaction libre (sans budgetLineId) continue de fonctionner
- [ ] Tests responsive : Mobile (expansion tactile) + Desktop

#### Critères d'acceptation
- [ ] Given: Scénario complet utilisateur (création budget → ajout ligne → transactions)
- [ ] When: Exécution suite E2E
- [ ] Then: Tous les scénarios passent ✅
- [ ] And: Tests responsive passent sur mobile + desktop

---

## Critères d'acceptation globaux (Epic)

### Scénario principal
- [ ] **Given** : Budget janvier avec BudgetLine "Essence" 120 CHF prévus
- [ ] **And** : Remaining (restant disponible du mois) = 500 CHF
- [ ] **When** : J'ajoute une transaction allouée de 65 CHF "Plein d'essence"
- [ ] **Then** : Interface affiche "120 CHF prévu · 65 CHF dépensés · 55 CHF restants"
- [ ] **And** : Remaining (restant disponible du mois) = 435 CHF (500 - 65)
- [ ] **When** : J'ajoute une 2e transaction de 30 CHF "Lave-auto"
- [ ] **Then** : Interface affiche "120 CHF prévu · 95 CHF dépensés · 25 CHF restants"
- [ ] **And** : Remaining (restant disponible du mois) = 405 CHF (435 - 30)

### Régression
- [ ] Les transactions libres (sans `budgetLineId`) continuent de fonctionner
- [ ] Le calcul du **Remaining** global inclut transactions libres ET allouées
- [ ] La création de budget depuis template n'est pas impactée

---

## Diagramme de dépendances

```
T1 (Migration DB + Validation)
 ↓
T2 (Calculs métier)
 ↓
T3 (API enrichie)
 ↓
T4 (Affichage frontend)
 ↓
T5 (Interactions CRUD)
 ↓
T6 (Tests E2E)
```

**Ordre d'exécution strict :** T1 → T2 → T3 → T4 → T5 → T6

**Points de synchronisation :**
- Après T3 : Review backend complète + merge
- Après T5 : Review frontend complète + merge
- Après T6 : Déploiement production

---

## Vocabulaire final (UI française)

| Code | UI française |
|------|--------------|
| `budgetLine.amount` | **Montant prévu** |
| `consumedAmount` | **Montant consommé** / **Dépensé** |
| `remainingAmount` (ligne) | **Montant restant** / **Disponible** |
| `allocatedTransaction` | **Transaction allouée** |
| `freeTransaction` | **Transaction libre** |
| `Available` (global) | **Disponible à dépenser** |
| `Remaining` (global) | **Restant du mois** |

---

## Estimation totale

**Durée :** 8-11 jours (solo dev)
**Complexité :** Moyenne (extension existant, pas de refonte)
**Risque :** Faible (migration additive, backward compatible)
