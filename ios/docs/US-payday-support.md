# User Story : Support du PayDay dans l'app iOS

## Contexte

L'application web (Angular) supporte pleinement le concept de **payDay** (jour de paie personnalisé) qui permet aux utilisateurs de définir des périodes budgétaires basées sur leur date de salaire plutôt que sur le mois calendaire. L'app iOS utilise actuellement une logique simplifiée basée uniquement sur le mois calendaire, ignorant complètement le `payDayOfMonth` de l'utilisateur.

### Règle "Quinzaine" (logique métier existante côté backend/shared)

- **payDay ≤ 15 (1ère quinzaine)** : Le budget est nommé d'après le mois de DÉBUT de la période.
  Ex : payDay=5 → Budget "Mars" couvre du 5 mars au 4 avril.
- **payDay > 15 (2ème quinzaine)** : Le budget est nommé d'après le mois de FIN de la période.
  Ex : payDay=27 → Budget "Mars" couvre du 27 fév au 26 mars.
- **payDay = 1 ou null** : Comportement calendaire standard (pas de changement).

---

## User Story

**En tant qu'** utilisateur ayant configuré un jour de paie personnalisé (payDay ≠ 1),
**Je veux** que l'app iOS reflète correctement ma période budgétaire dans toutes les vues,
**Afin de** voir des informations cohérentes entre l'app web et l'app iOS et gérer mon budget en phase avec mon salaire.

---

## Analyse des écarts (iOS vs Frontend Angular)

### 1. Récupération du payDayOfMonth

| Aspect | Frontend (Angular) | iOS (Swift) | Écart |
|--------|-------------------|-------------|-------|
| Source | `UserSettingsApi.payDayOfMonth` (signal réactif) | **Non implémenté** | L'iOS ne récupère pas le setting `payDayOfMonth` depuis l'API `GET /users/settings` |
| Stockage | Signal computed dans `user-settings-api.ts:59-61` | `UserInfo` ne contient que `id` et `email` | Le modèle utilisateur iOS ne porte pas cette information |
| Écran réglages | Accessible dans les settings web | `AccountView.swift:1-64` — aucun champ payDay | Pas de lecture ni modification possible côté iOS |

**Fichiers impactés :**
- `ios/Pulpe/Core/Auth/AuthService.swift` (modèle `UserInfo`)
- `ios/Pulpe/Features/Account/AccountView.swift` (affichage settings)
- Nouveau : service ou store pour les user settings

---

### 2. Détermination du budget courant (Current Budget)

| Aspect | Frontend (Angular) | iOS (Swift) | Écart |
|--------|-------------------|-------------|-------|
| Logique | `getBudgetPeriodForDate(date, payDay)` dans `shared/budget-period.ts:60-110` | `Budget.isCurrentMonth` dans `Budget.swift:44-49` | iOS compare mois/année calendaire, ignore le payDay |
| Résultat | Retourne `{ month, year }` en appliquant la règle quinzaine | Compare `Calendar.current.component(.month)` et `.year` | Un utilisateur avec payDay=25 verrait le mauvais budget comme "courant" entre le 25 et la fin du mois |

**Code iOS actuel (`Budget.swift:44-49`) :**
```swift
var isCurrentMonth: Bool {
    let now = Date()
    let calendar = Calendar.current
    return month == calendar.component(.month, from: now) &&
           year == calendar.component(.year, from: now)
}
```

**Comportement attendu :** Reproduire la logique `getBudgetPeriodForDate()` du shared en Swift, en tenant compte du payDay pour déterminer le budget courant.

**Fichiers impactés :**
- `ios/Pulpe/Domain/Models/Budget.swift:44-49`
- Nouveau : utilitaire `BudgetPeriodCalculator.swift` (port de `shared/budget-period.ts`)

---

### 3. Affichage du pill/période sur la Homescreen

| Aspect | Frontend (Angular) | iOS (Swift) | Écart |
|--------|-------------------|-------------|-------|
| Titre page | `budgetPeriodDisplayName()` dans `current-month.ts:255-260` — affiche le mois/année de la période | `navigationTitle("Ce mois-ci")` dans `CurrentMonthView.swift:30` | Titre statique, pas adapté à la période réelle |
| Pill période | `formatBudgetPeriod()` dans `budget-details-page.html:56-62` — affiche "27 fév - 26 mars" | **Absent** | Aucune indication de la période budgétaire sur le homescreen iOS |
| Condition d'affichage | `@if (periodDisplay())` — uniquement si payDay configuré et ≠ 1 | — | — |

