# Objectifs d'épargne — Contrat métier et technique

> **Statut** : source de vérité métier (décisions tranchées). Public : devs back/front/iOS, product.
> **Périmètre** : modèle, accumulation, progression, simulateur, états, couleur, FX et edge cases.
> **Glossaire** : `budget_lines` = Prévisions · `kind=saving` = Épargne · `checked`/`checkedAt` = Pointé. Tutoiement, ton bienveillant non-anxiogène.

---

## 1. Vue d'ensemble & besoin

L'utilisateur veut **suivre un objectif d'épargne long terme sans recalculer à la main** : « combien j'ai mis de côté pour ma maison, et est-ce que je tiens le rythme ? ».

La fonctionnalité reste volontairement minimale afin de préserver le parcours quotidien :

- Un **objectif** = un nom, une cible, une échéance, un statut.
- Une **contribution** = le rattachement manuel d'une Prévision Épargne existante à cet objectif. Pas de nouveau geste de saisie, de priorité ni de sollicitation.
- Une **progression** dérivée des Prévisions liées et de leur pointage, exprimée en deux couches (prévu / confirmé).

Sur iOS, **Objectifs** est un onglet principal permanent. La **carte Épargne du dashboard** reste un résumé mensuel indépendant des objectifs et propose l'action explicite « Voir mes objectifs ». Elle n'affiche pas de pourcentage global vers les objectifs : son pourcentage décrit le mois courant, pas la progression d'un objectif.

---

## 2. Modèle de données

### 2.1 `savings_goal`

