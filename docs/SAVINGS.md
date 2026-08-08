# Objectifs d'épargne — Contrat métier et technique

> **Statut** : source de vérité métier (décisions tranchées). Public : devs back/front/iOS, product.
> **Périmètre** : modèle, accumulation, progression, simulateur, états, couleur, FX et edge cases.
> **Glossaire** : `budget_lines` = Prévisions · `kind=saving` = Épargne · `checked`/`checkedAt` = Pointé. Tutoiement, ton bienveillant non-anxiogène.

---

## 1. Vue d'ensemble & besoin

L'utilisateur veut **suivre un objectif d'épargne long terme sans recalculer à la main** : « combien j'ai mis de côté pour ma maison, et est-ce que je tiens le rythme ? ».

La fonctionnalité reste volontairement minimale afin de préserver le parcours quotidien :

- Un **objectif** = un nom obligatoire, avec début, cible et échéance
  indépendamment optionnels, plus un statut.
- Une **contribution** = le rattachement manuel d'une Prévision Épargne existante à cet objectif. Pas de nouveau geste de saisie, de priorité ni de sollicitation.
- Une **progression** dérivée des Prévisions liées et de leur pointage, exprimée en deux couches (prévu / confirmé).

Sur iOS, **Objectifs** est un onglet principal permanent. La **carte Épargne du dashboard** reste un résumé mensuel indépendant des objectifs et propose l'action explicite « Voir mes objectifs ». Elle n'affiche pas de pourcentage global vers les objectifs : son pourcentage décrit le mois courant, pas la progression d'un objectif.

---

## 2. Modèle de données

### 2.1 `savings_goal`