**Comportement attendu :**
- Afficher un **pill/chip** sous le titre ou dans le `HeroBalanceCard` montrant la période (ex: "27 fév - 26 mars")
- Uniquement visible quand `payDayOfMonth > 1`

**Fichiers impactés :**
- `ios/Pulpe/Features/CurrentMonth/CurrentMonthView.swift:30` (titre)
- `ios/Pulpe/Features/CurrentMonth/Components/HeroBalanceCard.swift` (ajout pill)

---

### 4. Calcul des "jours restants" et "budget journalier"

| Aspect | Frontend (Angular) | iOS (Swift) | Écart |
|--------|-------------------|-------------|-------|
| Jours restants | Le frontend ne calcule pas `daysRemaining` actuellement | `CurrentMonthStore.swift:182-194` — calcule jusqu'à la fin du mois calendaire | iOS calcule les jours jusqu'au dernier jour du mois calendaire, pas jusqu'à la fin de la période budgétaire |
| Budget journalier | — | `CurrentMonthStore.swift:197-200` — `remaining / daysRemaining` | Divisé par les mauvais jours si payDay ≠ 1 |

**Code iOS actuel (`CurrentMonthStore.swift:182-194`) :**
```swift
var daysRemaining: Int {
    let calendar = Calendar.current
    let today = Date()
    guard let range = calendar.range(of: .day, in: .month, for: today),
          let lastDay = calendar.date(from: DateComponents(
            year: calendar.component(.year, from: today),
            month: calendar.component(.month, from: today),
            day: range.count
          )) else { return 0 }
    let remaining = calendar.dateComponents([.day], from: today, to: lastDay).day ?? 0
    return max(remaining + 1, 1)
}
```

**Comportement attendu :** Calculer les jours restants jusqu'à la **fin de la période budgétaire** (basée sur `getBudgetPeriodDates()`) plutôt que la fin du mois calendaire.

**Fichiers impactés :**
- `ios/Pulpe/Domain/Store/CurrentMonthStore.swift:182-200`
- `ios/PulpeTests/Domain/Store/CurrentMonthStoreLogicTests.swift` (adapter les tests)

---

### 5. Focus sur le budget courant dans la liste des budgets

| Aspect | Frontend (Angular) | iOS (Swift) | Écart |
|--------|-------------------|-------------|-------|
| Détection "courant" | `getBudgetPeriodForDate(new Date(), payDay)` dans `budget-list-page.ts:247-250` | `budget.isCurrentMonth` (calendaire) dans `BudgetListView.swift:280` | Mauvais budget mis en surbrillance si payDay ≠ 1 |
| Badge "Actuel" | `MonthTile` affiche "Actuel" + ring coloré dans `month-tile.ts:52-57` | Gradient + bordure dans `BudgetMonthCard` `BudgetListView.swift:313-337` | Styling OK, mais appliqué au mauvais mois |
| Affichage période | `period` optionnel sur chaque `CalendarMonth` dans `calendar-types.ts:29` | **Absent** | Pas de sous-titre "27 fév - 26 mars" sous le nom du mois |
| Scroll auto | Composant YearCalendar reçoit `currentDate` dans `year-calendar.ts:59` | `expandedYears = [currentYear]` dans `BudgetListView.swift:56-57` | Expand l'année courante mais ne scroll pas vers le mois courant |

**Fichiers impactés :**
- `ios/Pulpe/Features/Budgets/BudgetList/BudgetListView.swift` (BudgetMonthCard, YearSection)
- `ios/Pulpe/Domain/Models/Budget.swift` (isCurrentMonth)

---

### 6. Création de dépense — contexte de période

| Aspect | Frontend (Angular) | iOS (Swift) | Écart |
|--------|-------------------|-------------|-------|
| Sheet de création | `add-transaction-bottom-sheet.ts:207-213` — date = aujourd'hui, assigné au budget courant via store | `AddTransactionSheet.swift` — reçoit `budgetId` en prop | iOS fonctionne car le `budgetId` est passé par le store qui obtient le bon budget depuis le backend |
| Indicateur période | Pas de pill dans le sheet Angular non plus | Pas de pill | **Parité** — pas d'écart ici |