| Colonne         | Type                          | Note                                                                                                                                                                                                                    |
| --------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`            | uuid                          | PK                                                                                                                                                                                                                      |
| `user_id`       | uuid                          | RLS par user                                                                                                                                                                                                            |
| `name`          | text                          | libellé objectif                                                                                                                                                                                                        |
| `target_amount` | text                          | **chiffré AES-256-GCM** (cf. `docs/ENCRYPTION.md`)                                                                                                                                                                      |
| `target_date`   | date                          | échéance ; à la création, `z.iso.date()` + `.refine(d => d >= today)` (**pas** `.min()` — en Zod 4, `.min()` sur une string ISO mesure la **longueur**, pas la date) ; au plus la **120e période**, mois courant inclus |
| `status`        | enum                          | `ACTIVE` / `COMPLETED` / `PAUSED` (cf. §6)                                                                                                                                                                              |
| `initial_amount` | text (nullable)              | **chiffré AES-256-GCM** — montant de départ déjà épargné avant le suivi. `null ≡ 0`. Devise du compte, **hors** contrainte `fx_metadata_coherent` (pas de FX v1). Stock one-shot : compte dans le confirmé, jamais dans le rythme (cf. §4)  |
| `priority`      | enum (nullable, **dormante**) | **retirée du produit** — voir ci-dessous                                                                                                                                                                                |
| colonnes FX     | text/null                     | métadonnées de devise, nulles dans la devise du compte (cf. §8)                                                                                                                                                         |

**Priorité** : le produit n'expose aucune notion de priorité sur l'épargne. `priority` est absente du formulaire et des schémas `create`/`response`. La colonne nullable reste dormante pour préserver la compatibilité du schéma.

### 2.2 Le lien Prévision ↔ objectif (décision clé)

Le rattachement vit **au niveau du modèle**, pas seulement sur la Prévision du mois courant.

| Table           | Colonne                      | Rôle                        |
| --------------- | ---------------------------- | --------------------------- |
| `template_line` | `savings_goal_id` (nullable) | source de vérité récurrente |
| `budget_line`   | `savings_goal_id` (nullable) | lien effectif d'un mois     |

**FK** : `savings_goal_id → savings_goal.id` utilise **`ON DELETE SET NULL`** sur les deux tables. Supprimer un objectif délie les Prévisions sans les supprimer.

**Pourquoi `template_line` doit porter le lien** : sans ça, une épargne récurrente régénérée chaque mois repartirait **non-liée** → l'objectif perdrait ses contributions futures. Le lien doit survivre à la régénération mensuelle (cf. §3).

---

## 3. Modèle d'accumulation

### 3.1 Rattachement manuel

Une contribution n'est **jamais** un nouveau type de saisie : c'est le champ `savingsGoalId` renseigné sur une Prévision `kind=saving`. Surfaces de rattachement :

- **Primaire** : l'**éditeur de Prévision du Mois Type** (template-line editor, iOS + web) → pose `template_line.savings_goal_id`, ce qui propage à tous les mois générés.
- **Secondaire** : le picker sur `budget_line` → ponctuel, mois courant, ou rétroactif.

### 3.2 Comment le lien survit aux mois

1. **Génération depuis template** : créer un budget copie `template_line.savings_goal_id → budget_line.savings_goal_id`.
2. **Propagation RG-001** (Template ↔ Budget Sync) : la propagation copie aussi `savings_goal_id`, sauf pour les budgets manuellement ajustés, qui restent protégés. La RPC valide le payload strict et conserve l'isolation entre utilisateurs.
3. **Mois courant / rétroactif** : le picker `budget_line` permet de (dé)taguer un mois isolé sans toucher au template.

> Conséquence : taguer dans le Mois Type = taguer **tous** les mois futurs d'un coup ; taguer sur `budget_line` = un seul mois.

### 3.3 Multi-objectif

**1 Prévision = 1 objectif** (FK simple). Pour répartir une épargne entre plusieurs objectifs, créer des **Prévisions Épargne distinctes**, une par objectif. Pas de split au niveau ligne.

### 3.4 Changement de `kind`

Si une Prévision passe de `saving` à un autre `kind`, `savingsGoalId` est forcé à `null`. La progression re-filtre **toujours** `kind=saving` côté lecture (double garde).

### 3.5 Auto-décomposition à la création (PUL-285)

À la création d'un objectif, une option (proposée par défaut, jamais imposée) décompose la cible en mensualité et pose la baseline récurrente liée :

- **Formule** : même base que la formule 5 (`required` avec confirmé = 0) — `cible / monthsRemaining`, payDay-aware, mois courant ET mois d'échéance inclus. Arrondi au **centime supérieur** pour que `mensualité × mois ≥ cible` (jamais de shortfall d'arrondi). Helper partagé `suggestedMonthlyContribution` (`shared/src/calculators/savings-goal-progress.ts`), miroir Swift dans `SavingsPlanCalculator`.
- **Contrat** : le client pré-remplit la suggestion, l'utilisateur garde la main sur le montant. `POST /v1/savings-goals` porte `monthlyContribution` (optionnel, positif) — présence = opt-in ; le serveur écrit le montant reçu tel quel.
- **Écriture** : le serveur pose une `template_line` liée (`kind=saving`, récurrence `fixed`, nom = celui de l'objectif) sur le **Mois Type par défaut**, puis la propage aux budgets matérialisés courant+futurs — même machinerie atomique que le bulk template-line (RG-001 : budgets manuellement ajustés protégés, montants chiffrés). Best-effort : sans Mois Type par défaut ou si la propagation échoue, l'objectif est créé sans ligne (log warn, jamais d'échec de création).
- **Maintenance** : la ligne générée est ensuite une Prévision comme les autres — le lien survit via §3.2, la propagation RG-001 la maintient jusqu'à override manuel. Pulpe ne recalcule **jamais** son montant en silence (« Redistribution jamais silencieuse ») : la dérive se gère via le simulateur (§10).

---

## 4. Formules de progression

Règles de calcul structurantes :

- `plannedCumulative` est une **somme brute de `line.amount`**, surtout **PAS** `calculateTotalSavings` : cette dernière applique l'enveloppe `max(line, consumed)`, incompatible avec « pur line.amount ». Elle n'est **pas** réutilisée ici.
- `getBudgetPeriodForDate`, payDay-aware, fournit l'index de période (`year * 12 + month`).
- `calculateRealizedSavings` filtre strictement `kind === 'saving'` et exclut les transactions libres : un objectif ne comptabilise que les montants pointés de ses Prévisions liées.
- `paceStatus` applique une tolérance de `PACE_TOLERANCE_PERCENT = 5 %`.

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

// 2. Confirmé — STOCK = montant de départ + enveloppe checked-only (checkedAt), tous mois
//    calculateRealizedSavings : filtre kind==='saving' STRICT (PAS isOutflowKind)
//    ET retire le bloc free-transaction (budgetLineId='') — un objectif n'a que des lignes liées
linesConfirmed = Σ calculateRealizedSavings(linkedSavingLines, linkedTransactions)
confirmed      = initialAmount + linesConfirmed     // initialAmount (§2.1) : stock one-shot, null ≡ 0

// 3. % d'atteinte — sur le CONFIRMÉ, jamais le prévu
achievementPercent = round( min(confirmed / targetAmount, 1) * 100 )
//   garde : targetAmount = 0 → 0   (ne JAMAIS diviser par une cible non déchiffrée / nulle)

// 4. Rythme — DEUX rythmes, tous deux en FLUX (le montant de départ, stock one-shot, en est EXCLU :
//    l'inclure gonflerait projection et date d'atteinte estimée)
pace          = plannedCumulative / max(1, monthsElapsed)   // engagement (indicatif secondaire)
confirmedPace = linesConfirmed    / max(1, monthsElapsed)   // réel pointé — base de la projection

// 5. Requis pour tenir l'échéance
required = max(0, targetAmount − confirmed) / monthsRemaining
//   = null si monthsRemaining ≤ 0  (échéance dépassée)

// 6. Projection à l'échéance — sur le rythme CONFIRMÉ (sinon contredit la barre, qui est sur confirmed)
projected = confirmed + confirmedPace * monthsRemaining
//   = confirmed si monthsRemaining ≤ 0

// 7. Statut de rythme (tolérance ±5 %, projected vs targetAmount)
paceStatus = behind | on_track | ahead          // via paceStatus(projected, targetAmount, PACE_TOLERANCE_PERCENT)
//   PAUSED          → pas de status (null)
//   échéance dépassée → état dédié (cf. §6), PAS « behind » générique
```

