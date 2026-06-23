# Objectifs d'épargne — Blueprint métier (PUL-98)

> **Statut** : source de vérité métier (décisions tranchées). Public : devs back/front/iOS, product.
> **Périmètre** : modèle, accumulation, progression, états, couleur, FX, edge cases, phasage.
> **Glossaire** : `budget_lines` = Prévisions · `kind=saving` = Épargne · `checked`/`checkedAt` = Pointé. Tutoiement, ton bienveillant non-anxiogène.

---

## 1. Vue d'ensemble & besoin

L'utilisateur (D5 : résident suisse, dépensier conscient, ~30 s d'attention/jour) veut **suivre un objectif d'épargne long terme sans recalculer à la main** : « combien j'ai mis de côté pour ma maison, et est-ce que je tiens le rythme ? ».

Pulpe répond avec une feature volontairement minimale (intention 9 : *progressive disclosure*, le flow quotidien reste intact) :

- Un **objectif** = un nom, une cible, une échéance, un statut.
- Une **contribution** = le **tagging manuel** d'une Prévision Épargne existante à cet objectif. Pas de nouveau geste de saisie, pas de notion de priorité, pas de nudge.
- Une **progression** dérivée des Prévisions liées et de leur pointage, exprimée en deux couches (prévu / confirmé).

Entrée produit : la **carte Épargne du dashboard** reste un résumé **mensuel** (goal-agnostique — D4) et gagne une **action explicite** « Voir mes objectifs » (jamais un chevron nu — DA §3.4 ; et **pas** « X % vers tes objectifs » : la carte ne calcule pas ce chiffre, c'est un % mensuel, pas un % de vie d'objectif) → liste des objectifs → détail + progression.

---

## 2. Modèle de données

### 2.1 `savings_goal`

| Colonne | Type | Note |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid | RLS par user |
| `name` | text | libellé objectif |
| `target_amount` | text | **chiffré AES-256-GCM** (cf. `docs/ENCRYPTION.md`) |
| `target_date` | date | échéance ; à la création, `z.iso.date()` + `.refine(d => d >= today)` (**pas** `.min()` — en Zod 4, `.min()` sur une string ISO mesure la **longueur**, pas la date) |
| `status` | enum | `ACTIVE` / `COMPLETED` / `PAUSED` (cf. §6) |
| `priority` | enum (nullable, **dormante**) | **retirée du produit** — voir ci-dessous |
| colonnes FX | text/null | **dormantes** en v1, porte multi-devise ouverte (cf. §8) |

**Priorité retirée** : pas de notion de priorité sur l'épargne. `priority` est absente du formulaire et des schémas `create`/`response`. La colonne DB est rendue **nullable + dormante** — **pas de drop destructif** maintenant. L'enum `priority_level` n'est utilisé par aucune autre table (vérifié) ; son drop futur est donc sûr mais hors scope.

### 2.2 Le lien Prévision ↔ objectif (décision clé)

Le rattachement vit **au niveau du modèle**, pas seulement sur la Prévision du mois courant.

| Table | Colonne | Rôle |
|---|---|---|
| `template_line` | `savings_goal_id` (nullable, **ajout migration**) | source de vérité récurrente |
| `budget_line` | `savings_goal_id` (nullable, déjà présent) | lien effectif d'un mois |

**FK** : `savings_goal_id → savings_goal.id` **`ON DELETE SET NULL`** sur les deux tables. Aujourd'hui le FK sur `budget_line` n'a **aucun** `ON DELETE` → le durcissement est obligatoire (cf. edge `FK delete`).

**Pourquoi `template_line` doit porter le lien** : sans ça, une épargne récurrente régénérée chaque mois repartirait **non-liée** → l'objectif perdrait ses contributions futures. Le lien doit survivre à la régénération mensuelle (cf. §3).

---

## 3. Modèle d'accumulation

### 3.1 Tagging manuel