| Colonne          | Type                          | Note                                                                                                                                                                                                                                       |
| ---------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`             | uuid                          | PK                                                                                                                                                                                                                                         |
| `user_id`        | uuid                          | RLS par user                                                                                                                                                                                                                               |
| `name`           | text                          | libellé objectif                                                                                                                                                                                                                           |
| `start_date`     | date (nullable)               | début explicite de l'intervalle ; s'il est absent, l'ancrage historique reste le cycle de création                                                                                                                                         |
| `target_amount`  | text (nullable)               | **chiffré AES-256-GCM** (cf. `docs/ENCRYPTION.md`) ; une cible absente reste SQL `NULL`, jamais un zéro chiffré                                                                                                                            |
| `target_date`    | date (nullable)               | échéance ; si présente à la création, `z.iso.date()` + `.refine(d => d >= today)` (**pas** `.min()` — en Zod 4, `.min()` sur une string ISO mesure la **longueur**, pas la date) ; au plus la **120e période**, mois courant inclus        |
| `status`         | enum                          | `ACTIVE` / `COMPLETED` / `PAUSED` (cf. §6)                                                                                                                                                                                                 |
| `initial_amount` | text (nullable)               | **chiffré AES-256-GCM** — montant de départ déjà épargné avant le suivi. `null ≡ 0`. Devise du compte, **hors** contrainte `fx_metadata_coherent` (pas de FX v1). Stock one-shot : compte dans le confirmé, jamais dans le rythme (cf. §4) |
| `priority`       | enum (nullable, **dormante**) | **retirée du produit** — voir ci-dessous                                                                                                                                                                                                   |
| colonnes FX      | text/null                     | métadonnées de devise, nulles dans la devise du compte (cf. §8)                                                                                                                                                                            |

**Priorité** : le produit n'expose aucune notion de priorité sur l'épargne. `priority` est absente du formulaire et des schémas `create`/`response`. La colonne nullable reste dormante pour préserver la compatibilité du schéma.

**Contrat d'intervalle** : `POST` exige seulement `name`. `startDate`,
`targetAmount` et `targetDate` peuvent être fournis indépendamment. Sur `PATCH`,
une propriété omise reste inchangée, `null` la retire et une valeur la remplace.
Si début et échéance sont tous deux présents après fusion du patch,
`startDate <= targetDate`. Retirer la cible efface aussi toutes ses métadonnées
FX (`original_target_amount`, devises et taux).

### 2.2 Le lien Prévision ↔ objectif (décision clé)

Le rattachement vit **au niveau du modèle**, pas seulement sur la Prévision du mois courant.

| Table           | Colonne                      | Rôle                        |
| --------------- | ---------------------------- | --------------------------- |
| `template_line` | `savings_goal_id` (nullable) | source de vérité récurrente |
| `budget_line`   | `savings_goal_id` (nullable) | lien effectif d'un mois     |

**FK** : `savings_goal_id → savings_goal.id` utilise **`ON DELETE SET NULL`** sur les deux tables. Le mode de suppression sûr s'appuie sur cette règle pour délier les Prévisions sans les supprimer ; les modes destructifs les suppriment explicitement (§9).

**Pourquoi `template_line` doit porter le lien** : sans ça, une épargne récurrente régénérée chaque mois repartirait **non-liée** → l'objectif perdrait ses contributions futures. Le lien doit survivre à la régénération mensuelle (cf. §3).

---

## 3. Modèle d'accumulation

### 3.1 Rattachement manuel

Une contribution n'est **jamais** un nouveau type de saisie : c'est le champ `savingsGoalId` renseigné sur une Prévision `kind=saving`. Surfaces de rattachement :

- **Primaire** : l'**éditeur de Prévision du Mois Type** (template-line editor, iOS + web) → pose `template_line.savings_goal_id`, ce qui propage à tous les mois générés.
- **Secondaire** : le picker sur `budget_line` → ponctuel, mois courant, ou rétroactif.
- **Création lissée** : une nouvelle Prévision Épargne peut porter un objectif ; le même `savingsGoalId` est appliqué atomiquement à toutes ses tranches `one_off`, en mode total comme par mois.

### 3.2 Comment le lien survit aux mois

1. **Génération depuis template** : créer un budget copie `template_line.savings_goal_id → budget_line.savings_goal_id`.
2. **Propagation RG-001** (Template ↔ Budget Sync) : la propagation copie aussi `savings_goal_id`, sauf pour les budgets manuellement ajustés, qui restent protégés. La RPC valide le payload strict et conserve l'isolation entre utilisateurs.
3. **Mois courant / rétroactif** : le picker `budget_line` permet de (dé)taguer un mois isolé sans toucher au template.

> Conséquence : taguer dans le Mois Type = taguer **tous** les mois futurs d'un coup ; taguer sur `budget_line` = un seul mois.

### 3.3 Multi-objectif

**1 Prévision = 1 objectif** (FK simple). Pour répartir une épargne entre plusieurs objectifs, créer des **Prévisions Épargne distinctes**, une par objectif. Pas de split au niveau ligne.

### 3.4 Changement de `kind`

Si une Prévision passe de `saving` à un autre `kind`, `savingsGoalId` est forcé à `null`. La progression re-filtre **toujours** `kind=saving` côté lecture (double garde).

### 3.5 Auto-décomposition à la création (PUL-285, PUL-316)

À la création d'un objectif, une option (proposée par défaut, jamais imposée) décompose la cible en mensualité et matérialise le plan :

- **Formule** : même base que la formule 5 (`required` avec confirmé = 0) — `cible / monthsRemaining`, payDay-aware, mois courant ET mois d'échéance inclus. Arrondi au **centime supérieur** pour que `mensualité × mois ≥ cible` (jamais de shortfall d'arrondi). Helper partagé `suggestedMonthlyContribution` (`shared/src/calculators/savings-goal-progress.ts`), miroir Swift dans `SavingsPlanCalculator`.
- **Contrat** : le client pré-remplit la suggestion, l'utilisateur garde la main sur le montant. `POST /v1/savings-goals` porte `monthlyContribution` (optionnel, positif) — présence = opt-in ; le serveur écrit le montant reçu tel quel.
- **Le contenant épouse l'horizon (PUL-316)** : un objectif daté est un engagement **borné**, donc il se matérialise en Prévisions `one_off` liées — une par période, du mois courant à l'échéance incluse — et **ne pose rien sur le Mois Type**. Y poser une récurrence signifierait « tous les mois, indéfiniment » : le modèle porterait l'objectif à vie et son solde net serait faux dès le mois suivant l'échéance. C'est la cause racine que PUL-311 n'avait pu que contenir côté génération.
- **Écriture** : le serveur passe par le lissage (`BUDGET_LINE_SPREAD_PORT`, cf. `docs/SPREAD.md`) — insertion ensembliste atomique, groupée par `spread_group_id`, recalcul des budgets touchés et invalidation de cache incluses. L'identifiant de l'objectif **est** la clé d'idempotence du groupe : un objectif, un groupe. Best-effort : si le lissage échoue, l'objectif est créé sans prévision (log warn, jamais d'échec de création) ; s'il a committé mais que le recalcul échoue, un code dédié demande au client de rafraîchir sans recréer.
- **Aucun budget créé au passage** : seules les périodes **déjà budgétées** reçoivent leur prévision. Créer un objectif ne matérialise jamais de budget — un objectif à dix ans n'a pas à faire apparaître dix ans de budgets. Les périodes plus lointaines restent des **trous du plan**, que le simulateur comble à la demande (§10).
- **Pourquoi le lien survit sans `template_line`** : §3.2 protège un lien qui doit traverser la régénération mensuelle. Une `one_off` n'est jamais régénérée — il n'y a rien à quoi survivre. La progression (§4.1) ne filtre d'ailleurs aucune récurrence : une `one_off` liée compte exactement comme une récurrente.
- **Maintenance** : les prévisions générées sont ensuite des Prévisions comme les autres, modifiables et supprimables une par une. Le nom de l'objectif ne leur sert que de **valeur initiale**. Pulpe ne recalcule **jamais** leur montant en silence (« Redistribution jamais silencieuse ») : la dérive se gère via le simulateur (§10).

Un objectif **sans échéance** est un horizon ouvert : la création ne tente pas
de matérialiser une liste finie de `one_off`. Si la mensualité est activée, elle
reste une `template_line` récurrente et sa propagation commence au cycle courant
calculé avec `payDayOfMonth` — y compris le budget du mois civil précédent avant
le jour de paie. Sa timeline s'arrête au dernier mois lié, avec un plancher au
cycle courant.

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
// Ancrage historique stable, payDay-aware
indexCreation  = cycle(goal.createdAt)
indexDebut     = cycle(goal.startDate) si présent, sinon indexCreation
indexAncrage   = max(indexCreation, indexDebut)
indexCourant   = year(now)     * 12 + month(now)
indexRestant   = max(indexCourant, indexAncrage)
indexEcheance  = cycle(targetDate) si présente

monthsElapsed    = indexCourant − indexAncrage + 1          // ≥ 1 par construction
monthsRemaining  = indexEcheance − indexRestant + 1         // null sans échéance

// 1. Prévu cumulé — pur line.amount des mois ≤ now (PAS d'enveloppe transactions)
plannedCumulative = Σ line.amount  (indexAncrage ≤ mois ≤ indexCourant)
plannedProjection = initialAmount + Σ line.amount
                    (indexAncrage ≤ mois ≤ indexEcheance, ou sans borne haute)

// 2. Confirmé — STOCK = montant de départ + enveloppe checked-only (checkedAt), tous mois
//    calculateRealizedSavings : filtre kind==='saving' STRICT (PAS isOutflowKind)
//    ET retire le bloc free-transaction (budgetLineId='') — un objectif n'a que des lignes liées
linesConfirmed = Σ calculateRealizedSavings(linkedSavingLines, linkedTransactions)
withdrawn      = Σ retrait.amount                   // retraits liés (§11), toujours positifs
confirmed      = initialAmount + linesConfirmed − withdrawn   // initialAmount (§2.1) : stock one-shot, null ≡ 0
//   jamais clampé à 0 : l'écriture interdit le découvert, un négatif signale une incohérence à diagnostiquer

// 3. % d'atteinte — sur le CONFIRMÉ, jamais le prévu
achievementPercent = round( min(confirmed / targetAmount, 1) * 100 )
//   garde : targetAmount = 0 → 0   (ne JAMAIS diviser par une cible non déchiffrée / nulle)
//   cible absente → null

// 4. Rythme — DEUX rythmes, tous deux en FLUX (le montant de départ ET les retraits, stocks, en sont EXCLUS)
pace          = plannedCumulative / max(1, monthsElapsed)   // engagement (indicatif secondaire)
confirmedPace = linesConfirmed    / max(1, monthsElapsed)   // réel pointé — base de la date d'atteinte estimée

// 5. Requis pour tenir l'échéance
required = max(0, targetAmount − confirmed) / monthsRemaining
//   = null sans cible, sans échéance ou si monthsRemaining ≤ 0

// 6. Projection à l'échéance — solde confirmé + reliquat du plan courant/futur
//    Pour chaque période courante→échéance :
//    remaining(period) = max(0, Σ line.amount − calculateRealizedSavings(period))
projected = confirmed + Σ remaining(period)
//   = null sans cible ou sans échéance ; = confirmed si monthsRemaining ≤ 0

// 7. Statut de rythme (tolérance ±5 %, projected vs targetAmount)
paceStatus = behind | on_track | ahead          // via paceStatus(projected, targetAmount, PACE_TOLERANCE_PERCENT)
//   PAUSED          → pas de status (null)
//   échéance dépassée → état dédié (cf. §6), PAS « behind » générique
```