### 4.3 Cas limites des formules

| Cas                                   | Règle                                                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Division par zéro (cible)**         | `targetAmount = 0` → `achievementPercent = 0`. Jamais de division sans déchiffrement préalable.                                      |
| **Division par zéro (mois)**          | `max(1, monthsElapsed)` avant tout `/ pace`. `monthsRemaining ≤ 0` → `required = null`, `projected = confirmed`.                     |
| **Échéance dépassée**                 | `monthsRemaining ≤ 0` → état dédié (§6), pas de `paceStatus` négatif.                                                                |
| **PAUSED**                            | `paceStatus = null` (pas de jugement de rythme sur un objectif en pause).                                                            |
| **Ancrage**                           | `createdAt` ramené à son **cycle** via `getBudgetPeriodForDate` (un objectif créé le 28 d'un payDay=25 appartient au cycle suivant). |
| **Pointage anticipé d'un mois futur** | Le pointage est accepté ; le confirmé peut dépasser le prévu cumulé.                                                                 |
| **Montant de départ (stock vs flux)** | `initialAmount` entre dans `confirmed` (barre, %, `required`, `projected`, D2) mais **jamais** dans `confirmedPace` ni `cumulativeGap` (`= plannedCumulative − linesConfirmed`). |
| **Montant de départ ≥ cible**         | `suggestCompletion = true` dès la création (D2) — jamais d'auto-flip, l'utilisateur confirme.                                        |

---

## 5. Couche prévu vs confirmé

Deux couches, deux sémantiques — ne jamais les confondre dans l'UI :

| Couche           | Définition                                                                                                                                            | Sert à                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Prévu cumulé** | Σ `line.amount` des Prévisions Épargne liées, mois écoulés/en cours. Pur `line.amount`, **sans enveloppe transactions** (cohérent avec le dashboard). | L'engagement : « ce que tu as prévu de mettre ».    |
| **Confirmé**     | Σ enveloppe **checked-only** (`checkedAt`), via `calculateRealizedSavings`.                                                                           | La réalité pointée : « ce que tu as vraiment mis ». |

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

| Statut      | Sens     | Effet sur les Prévisions liées                                                                          |
| ----------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `ACTIVE`    | en cours | aucun                                                                                                    |
| `COMPLETED` | atteint  | **arrêt de génération** (PUL-285 CA5) — réversible via CTA « ré-ouvrir »                                 |
| `PAUSED`    | en pause | **arrêt de génération** (PUL-285 CA5) — `paceStatus = null`                                              |

**Arrêt de génération (PUL-285 CA5)** : quand l'objectif n'est pas `ACTIVE`, `create_budget_from_template` ne copie plus ses `template_line` liées — les nouveaux budgets naissent **sans** la prévision liée (les autres lignes du Mois Type sont intactes). Le retour à `ACTIVE` reprend la génération pour les budgets suivants ; les mois générés pendant l'arrêt ne sont **pas** rétro-remplis (gaps assumés, cf. §10.2). Les Prévisions liées **déjà générées** ne sont jamais modifiées ni supprimées par une transition de statut — leur gestion est advisory : `GET /v1/savings-goals/:id/future-lines` liste les candidates (liées, non pointées, non ajustées à la main, cycle courant payDay-aware et au-delà), puis `POST /v1/savings-goals/:id/generation-stop` applique la décision explicite — `freeze` = garder la prévision, la délier et la marquer `is_manually_adjusted` (bouclier RG-001) ; `remove` = la supprimer (ses transactions deviennent libres). Gardes CA9 atomiques : jamais de mois passé, de ligne pointée ou déjà ajustée. Les transitions utilisent `PATCH` avec `ACTIVE`, `COMPLETED` ou `PAUSED`.

**Échéance dépassée** : l'objectif **reste `ACTIVE`** (pas de 4ᵉ statut). Affichage factuel + CTA « repousser la date ». **Jamais rouge ni ambre** (cf. §7). `required = null` quand `monthsRemaining ≤ 0`.

**Complétion suggérée** : quand `confirmed ≥ targetAmount`, Pulpe propose « marquer terminé ? ». Le statut ne change jamais sans confirmation de l'utilisateur.

---

## 7. Principe couleur

> **L'épargne est un objectif à atteindre, pas un risque à signaler (RG-002).**

| État                                  | Couleur                                      | Jamais             |
| ------------------------------------- | -------------------------------------------- | ------------------ |
| Épargne (catégorie, barres, montants) | Vert / Primary (`--pulpe-financial-savings`) | —                  |
| Objectif **en retard** (`behind`)     | **Neutre / Primary**                         | ❌ ambre, ❌ rouge |
| Échéance **dépassée**                 | **Neutre** + CTA factuel                     | ❌ ambre, ❌ rouge |

Le rouge est **réservé au hero card en déficit global** (DA §3.7) — il n'a aucune place sur une page d'épargne. Un objectif en retard n'est pas une erreur : c'est une information neutre assortie d'une action (« repousser la date »). Le ton reste bienveillant, non-anxiogène.

---

## 8. Devise et métadonnées FX

Les objectifs utilisent la **devise du compte**. Les champs FX sont retournés à `null` lorsqu'aucune conversion n'est nécessaire.

Deux gardes préservent la cohérence des métadonnées :

- **Mapper** `mapSavingsGoalCurrencyMetadataToApi` : `savings_goal` stocke `original_target_amount`, contrairement au champ `original_amount` des autres tables. Le mapper dédié sérialise correctement ces métadonnées, qui restent `null` dans la devise du compte.
- **Contrainte DB** `fx_metadata_coherent` : les colonnes FX sont soit toutes nulles, soit toutes renseignées.

---

## 9. Cas limites

| Cas                                  | Décision                                                                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Suppression d'objectif**           | Les FK `ON DELETE SET NULL` délient `budget_line` et `template_line`. Aucune Prévision n'est supprimée.                                                         |
| **Déchiffrement de `target_amount`** | La liste, le détail et `/progress` déchiffrent la cible avant de l'exposer.                                                                                     |
| **`target_amount` lu = 0**           | Toléré en lecture (le chiffrement écrit `0` en clair). Garde `achievementPercent = 0`. Ne jamais diviser par la cible sans déchiffrement.                       |
| **iOS `BudgetLineUpdate`**           | Le DTO Swift porte `savingsGoalId` afin de permettre le rattachement en édition.                                                                                |
| **Changement de `kind`**             | `kind ≠ saving` ⇒ `savingsGoalId = null` ; la progression re-filtre toujours `kind=saving`.                                                                     |
| **`target_date` à la création**      | Le schéma impose `z.iso.date()` et une date au moins égale à aujourd'hui.                                                                                       |
| **Horizon maximal**                  | Création et modification refusent une échéance après la 120e période, mois courant inclus. La timeline et le payload d'application sont bornés au même horizon. |
| **Pointage anticipé (mois futur)**   | Le pointage est accepté ; le confirmé peut dépasser le prévu cumulé.                                                                                            |
| **Multi-objectif**                   | 1 Prévision = 1 objectif (FK simple) ; splitter = Prévisions distinctes.                                                                                        |
| **Régénération mensuelle**           | Le lien survit via `template_line.savings_goal_id` (génération + propagation RG-001, budgets ajustés protégés).                                                 |

Le lien vit sur `budget_line` et `template_line`, jamais sur `transaction`. Les formulaires de transaction ne proposent donc pas de rattachement à un objectif.

---

## 10. Simulateur de plan

Le simulateur répond à « qu'est-ce que je fais maintenant ? » sans modifier le Mois Type. Toute simulation reste locale jusqu'à une confirmation explicite.

### 10.1 Surfaces et sémantique

- **Ta trajectoire** : quatre séries cumulées, Pointé, Prévu, Projection et Cible. La simulation remplace la projection future par le brouillon.
- **Ton plan, mois par mois** : timeline verticale de l'ancrage à l'échéance. Les mois passés et les Prévisions pointées sont verrouillés.
- **Ajuster mon plan** : sandbox client, montant global et ajustements mensuels. « Réajuster la suite » redistribue le reste sur les mois ouverts.
- **Appliquer** : récapitulatif obligatoire puis écriture pessimiste. Annuler ou quitter ne persiste rien.
- Les contributions réelles restent consultables séparément dans « Ton suivi ».
- Les couleurs suivent RG-002 : vert épargne et neutres, jamais ambre ou rouge.

### 10.2 Contrat de lecture

`GET /v1/savings-goals/:id/progress` reste l'unique lecture. En plus des métriques de progression, il expose :

- `cumulativeGap = plannedCumulative - linesConfirmed`, signé et jamais borné (flux : le montant de départ en est exclu, cf. §4.3) ;
- `estimatedCompletion`, période d'atteinte estimée au rythme pointé, ou `null` si elle n'est pas calculable ;
- `initialAmount`, le montant de départ déchiffré (0 si absent) — écho pour l'affichage et le seed des simulations client ;
- `months[]`, une ligne par période avec état temporel, montants prévu/pointé/cumulés, lignes liées et capacité de provisioning. Le cumul confirmé est **seedé** à `initialAmount` : `months[indexCourant].confirmedCumulative == confirmed`.

La timeline est payDay-aware et bornée à 120 périodes. Un budget absent n'est ajustable que si le Mois Type par défaut contient une Prévision Épargne liée permettant de le créer. Un budget existant sans ligne liée reste un gap non provisionnable.

### 10.3 Simulation locale

Les calculateurs shared, avec miroir testé sur iOS, portent quatre opérations pures :

1. construire la timeline de l'ancrage à l'échéance ;
2. appliquer un brouillon global ou mensuel uniquement aux mois ouverts ;
3. redistribuer le montant restant au centime près en respectant les mois épinglés ;
4. répartir le montant d'un mois entre ses lignes ouvertes, proportionnellement puis par plus grand reste.

La simulation (2) et la redistribution (3) reçoivent `initialAmount` en **seed** : le cumul simulé démarre au montant de départ et le restant à redistribuer le soustrait (`max(0, cible − initialAmount − pointé verrouillé − épinglé)`). Le seed vit dans le calculateur (qui re-cumule from scratch), jamais en plus des cumuls serveur déjà seedés — pas de double comptage.

Le serveur reste autoritaire à l'écriture. Les clients ne recalculent jamais le contrat de progression serveur.

### 10.4 Contrat d'application

`POST /v1/savings-goals/:id/plan` accepte deux collections strictes :

- `monthAdjustments[]` : `{ budgetLineId, amount }` pour les Prévisions matérialisées ;
- `missingMonthAdjustments[]` : `{ month, year, amount }` pour les périodes absentes mais provisionnables.

Le flux valide toutes les préconditions avant mutation, provisionne les budgets absents de façon idempotente, puis applique les montants dans une RPC atomique sérialisée par objectif. La RPC refuse toute ligne étrangère, non liée, non-Épargne, passée ou pointée. Les ajustements appliqués deviennent manuels et sortent de RG-001 ; le Mois Type n'est jamais modifié.

Les montants sont chiffrés via `ENCRYPTION_PORT`. Une application dans la devise du compte remet les métadonnées FX source de la Prévision à `null`. Après succès ou provisioning partiel suivi d'un échec, les caches objectifs et budgets sont invalidés avant relecture.

### 10.5 Conflits et reprise

- ligne invalide ou mois non provisionnable : erreur 422 ;
- ligne pointée ou période devenue passée pendant la simulation : conflit 409, puis relecture et nouvelle simulation ;
- autre échec d'application : erreur serveur et retry sûr sur les budgets déjà provisionnés.

L'application ne requiert pas de clé d'idempotence : le provisioning réutilise les budgets existants et l'écriture finale est un update par valeur sous verrou.

---

## Références

- Workflows modélisés : `docs/diagrams/savings-goals.c4`.
- Formules : `shared/src/calculators/budget-formulas.ts`, `shared/src/calculators/budget-period.ts`, `shared/src/calculators/savings-goal-progress.ts` et `shared/src/calculators/savings-goal-plan.ts`.
- Chiffrement : `docs/ENCRYPTION.md`. Couleurs : `memory-bank/DA.md` §3.7. Sync template↔budget : RG-001 (`memory-bank/productContext.md`).