Une contribution n'est **jamais** un nouveau type de saisie : c'est le tag `savingsGoalId` posé sur une Prévision `kind=saving`. Surfaces de tagging :

- **Primaire** : l'**éditeur de Prévision du Mois Type** (template-line editor, iOS + web) → pose `template_line.savings_goal_id`, ce qui propage à tous les mois générés.
- **Secondaire** : le picker sur `budget_line` → ponctuel, mois courant, ou rétroactif.

### 3.2 Comment le lien survit aux mois

1. **Génération depuis template** : créer un budget copie `template_line.savings_goal_id → budget_line.savings_goal_id`.
2. **Propagation RG-001** (Template ↔ Budget Sync) : la propagation copie aussi `savings_goal_id`, **sauf budgets manuellement ajustés** (protégés). ⚠️ **Coût réel** (relevé à la validation) : la RPC `apply_template_line_operations` (SECURITY DEFINER, ~340 lignes, durcie PUL-272) **ne référence pas** `savings_goal_id` aujourd'hui et son schéma Zod de payload est `.strict()`. L'ajouter = migration `CREATE OR REPLACE` (SELECT/CASE/INSERT) + champ dans le schéma strict + propagation depuis le use-case, en re-validant le guard cross-tenant. Ce n'est **pas** un simple « add field » — c'est le gros morceau de PUL-12.
3. **Mois courant / rétroactif** : le picker `budget_line` permet de (dé)taguer un mois isolé sans toucher au template.

> Conséquence : taguer dans le Mois Type = taguer **tous** les mois futurs d'un coup ; taguer sur `budget_line` = un seul mois.

### 3.3 Multi-objectif

**1 Prévision = 1 objectif** (FK simple). Pour répartir une épargne entre plusieurs objectifs, créer des **Prévisions Épargne distinctes**, une par objectif. Pas de split au niveau ligne.

### 3.4 Changement de `kind`

Si une Prévision passe de `saving` à un autre `kind`, `savingsGoalId` est forcé à `null`. La progression re-filtre **toujours** `kind=saving` côté lecture (double garde).

---

## 4. Formules de progression

**Pièges identifiés à la validation — lire avant d'implémenter :**

- `plannedCumulative` est une **somme brute de `line.amount`**, surtout **PAS** `calculateTotalSavings` : cette dernière applique l'enveloppe `max(line, consumed)`, incompatible avec « pur line.amount ». Elle n'est **pas** réutilisée ici.
- `getBudgetPeriodForDate` (existant, payDay-aware) est réutilisé pour l'index de période (`year * 12 + month`).
- **À créer en PUL-8** — `calculateRealizedSavings` = clone de `calculateRealizedExpenses` avec **deux** différences obligatoires : (a) filtre `kind==='saving'` **strict** (et non `isOutflowKind`, qui agrège saving + expense) ; (b) **retirer le bloc free-transaction** (`budgetLineId=''`) — un objectif n'a que des lignes liées, pas de transaction libre, sinon le `confirmed` est contaminé par des épargnes pointées non rattachées. Plus `paceStatus` + `PACE_TOLERANCE_PERCENT = 5 %`.

### 4.1 Sélection des lignes liées

```
linkedSavingLines =
  budget_line
  WHERE kind = 'saving'
    AND savingsGoalId = goal.id
    AND isRollover ≠ true        // exclut les lignes de report
  (tous budgets, tous mois)
```

### 4.2 Les neuf formules