**Verdict :** La création de dépense fonctionne correctement car le backend retourne le bon budget. Cependant, l'utilisateur ne voit pas à quelle période la dépense est rattachée.

---

## Critères d'acceptation

### AC1 — Récupération du payDay
- [ ] L'app iOS récupère `payDayOfMonth` depuis `GET /users/settings` au login/refresh
- [ ] La valeur est stockée de manière réactive et accessible globalement

### AC2 — Détermination correcte du budget courant
- [ ] `Budget.isCurrentMonth` utilise la logique quinzaine quand `payDay > 1`
- [ ] Le budget courant correspond à celui affiché sur l'app web pour la même date

### AC3 — Pill de période sur le Homescreen
- [ ] Quand `payDay > 1`, un chip affiche la période (ex: "5 jan - 4 fév") dans le `HeroBalanceCard` ou sous le titre
- [ ] Quand `payDay == 1` ou null, aucun chip n'est affiché (comportement actuel conservé)

### AC4 — Jours restants basés sur la période
- [ ] `daysRemaining` calcule les jours jusqu'à la fin de la période budgétaire (pas du mois calendaire)
- [ ] `dailyBudget` utilise le nouveau `daysRemaining`
- [ ] Le texte "X jours restants · ~Y/jour" reflète la bonne période

### AC5 — Highlight correct dans la liste des budgets
- [ ] Le gradient, la bordure et le shadow s'appliquent au bon mois basé sur la période payDay
- [ ] Optionnel : afficher la période en sous-titre de chaque mois dans la grille (ex: "5 jan - 4 fév")

### AC6 — Scroll automatique vers le budget courant
- [ ] À l'ouverture de la liste des budgets, la vue scroll automatiquement vers le mois du budget courant

---

## Estimation de complexité

| Tâche | Effort |
|-------|--------|
| Port de `BudgetPeriodCalculator` (logique quinzaine) en Swift | Moyen |
| Service `UserSettings` + récupération payDay | Faible |
| Mise à jour `isCurrentMonth` avec payDay | Faible |
| Pill période dans HeroBalanceCard | Faible |
| Adaptation `daysRemaining` / `dailyBudget` | Faible |
| Highlight correct dans BudgetListView | Faible |
| Scroll auto vers budget courant | Faible |
| Tests unitaires (port des tests shared) | Moyen |

---

## Dépendances

- **Backend** : Endpoint `GET /users/settings` déjà existant (`user.controller.ts:273-307`)
- **Shared** : Logique de référence dans `shared/src/calculators/budget-period.ts` (à porter en Swift)
- **Schemas** : `payDayOfMonthSchema` dans `shared/schemas.ts:690-703`

---

## Références codebase

| Fichier | Ligne(s) | Description |
|---------|----------|-------------|
| `shared/src/calculators/budget-period.ts` | 60-110 | `getBudgetPeriodForDate()` — logique à porter |
| `shared/src/calculators/budget-period.ts` | 207-280 | `getBudgetPeriodDates()` — dates début/fin |
| `shared/src/calculators/budget-period.ts` | 296-317 | `formatBudgetPeriod()` — formatage pill |
| `shared/schemas.ts` | 690-703 | Schema Zod du payDay |
| `backend-nest/src/modules/user/user.controller.ts` | 273-307 | API GET settings |
| `frontend/.../current-month-store.ts` | 62-66 | Référence frontend period |
| `frontend/.../budget-details-page.ts` | 141-146 | Référence frontend pill |
| `frontend/.../budget-list-page.ts` | 247-250 | Référence frontend current date |
| `ios/Pulpe/Domain/Models/Budget.swift` | 44-49 | `isCurrentMonth` à modifier |
| `ios/Pulpe/Domain/Store/CurrentMonthStore.swift` | 182-200 | `daysRemaining` à modifier |
| `ios/Pulpe/Features/CurrentMonth/Components/HeroBalanceCard.swift` | 77-81 | Affichage jours restants |
| `ios/Pulpe/Features/Budgets/BudgetList/BudgetListView.swift` | 280, 313-337 | Highlight budget courant |
| `ios/Pulpe/Features/Account/AccountView.swift` | 1-64 | Settings sans payDay |