### 4.3 Cas limites des formules

| Cas                                   | Règle                                                                                                                                                                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Division par zéro (cible)**         | `targetAmount = 0` → `achievementPercent = 0`. Jamais de division sans déchiffrement préalable.                                                                                                                                                            |
| **Division par zéro (mois)**          | `max(1, monthsElapsed)` avant tout `/ pace`. `monthsRemaining ≤ 0` → `required = null`, `projected = confirmed`.                                                                                                                                           |
| **Échéance dépassée**                 | `monthsRemaining ≤ 0` → état dédié (§6), pas de `paceStatus` négatif.                                                                                                                                                                                      |
| **PAUSED**                            | `paceStatus = null` (pas de jugement de rythme sur un objectif en pause).                                                                                                                                                                                  |
| **Ancrage**                           | `createdAt` ramené à son **cycle** via `getBudgetPeriodForDate` (un objectif créé le 28 d'un payDay=25 appartient au cycle suivant).                                                                                                                       |
| **Pointage anticipé d'un mois futur** | Le pointage est accepté ; il entre dans `confirmed` et est retiré du reliquat planifié pour ne pas être compté deux fois.                                                                                                                                  |
| **Montant de départ (stock vs flux)** | `initialAmount` entre dans `confirmed` (barre, %, `required`, `projected`, D2) mais **jamais** dans `confirmedPace` ni `cumulativeGap` (`= plannedCumulative − (linesConfirmed − retraits déjà survenus)`).                                                |
| **Retrait (stock vs flux)**           | Se retranche de `confirmed` (donc de la barre, du %, de `required`, de `projected`, de `estimatedCompletion`) et de `cumulativeGap` pour les retraits déjà survenus, mais **jamais** de `confirmedPace`, `plannedCumulative` ni `plannedProjection` (§11). |
| **Montant de départ ≥ cible**         | `suggestCompletion = true` dès la création (D2) — jamais d'auto-flip, l'utilisateur confirme.                                                                                                                                                              |
| **Cible absente**                     | `achievementPercent` et `suggestCompletion` sont `null`. La simulation garde son cumul final mais ses verdicts cible et la redistribution sont désactivés.                                                                                                 |
| **Échéance absente**                  | `monthsRemaining`, `required`, `projected` et `paceStatus` sont `null`, `isOverdue = false`. Une cible présente conserve `estimatedCompletion` si le rythme confirmé suffit.                                                                               |

### 4.4 Matrice cible / échéance

| Cible | Échéance | Métriques applicables                                                             |
| ----- | -------- | --------------------------------------------------------------------------------- |
| non   | non      | cumuls, rythme observé et `plannedProjection` ; aucune métrique cible ou échéance |
| oui   | non      | progression cible et estimation d'atteinte ; aucune métrique d'échéance           |
| non   | oui      | fenêtre temporelle ; aucune projection ou verdict de cible                        |
| oui   | oui      | contrat complet, dont requis, projection et statut de rythme                      |

---

## 5. Couche prévu vs confirmé

Deux couches, deux sémantiques — ne jamais les confondre dans l'UI :

| Couche           | Définition                                                                                                                                            | Sert à                                              |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Prévu cumulé** | Σ `line.amount` des Prévisions Épargne liées, mois écoulés/en cours. Pur `line.amount`, **sans enveloppe transactions** (cohérent avec le dashboard). | L'engagement : « ce que tu as prévu de mettre ».    |
| **Confirmé**     | `initialAmount` + Σ enveloppe **checked-only** (`checkedAt`), via `calculateRealizedSavings`.                                                         | La réalité : « ce que tu as vraiment mis de côté ». |

**Le % d'atteinte ET le déclencheur d'auto-complétion sont sur le CONFIRMÉ, jamais le prévu.** Un objectif n'est « atteint » que quand l'argent est réellement de côté — pointé, ou déclaré comme montant de départ.

**Vocabulaire** : l'UI dit « **Épargné** » pour cette couche agrégée, et « **Pointé** » (glossaire) uniquement pour l'état `checked` d'une **ligne**. Depuis le montant de départ (§2.1), le confirmé additionne un stock que l'utilisateur n'a jamais pointé : l'appeler « Pointé » affirmerait un geste qu'il n'a pas fait (« Tu as pointé de quoi atteindre ta cible » avec zéro ligne pointée). « Confirmé » reste un terme **interne** (calcul) — ne pas exposer un synonyme flottant à l'utilisateur.

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

| Statut      | Sens     | Effet sur les Prévisions liées                                           |
| ----------- | -------- | ------------------------------------------------------------------------ |
| `ACTIVE`    | en cours | aucun                                                                    |
| `COMPLETED` | atteint  | **arrêt de génération** (PUL-285 CA5) — réversible via CTA « ré-ouvrir » |
| `PAUSED`    | en pause | **arrêt de génération** (PUL-285 CA5) — `paceStatus = null`              |

**Arrêt de génération (PUL-285 CA5)** : quand l'objectif n'est pas `ACTIVE`, `create_budget_from_template` ne copie plus ses `template_line` liées — les nouveaux budgets naissent **sans** la prévision liée (les autres lignes du Mois Type sont intactes). Le retour à `ACTIVE` reprend la génération pour les budgets suivants ; les mois générés pendant l'arrêt ne sont **pas** rétro-remplis (gaps assumés, cf. §10.2). Les Prévisions liées **déjà générées** ne sont jamais modifiées ni supprimées par une transition de statut — leur gestion est advisory : `GET /v1/savings-goals/:id/future-lines` liste les candidates (liées, non pointées, non ajustées à la main, cycle courant payDay-aware et au-delà), puis `POST /v1/savings-goals/:id/generation-stop` applique la décision explicite — `freeze` = garder la prévision, la délier et la marquer `is_manually_adjusted` (bouclier RG-001) ; `remove` = la supprimer (ses transactions deviennent libres). Gardes CA9 atomiques : jamais de mois passé, de ligne pointée ou déjà ajustée. Les transitions utilisent `PATCH` avec `ACTIVE`, `COMPLETED` ou `PAUSED`.

**Échéance dépassée** : l'objectif **reste `ACTIVE`** (pas de 4ᵉ statut). Affichage factuel + CTA « repousser la date ». **Jamais rouge ni ambre** (cf. §7). `required = null` quand `monthsRemaining ≤ 0`.

**Arrêt de génération par échéance (PUL-311)** : l'objectif restant `ACTIVE`, le prédicat de statut ne suffit pas à stopper la génération — `create_budget_from_template` saute **aussi** les `template_line` liées à un objectif dont la période d'échéance précède celle du budget matérialisé. La borne est décidée par l'appelant (TypeScript, payDay-aware via `getBudgetPeriodForDate`) et transmise à la RPC sous forme d'ids à exclure : `payDayOfMonth` vit dans `auth.users.user_metadata`, illisible depuis une fonction SQL SECURITY INVOKER, et réimplémenter la règle quinzaine en PL/pgSQL dupliquerait une formule canonique de `shared/`. Comme pour l'arrêt par statut, les Prévisions **déjà générées** ne sont jamais supprimées rétroactivement.

**Raccourcissement d'échéance (PUL-313)** : le client confirme la liste complète
des Prévisions désormais hors horizon, sans plafond arbitraire sur leur nombre ;
la RPC verrouille l'objectif, reconstitue cette liste puis applique atomiquement
`freeze` ou `remove` avec la nouvelle date. Le trigger de cohérence verrouille le
même objectif lors de tout nouveau rattachement et refuse une période strictement
postérieure à sa borne payDay-aware : une création concurrente ne peut donc ni
échapper à la réconciliation, ni laisser un lien hors horizon.

> Depuis PUL-316, la création d'un objectif ne pose plus de `template_line` (§3.5), donc ce garde-fou ne protège plus que deux cas : les objectifs créés **avant** PUL-316, dont la ligne de Mois Type subsiste, et les rattachements **manuels** faits depuis le Mois Type. Il reste donc nécessaire.

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
| **Suppression d'objectif**           | Un aperçu exhaustif précède le choix : objectif seul, objectif + Prévisions, ou objectif + Prévisions + Réels rattachés. Voir le contrat ci-dessous.            |
| **Déchiffrement de `target_amount`** | La liste, le détail et `/progress` déchiffrent la cible avant de l'exposer.                                                                                     |
| **`target_amount = NULL`**           | Cible absente : reste `null` en lecture et après rekey, sans conversion en zéro ni chiffrement factice.                                                         |
| **`target_amount` lu = 0**           | Toléré pour les anciennes données. Garde `achievementPercent = 0`. Ne jamais diviser par la cible sans déchiffrement.                                           |
| **iOS `BudgetLineUpdate`**           | Le DTO Swift porte `savingsGoalId` afin de permettre le rattachement en édition.                                                                                |
| **Changement de `kind`**             | `kind ≠ saving` ⇒ `savingsGoalId = null` ; la progression re-filtre toujours `kind=saving`.                                                                     |
| **`target_date` à la création**      | Le schéma impose `z.iso.date()` et une date au moins égale à aujourd'hui.                                                                                       |
| **Horizon maximal**                  | Création et modification refusent une échéance après la 120e période, mois courant inclus. La timeline et le payload d'application sont bornés au même horizon. |
| **Pointage anticipé (mois futur)**   | Le pointage est accepté ; le confirmé peut dépasser le prévu cumulé.                                                                                            |
| **Multi-objectif**                   | 1 Prévision = 1 objectif (FK simple) ; splitter = Prévisions distinctes.                                                                                        |
| **Régénération mensuelle**           | Le lien survit via `template_line.savings_goal_id` (génération + propagation RG-001, budgets ajustés protégés).                                                 |

Le lien vit sur `budget_line` et `template_line`, jamais sur `transaction`. Les formulaires de transaction ne proposent donc pas de rattachement à un objectif.

### 9.1 Suppression avec aperçu (PUL-319)

`GET /v1/savings-goals/:id/deletion-impact` retourne les Prévisions du Mois Type, les Prévisions de chaque budget lié et leurs Réels alloués, avec compteurs, totaux et une révision `id + updatedAt`. Aucun plafond de présentation n'est appliqué.

`POST /v1/savings-goals/:id/deletion` exige cette révision et l'un des trois modes :

1. `goal_only` supprime l'objectif ; les FK délient les Prévisions, les Réels restent alloués.
2. `goal_and_forecasts` supprime les `template_line` et `budget_line` liées ; les Réels restent et deviennent libres via `transaction.budget_line_id ON DELETE SET NULL`.
3. `goal_forecasts_and_transactions` supprime les Réels alloués, les Prévisions puis l'objectif.

La RPC verrouille l'objectif, les Prévisions et les Réels avant de comparer la révision. Toute différence produit un conflit sans mutation. Les suppressions et déliaisons sont atomiques. Le recalcul des budgets reste post-commit car il déchiffre les montants dans NestJS : son échec retourne `ERR_SAVINGS_GOAL_DELETION_RECALCULATION_FAILED` avec `partialFailure`, sans retry de la suppression déjà commise.

L'ancien `DELETE /v1/savings-goals/:id` reste compatible et conserve la sémantique `goal_only`.

---

## 10. Simulateur de plan

Le simulateur répond à « qu'est-ce que je fais maintenant ? » sans modifier le Mois Type. Toute simulation reste locale jusqu'à une confirmation explicite.

### 10.1 Surfaces et sémantique

- **Ta trajectoire** : trois séries de solde, Épargné, Projection planifiée et Cible. Le flux `plannedCumulative` reste disponible séparément ; la simulation remplace la projection future par le brouillon.
- **Ton plan, mois par mois** : timeline verticale de l'ancrage à l'échéance. Les mois passés et les Prévisions pointées sont verrouillés.
- **Ajuster mon plan** : sandbox client, montant global et ajustements mensuels. « Réajuster la suite » redistribue le reste sur les mois ouverts.
- **Appliquer** : récapitulatif obligatoire puis écriture pessimiste. Annuler ou quitter ne persiste rien.
- Les contributions réelles restent consultables séparément dans « Ton suivi ».
- Les couleurs suivent RG-002 : vert épargne et neutres, jamais ambre ou rouge.

### 10.2 Contrat de lecture

`GET /v1/savings-goals/:id/progress` reste l'unique lecture. En plus des métriques de progression, il expose :

- `cumulativeGap = plannedCumulative - (linesConfirmed - retraits déjà survenus)`, signé et jamais borné (flux : le montant de départ en est exclu, cf. §4.3 ; l'argent repris creuse le retard, cf. §11) ;
- `plannedProjection = initialAmount + Σ Prévisions liées` dans l'intervalle ;
- `estimatedCompletion`, période d'atteinte estimée au rythme pointé, ou `null` si elle n'est pas calculable ;
- `initialAmount`, le montant de départ déchiffré (0 si absent) — écho pour l'affichage et le seed des simulations client ;
- `months[]`, une ligne par période avec état temporel, montants prévu/pointé/cumulés, lignes liées, présence du budget (`hasBudget`) et capacité de provisioning. Le cumul confirmé est **seedé** à `initialAmount` dès la première ligne rendue, même si elle précède `startDate` ; au cycle courant, il est égal à `confirmed`.

La timeline est payDay-aware. Une timeline datée reste bornée à 120 périodes ;
une timeline ouverte n'est pas plafonnée et finit au dernier mois lié ou au
cycle courant. Les lignes antérieures à l'ancrage explicite restent visibles
mais n'alimentent ni cumul, ni contribution, ni redistribution. Une échéance
posée à l'horizon maximal sature cette borne et fait démarrer la fenêtre au
cycle courant : les retraits antérieurs n'ont alors plus de ligne à eux et sont
reportés sur la **première** ligne rendue, qui totalise ainsi ce qui a quitté le
stock jusqu'à elle. C'est le pendant du seed `initialAmount`, et c'est ce qui
tient l'égalité avec `confirmed` — le simulateur et la redistribution ne
connaissent du stock que ce que portent les lignes, donc un retrait qu'elles
oublieraient gonflerait la simulation et minorerait l'effort restant d'autant. Un budget absent
est ajustable dès lors qu'un **Mois Type par défaut** existe — il sert à
matérialiser le budget du mois, plus à recopier une ligne (PUL-316). Un budget
existant sans ligne liée est ajustable sans dépendre du Mois Type : la
Prévision liée manquante peut être créée directement dans ce budget.

### 10.3 Simulation locale

Les calculateurs shared, avec miroir testé sur iOS, portent quatre opérations pures :

1. construire la timeline de l'ancrage à l'échéance ;
2. appliquer un brouillon global ou mensuel uniquement aux mois ouverts ;
3. redistribuer le montant restant au centime près en respectant les mois épinglés ;
4. répartir le montant d'un mois entre ses lignes ouvertes, proportionnellement puis par plus grand reste.

La simulation (2) et la redistribution (3) reçoivent `initialAmount` en **seed** : le cumul simulé démarre au montant de départ et le restant à redistribuer le soustrait (`max(0, cible − initialAmount − pointé verrouillé + tous les retraits − épinglé)`, le retrait entrant en plus puisque l'argent repris est de l'effort à refaire ; il est sommé sans condition, exactement comme la simulation le soustrait — c'est cette égalité qui fait retomber la simulation sur la cible). Le seed vit dans le calculateur (qui re-cumule from scratch), jamais en plus des cumuls serveur déjà seedés — pas de double comptage.

Le serveur reste autoritaire à l'écriture. Les clients ne recalculent jamais le contrat de progression serveur.

### 10.4 Contrat d'application

`POST /v1/savings-goals/:id/plan` accepte trois collections strictes :

- `monthAdjustments[]` : `{ budgetLineId, amount }` pour les Prévisions matérialisées ;
- `missingMonthAdjustments[]` : `{ month, year, amount }` pour les périodes sans Prévision liée mais provisionnables, que le budget soit absent ou déjà matérialisé. Le montant est strictement positif : ramener une Prévision existante à zéro passe uniquement par `monthAdjustments`.
- `planWithdrawalAdjustments[]` : `{ month, year, amount, destination? }`, où `amount` est négatif (retrait) ou zéro (suppression) et `destination` vaut `goal_only` ou `linked_income`. Son absence conserve le comportement historique `goal_only`.

Un mouvement mensuel positif modifie seulement la Prévision Épargne et efface
le retrait piloté par le plan sur cette période. Un mouvement négatif ne modifie
jamais une ligne Épargne : `goal_only` l'écrit dans
`savings_goal_plan_withdrawal`, tandis que `linked_income` crée une Prévision
Revenu ponctuelle marquée `is_savings_goal_plan_adjustment`. Les deux formes
sont exclusives par période et la transition est atomique. Une contribution
positive existante peut donc coexister avec le retrait, sans écrasement ni
double comptage. La destination budget exige que le budget du mois existe.

Pour une récupération, les clients arrondissent `required` au **centime supérieur** puis réutilisent exactement ce montant positif dans la preview, sa projection et chaque `missingMonthAdjustment`. Un `required` nul ne propose aucune récupération.

Le flux valide toutes les préconditions avant mutation. Il provisionne d'abord
les budgets absents ou réutilise les budgets existants. Un nouvel essai
séquentiel relit l'état et réutilise ce qui a déjà été provisionné. L'application des
montants passe ensuite par une RPC atomique sérialisée par objectif. La RPC
refuse toute ligne étrangère, non liée, non-Épargne, passée ou pointée. Les
ajustements appliqués deviennent manuels et sortent de RG-001 ; le Mois Type
n'est jamais modifié.

Depuis PUL-316, un mois manquant reçoit sa Prévision liée **directement**, par le même lissage que la création (§3.5) : le budget est matérialisé s'il manque, sinon il est réutilisé, puis la ligne y est insérée — exactement le geste d'un ajout manuel dans le budget du mois. Exiger au préalable une ligne du Mois Type à recopier rendrait le comblement impossible pour un objectif daté, qui n'en pose plus.

Les montants sont chiffrés via `ENCRYPTION_PORT`. Une application dans la devise du compte remet les métadonnées FX source de la Prévision à `null`. Après succès ou provisioning partiel suivi d'un échec, les caches objectifs et budgets sont invalidés avant relecture.

### 10.5 Conflits et reprise

- ligne invalide ou mois non provisionnable : erreur 422 ;
- ligne pointée ou période devenue passée pendant la simulation : conflit 409, puis relecture et nouvelle simulation ;
- autre échec d'application : erreur serveur et retry sûr sur les budgets déjà provisionnés.

Le client n'envoie pas de clé d'idempotence. La reprise est sûre pour des
demandes séquentielles : le provisioning réutilise les budgets existants et
l'écriture finale met une valeur à jour sous verrou.

Les transitions de retrait (`goal_only ↔ linked_income`, montant modifié,
suppression à zéro) sont sérialisées par objectif et idempotentes par valeur.
L'ancienne RPC reste disponible ; la RPC additive à destinations supprime les
deux représentations puis n'en recrée qu'une dans la même transaction.

Le provisioning n'est pas sérialisé entre deux demandes indépendantes. Deux
appareils ou onglets qui confirment au même instant sortent donc de cette
garantie.

---

## 11. Retraits — sortir de l'argent d'un objectif (PUL-329)

### 11.1 Vocabulaire

| Terme                | Définition                                                                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Contribution**     | Entrée d'argent : Prévision Épargne liée, pointée ou non (§3). Elle nourrit `plannedCumulative`, `linesConfirmed` et `confirmedPace`.                    |
| **Retrait**          | Sortie d'argent : Revenu d'un budget dont l'origine est cet objectif. Il diminue le stock, jamais le rythme.                                             |
| **Retrait annoncé**  | Prévision Revenu ponctuelle dont l'origine est cet objectif : « ce montant sortira ». Elle n'a encore rien sorti et ne sortira peut-être jamais (§11.6). |
| **Solde disponible** | `confirmed` (§4.2). C'est la seule limite d'un retrait — le prévu et la cible n'entrent pas dans ce contrôle.                                            |
| **Lien actif**       | `source_savings_goal_id` + `source_savings_goal_name` renseignés : la transaction ouvre son objectif.                                                    |
| **Lien cassé**       | Identifiant `null`, nom conservé : l'objectif a été supprimé. La provenance reste lisible, la navigation disparaît.                                      |

### 11.2 Ce qu'un retrait ne fait pas

- Il **ne réécrit pas le plan** : montants, mois et calendrier des Prévisions futures sont inchangés. L'utilisateur ajuste son plan séparément (§10).
- Il **ne change pas le statut** : un objectif `COMPLETED` repassé sous sa cible le reste. Le statut décrit une décision de l'utilisateur (§6), pas un seuil franchi.
- Il **n'est pas une contribution négative** : il n'apparaît jamais dans `confirmedAmount` d'un mois de la timeline. Il porte son propre champ `withdrawnAmount`, et c'est par lui que les cumuls — confirmé comme simulé — sont creusés.
- Il **ne programme aucun remboursement**. Le mécanisme Revenu M + Épargne M+1 est un autre parcours, « Couvrir ce mois avec mon épargne » (PUL-292) : une avance à remettre, pas un retrait définitif.

### 11.3 Éligibilité et devise

Un objectif est proposé au retrait dès que `confirmed > 0`, quel que soit son statut (`ACTIVE`, `PAUSED`, `COMPLETED`).

Le montant retiré est le montant **cible normalisé dans la devise du compte**, après conversion éventuelle (RG-009) — jamais `originalAmount`. Comparer une saisie en EUR au solde d'un objectif en CHF rendrait le contrôle de solde incohérent.

### 11.4 Effet immédiat, indépendant du pointage

Le stock baisse **dès la création** du revenu lié. Pointer ou dépointer ce revenu ne change rien au solde de l'objectif : le pointage décrit le rapprochement bancaire du budget, pas la sortie du pot.

### 11.5 Cycle de vie

| Événement                     | Effet                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Édition du montant            | Le retrait suit : `4'500 → 3'500` restitue `1'000`. La limite d'édition est `confirmed + ancienMontant`.                     |
| Édition nom / date / tags     | Autorisée. Le lien, lui, est immuable : aucune API ne le retire, ne le remplace ni ne change le type de la transaction.      |
| Report vers une autre période | Conserve lien, montant et nom ; seule la chronologie change.                                                                 |
| Suppression du revenu         | Annule le retrait : le solde remonte du montant exact.                                                                       |
| Renommage de l'objectif       | Le nom snapshot suit tant que le lien est actif.                                                                             |
| Suppression de l'objectif     | Les revenus liés sont **toujours conservés**, dans tous les modes (§9.1). Identifiant `null`, dernier nom figé : lien cassé. |

Changer l'objectif source d'un revenu existant n'est pas prévu : il faut supprimer puis recréer.

### 11.6 Retrait annoncé : le cycle prévu → réel

Un retrait peut être **annoncé** avant d'être fait, comme une dépense est prévue avant d'être payée : une Prévision Revenu ponctuelle porte `source_savings_goal_id`. Elle dit « en mai, 500 sortiront de ce pot ». Tant qu'elle n'est pas réalisée, rien n'a quitté le stock.

Elle se réalise comme n'importe quelle prévision : en créant le Réel qui lui est **alloué**. Ce Réel est un retrait ordinaire (§11.4) et porte le même objectif source. Pointer la prévision ne réalise rien et l'API le refuse — cocher une case ne fait pas sortir d'argent.

Un retrait saisi depuis le plan avec la destination « objectif uniquement » est
également annoncé, mais hors budget : il apparaît dans « Retraits planifiés »
avec l'origine « Hors budget », sans lien ni action de réalisation. Choisir
« Créer aussi un revenu » le remplace atomiquement par la Prévision Revenu liée.

#### Deux stocks, deux questions

| Stock       | Question                                    | Ce qu'il retranche                                                 |
| ----------- | ------------------------------------------- | ------------------------------------------------------------------ |
| `confirmed` | « Combien y a-t-il dans le pot **là** ? »   | Les retraits **réels** seulement, libres ou alloués.               |
| `projected` | « Combien restera-t-il si tout se passe ? » | Les mêmes, **plus** la part encore à sortir des retraits annoncés. |

Le solde disponible d'un nouveau retrait reste `confirmed` (§11.1) : une annonce ne réserve rien.

#### La part restante

```text
réel alloué      = Σ retraits dont budgetLineId = prévision.id
retrait restant  = max(0, prévision.montant − réel alloué)
```

Sur une prévision de 500 :

| Réel alloué | Retranché à `confirmed` | Retranché en plus à `projected` | Lecture                                      |
| ----------: | ----------------------: | ------------------------------: | -------------------------------------------- |
|           0 |                       0 |                             500 | Rien n'est sorti, tout reste annoncé.        |
|         300 |                     300 |                             200 | Sortie partielle ; total compté : 500.       |
|         700 |                     700 |                               0 | Réel supérieur : jamais de reliquat négatif. |

Dans les trois cas la sortie effective est comptée **une fois**, jamais deux. C'est cette somme — `withdrawnAmount + remainingPlannedWithdrawalAmount` — que le cumul simulé retranche et que la redistribution rajoute à l'effort restant, ce qui la fait retomber sur la cible au centime près.

#### Ce qui ne se projette pas

Une annonce ne pèse **que** sur les périodes courante et futures, jusqu'à l'échéance de l'objectif. Une prévision d'un mois passé est **échue** : le mois est clos, elle ne se réalisera pas rétroactivement — exactement comme une contribution passée non pointée. Une prévision au-delà de l'échéance sort de la fenêtre jugée. Dans les deux cas le montant annoncé reste lisible, son reliquat vaut zéro.

Symétriquement, au bord des 120 périodes du plan : seuls les retraits **réels** antérieurs à la fenêtre sont reportés sur la première ligne (§10.2) — l'argent est parti, le fait subsiste. Une annonce antérieure, elle, est échue et disparaît.

---

## Références

- Workflows modélisés : `docs/diagrams/savings-goals.c4`.
- Formules : `shared/src/calculators/budget-formulas.ts`, `shared/src/calculators/budget-period.ts`, `shared/src/calculators/savings-goal-progress.ts` et `shared/src/calculators/savings-goal-plan.ts`.
- Chiffrement : `docs/ENCRYPTION.md`. Couleurs : `DESIGN.md`. Sync template↔budget : `docs/BUSINESS_RULES.md` § Propagation du Mois Type.