```
// Ancrage : cycle de goal.createdAt (payDay-aware, via getBudgetPeriodForDate)
indexAncrage   = year(ancrage) * 12 + month(ancrage)
indexCourant   = year(now)     * 12 + month(now)
indexEcheance  = year(target)  * 12 + month(target)

monthsElapsed    = indexCourant − indexAncrage + 1          // ≥ 1 par construction
monthsRemaining  = indexEcheance − indexCourant + 1         // mois courant ET échéance inclus (le mois courant reste contributif ; ≤ 0 ⇒ échéance dépassée)

// 1. Prévu cumulé — pur line.amount des mois ≤ now (PAS d'enveloppe transactions)
plannedCumulative = Σ line.amount  (linkedSavingLines des mois ≤ indexCourant)

// 2. Confirmé — enveloppe checked-only (checkedAt), tous mois
//    calculateRealizedSavings : filtre kind==='saving' STRICT (PAS isOutflowKind)
//    ET retire le bloc free-transaction (budgetLineId='') — un objectif n'a que des lignes liées
confirmed = Σ calculateRealizedSavings(linkedSavingLines, linkedTransactions)

// 3. % d'atteinte — sur le CONFIRMÉ, jamais le prévu
achievementPercent = round( min(confirmed / targetAmount, 1) * 100 )
//   garde : targetAmount = 0 → 0   (ne JAMAIS diviser par une cible non déchiffrée / nulle)

// 4. Rythme — DEUX rythmes. La projection/paceStatus se basent sur le CONFIRMÉ (cohérent avec la barre)
pace          = plannedCumulative / max(1, monthsElapsed)   // engagement (indicatif secondaire)
confirmedPace = confirmed         / max(1, monthsElapsed)   // réel pointé — base de la projection

// 5. Requis pour tenir l'échéance
required = max(0, targetAmount − confirmed) / monthsRemaining
//   = null si monthsRemaining ≤ 0  (échéance dépassée)

// 6. Projection à l'échéance — sur le rythme CONFIRMÉ (sinon contredit la barre, qui est sur confirmed)
projected = confirmed + confirmedPace * monthsRemaining
//   = confirmed si monthsRemaining ≤ 0

// 7. Statut de rythme (tolérance ±5 %, projected vs targetAmount)
paceStatus = behind | on_track | ahead          // via paceStatus(projected, targetAmount, PACE_TOLERANCE_PERCENT)
//   PAUSED          → pas de status (null)
//   échéance dépassée → état dédié (cf. §6 D1), PAS « behind » générique
```

### 4.3 Edge cases des formules

| Cas | Règle |
|---|---|
| **Division par zéro (cible)** | `targetAmount = 0` → `achievementPercent = 0`. Jamais de division sans déchiffrement préalable. |
| **Division par zéro (mois)** | `max(1, monthsElapsed)` avant tout `/ pace`. `monthsRemaining ≤ 0` → `required = null`, `projected = confirmed`. |
| **Échéance dépassée** | `monthsRemaining ≤ 0` → état dédié (§6 D1), pas de `paceStatus` négatif. |
| **PAUSED** | `paceStatus = null` (pas de jugement de rythme sur un objectif en pause). |
| **Ancrage** | `createdAt` ramené à son **cycle** via `getBudgetPeriodForDate` (un objectif créé le 28 d'un payDay=25 appartient au cycle suivant). |
| **Pointage anticipé d'un mois futur** | On fait confiance au geste (KISS). Le confirmé peut dépasser le prévu cumulé. Edge connu, documenté, non bloqué. |

---

## 5. Couche prévu vs confirmé

Deux couches, deux sémantiques — ne jamais les confondre dans l'UI :

| Couche | Définition | Sert à |
|---|---|---|
| **Prévu cumulé** | Σ `line.amount` des Prévisions Épargne liées, mois écoulés/en cours. Pur `line.amount`, **sans enveloppe transactions** (cohérent avec le dashboard). | L'engagement : « ce que tu as prévu de mettre ». |
| **Confirmé** | Σ enveloppe **checked-only** (`checkedAt`), via `calculateRealizedSavings`. | La réalité pointée : « ce que tu as vraiment mis ». |

**Le % d'atteinte ET le déclencheur d'auto-complétion sont sur le CONFIRMÉ, jamais le prévu.** Un objectif n'est « atteint » que quand l'argent est pointé.

**Vocabulaire** : l'UI dit « **Pointé** » (glossaire). « Confirmé » reste un terme **interne** (calcul) — ne pas exposer un synonyme flottant à l'utilisateur.

---

## 6. Machine à états

```
        ┌─────────┐  pause   ┌────────┐
        │ ACTIVE  │─────────▶│ PAUSED │
        │         │◀─────────│        │
        └────┬────┘  reprend └────────┘
             │  ▲
   confirmé≥cible │  │ ré-ouvrir (réversible)
   → SUGGÈRE      ▼  │
        ┌──────────┴─┐
        │ COMPLETED  │
        └────────────┘
```

| Statut | Sens | Effet sur les Prévisions liées (v1) |
|---|---|---|
| `ACTIVE` | en cours | aucun — le statut est un **label** |
| `COMPLETED` | atteint | aucun — réversible via CTA « ré-ouvrir » |
| `PAUSED` | en pause | aucun — `paceStatus = null` |

**En v1, le statut est purement un label : il ne touche jamais aux Prévisions liées.** Les transitions de statut (PATCH `ACTIVE`/`COMPLETED`/`PAUSED`, ré-ouverture) sont du CRUD livré en **PUL-12**. L'arrêt effectif de la génération des Prévisions à `COMPLETED`/`PAUSED` est **Phase 3 (PUL-285)**.

**D1 — Échéance dépassée** : l'objectif **reste `ACTIVE`** (pas de 4ᵉ statut). Affichage factuel + CTA « repousser la date ». **Jamais rouge ni ambre** (cf. §7). `required = null` quand `monthsRemaining ≤ 0`.

**D2 — Auto-complétion** : quand `confirmed ≥ targetAmount`, Pulpe **suggère** « marquer terminé ? ». **Jamais d'auto-flip** — l'utilisateur garde le contrôle (pilier Contrôle).

---

## 7. Principe couleur

> **L'épargne est un objectif à atteindre, pas un risque à signaler (RG-002).**

| État | Couleur | Jamais |
|---|---|---|
| Épargne (catégorie, barres, montants) | Vert / Primary (`--pulpe-financial-savings`) | — |
| Objectif **en retard** (`behind`) | **Neutre / Primary** | ❌ ambre, ❌ rouge |
| Échéance **dépassée** | **Neutre** + CTA factuel | ❌ ambre, ❌ rouge |

Le rouge est **réservé au hero card en déficit global** (DA §3.7) — il n'a aucune place sur une page d'épargne. Un objectif en retard n'est pas une erreur : c'est une information neutre assortie d'une action (« repousser la date »). Le ton reste bienveillant, non-anxiogène.

---

## 8. FX — porte ouverte, dormante en v1

V1 = **devise du compte uniquement**. Les colonnes/champs FX existent et sont **retournés mais `null`** (pas de conversion). La porte multi-devise reste ouverte sans dette de schéma.

Door-keepers (PUL-12), à brancher dès l'introduction de la feature :

- **Mapper** `mapSavingsGoalCurrencyMetadataToApi` (ex-PUL-126) — **nouveau** mapper obligatoire : `savings_goal` stocke `original_target_amount` (≠ `original_amount` des autres tables) → ni `mapCurrencyMetadataToApi` ni `decryptRowAmountFields` génériques ne conviennent (ils visent le mauvais champ → cible à 0). Sérialise les métadonnées de devise, `null` en v1.
- **Contrainte DB** `fx_metadata_coherent` (ex-PUL-134) — `CHECK` garantissant que les colonnes FX sont cohérentes (toutes nulles, ou toutes renseignées). Miroir du pattern PUL-17.

---

## 9. Edge cases (récapitulatif)

| Cas | Décision |
|---|---|
| **Suppression d'objectif** | Délink obligatoire : `savings_goal_id = null` sur les lignes. **Durcir le FK en `ON DELETE SET NULL`** (`budget_line` + `template_line`). Aucune Prévision n'est supprimée. |
| **Déchiffrement de `target_amount`** | Déchiffrer aussi sur la **liste** + le **détail**, pas seulement `/progress` — sinon les cibles s'affichent à 0. |
| **`target_amount` lu = 0** | Toléré en lecture (le chiffrement écrit `0` en clair). Garde `achievementPercent = 0`. Ne jamais diviser par la cible sans déchiffrement. |
| **iOS `BudgetLineUpdate`** | Le DTO Swift doit porter `savingsGoalId` — sans lui, iOS ne peut pas taguer en édition (côté shared/web le champ est déjà hérité de `create` via `.partial()`). |
| **Changement de `kind`** | `kind ≠ saving` ⇒ `savingsGoalId = null` ; la progression re-filtre toujours `kind=saving`. |
| **`target_date` à la création** | Schéma durci : `z.iso.date()` + min aujourd'hui. Une date passée est refusée. |
| **Pointage anticipé (mois futur)** | On fait confiance au geste (KISS). Edge connu, documenté. |
| **Multi-objectif** | 1 Prévision = 1 objectif (FK simple) ; splitter = Prévisions distinctes. |
| **Régénération mensuelle** | Le lien survit via `template_line.savings_goal_id` (génération + propagation RG-001, budgets ajustés protégés). |

### Sweep multi-surfaces (piège PUL-17)

Toute modification de saisie/tagging doit balayer **les surfaces** — un oubli = lien invisible sur une plateforme :

1. Carte résumé Épargne (action « Voir mes objectifs ») — **web**
2. Carte résumé Épargne (action « Voir mes objectifs ») — **iOS**
3. Éditeur de Prévision Épargne du budget (`budget_line`, Add + Edit) — **iOS** (le DTO Swift `BudgetLineUpdate` doit gagner `savingsGoalId`)
4. Dialog de Prévision Épargne du budget (`budget_line`, create + edit) — **web**
5. **Éditeur de Prévision du Mois Type** (`template_line`) — **iOS + web** (surface de tagging **primaire**)

> ⚠️ Le lien vit sur `budget_line` / `template_line`, **jamais sur `transaction`** : les sheets « Add/Edit Transaction » ne portent **pas** de picker objectif.

---

## 10. Phasage

| Phase | Issue | Contenu |
|---|---|---|
| **Fondation + lien template** | **PUL-12** | `savings_goal` CRUD (dont transitions de statut), `savings_goal_id` sur `template_line` + `budget_line`, FK `ON DELETE SET NULL`, tagging manuel (template-line editor primaire + picker `budget_line`), door-keepers FX (mapper + `fx_metadata_coherent`), priorité retirée. |
| **Progression** | **PUL-8** | Endpoint `/:id/progress`, les 9 formules (§4), couches prévu/confirmé, `paceStatus`, lecture de l'état + comportements dérivés (D1 échéance dépassée, D2 auto-complétion suggérée). |
| **Phase 3** | **PUL-285** | Gestion des Prévisions générées : arrêt effectif à `COMPLETED`/`PAUSED`, auto-décomposition (cible / mois → ligne récurrente maintenue), re-projection + redistribution **advisory** (suggère, n'écrit rien sans accord). |

---

## Références

- Workflows modélisés : `docs/diagrams/savings-goals.c4` (createGoal, linkLine, monthlyContribution, trackProgress, autoDecompose, redistribution).
- Formules : `shared/src/calculators/budget-formulas.ts` (`calculateTotalSavings`, `calculateRealizedExpenses`), `shared/src/calculators/budget-period.ts` (`getBudgetPeriodForDate`). À créer en PUL-8 : `calculateRealizedSavings`, `paceStatus`, `PACE_TOLERANCE_PERCENT`.
- Chiffrement : `docs/ENCRYPTION.md`. Couleurs : `memory-bank/DA.md` §3.7. Sync template↔budget : RG-001 (`memory-bank/productContext.md`).
