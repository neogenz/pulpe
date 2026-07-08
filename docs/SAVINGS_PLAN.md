# Simulateur de plan d'épargne — Blueprint métier + conception technique

> **Statut** : source de vérité (décisions tranchées) pour l'approfondissement de la feature Objectifs d'épargne.
> **Parent** : `docs/SAVINGS.md` (modèle, accumulation, progression — immuable sur le métier tranché). Ce doc **étend** la page détail objectif ; il ne réécrit rien du blueprint parent.
> **Périmètre** : projection enrichie (chart), calendrier mensuel projeté, simulation « réajuster la suite » avec apply-on-confirm, drag-to-adjust. Web + iOS.
> **Glossaire** : `budget_lines` = Prévisions · `kind=saving` = Épargne · `checked`/`checkedAt` = Pointé · `template_line` = ligne du Mois Type. Tutoiement, ton bienveillant non-anxiogène.

---

## 1. Vue d'ensemble & besoin

L'utilisateur (D5 : résident suisse, dépensier conscient, ~30 s d'attention/jour) suit un objectif long terme mais la page détail actuelle **constate** sans **aider à décider**. Le cri du `BUSINESS_WORKFLOW.md` (intention 9, douleur D5) est explicite :

> « si j'ai économisé 800.- au lieu de 2000.- en juillet, je dois recalculer manuellement l'impact sur les 41 mois restants. Zéro aide pour redistribuer l'effort sur les mois suivants. »

La feature actuelle (PUL-8) répond à « **où j'en suis** » (barre 2 couches, pace chip, projection à l'échéance). Ce chantier répond à « **qu'est-ce que je fais maintenant** » : voir la trajectoire, ouvrir le plan mois par mois, simuler un ajustement, laisser le système redistribuer l'effort, appliquer d'un geste.

C'est la matérialisation concrète de la promesse déjà inscrite en PUL-285 (« re-projection + redistribution advisory ») : elle devient un **simulateur interactif** au lieu d'un calcul serveur invisible.

### Ancrage psychologique (les leviers, pas de la déco)

| Levier | Application |
|---|---|
| **Loi de Doherty** (< 400 ms = fluidité) | Toute la simulation est calculée **côté client** (< 16 ms réel). Zéro round-trip pendant le drag. |
| **Loi de Tesler** (la complexité se déplace, ne disparaît pas) | La redistribution de l'effort et l'allocation multi-lignes sont **absorbées par le système**, jamais posées sur l'utilisateur. |
| **Contrôle** (pilier DA) | Sandbox local → récap explicite → écriture. Revert à tout moment. Rien n'est modifié sans accord. |
| **Effet IKEA** | L'utilisateur **façonne** son plan (slider, édition par mois) → il le valorise et s'y tient. |
| **Ancrage** | Le slider s'ouvre **pré-rempli** avec `required` (le montant qui tient l'échéance) — l'utilisateur ajuste depuis une référence saine. |
| **Loi de Hick** | Un seul CTA primaire par état d'écran. Le mode simulation concentre l'action ; le mode lecture concentre la compréhension. |

---

## 2. Les trois piliers

### Pilier A — « Ta trajectoire » (chart cumulé, lecture seule)

**Intention** : #9 — « Vue d'ensemble : progression, écart cumulé, projection de date d'atteinte ». **Douleur** : D5.

Le chart matérialise en 3 secondes ce que le pace chip dit en mots. Quatre séries cumulées sur l'axe temps (ancrage → cible) :

| Série | Sens | Style (RG-002 : jamais ambre/rouge) |
|---|---|---|
| **Pointé** | Réalité cumulée (`confirmedCumulative`), s'arrête au mois courant | Vert épargne plein + aire de remplissage légère |
| **Prévu cumulé** | Engagement cumulé (`plannedCumulative`), toute la durée | Vert épargne 0.35, la référence |
| **Projection** | Extrapolation au rythme pointé (`confirmedPace`), du mois courant à l'échéance | Vert épargne pointillé |
| **Cible** | `targetAmount` constant | Ligne fine neutre (jamais rouge) |

**Deux métriques nouvelles** exposées à côté du chart :

- **Écart cumulé** (`cumulativeGap = plannedCumulative − confirmed`) : signé, jamais clampé. Positif = tu as prévu plus que ce qui est pointé (retard de pointage ou de virement) ; négatif = pointage anticipé / avance. **Information neutre** — un écart positif n'est pas une alerte.
- **Date d'atteinte estimée** (`estimatedCompletion`) : « à ce rythme, tu atteins ta cible en **juin 2027** ». PayDay-aware, exprimée en `{month, year}`.

**Hors périmètre** : pas de Monte-Carlo, pas de bandes de confiance. La cible produit lit en 3 secondes ; une enveloppe probabiliste demande un apprentissage → contraire à Clarté.

**En simulation** : la série *Projection* est remplacée par la trajectoire du **plan édité** (elle suit les montants du sandbox, pas `confirmedPace`). La série *Prévu cumulé* future se recalcule aussi depuis le sandbox. Le mode lecture garde la sémantique spec'd (`confirmedPace`).

---

### Pilier B — « Ton plan, mois par mois » (timeline)

**Intention** : #9 (« l'effort est redistribué sur les mois restants »). **Remplace** la liste « Suivi » actuelle : un seul artefact au lieu de deux (réduit la charge — loi de Miller). Les contributions détaillées (transactions par ligne) restent accessibles en dépliant une row.

**Choix de forme : liste verticale** sur les deux plateformes. Rejeté :

| Option rejetée | Raison |
|---|---|
| Grille (`ui/calendar/year-calendar`) | Une tuile communique une *présence*, pas trois valeurs numériques (montant + cumulé + état). Éditer dans une tuile est hostile au pouce. |
| Rail horizontal (`BudgetMonthPagerBar`) | C'est un *scrubber de navigation* (swipe = browse, tap = commit). Cacher 20 mois hors écran = cacher de l'argent → anti-Clarté. |
| **Liste verticale** | ✅ Grammaire **déjà apprise** via le lissage (`spread-occurrences-list` web / `SpreadOccurrenceRow` iOS). Zéro nouveau langage. |

**Anatomie d'une row** (identique web/iOS) :

```
[icône état]  Mars 2026          450.00 CHF      → 5'400 CHF
```

- **Icône état** : `check_circle` vert (pointé) · `lock` neutre discret (passé non pointé) · aucune (mois ouvert). Réutilise la logique d'icône des rows de contribution actuelles.
- **Montant du mois** : ligne `'1.2-2'` (c'est un `budget_line.amount`). **Cumulé** : agrégation `'1.0-0'`, secondaire, préfixe `→`. (Politique double du `.claude/rules/03-frameworks-and-libraries/webapp-currency-formatting.md` ; iOS `asCurrency`/`asCompactCurrency`.)
- **Rows verrouillées** : `opacity-60`, non-interactives, suffixe a11y « , pointé, verrouillé ».
- **Badge « Ce mois »** sur la période courante.

**Fenêtrage** (défaut) : dernier mois verrouillé (contexte « tu en es là ») + 3 mois ouverts + « Voir tout le plan (N mois) ». Une liste de 24-96 rows explose le budget de 30 s. Auto-expand quand la simulation démarre.

**Règle de verrouillage** : cycles **strictement passés** OU toute ligne du mois **pointée** (`checkedAt != null`). Le **cycle courant reste éditable s'il n'est pas pointé** (il est contributif — `monthsRemaining` l'inclut).

**Mois particuliers** :

| `state` | Affichage | Éditable ? |
|---|---|---|
| `gap` (aucune ligne liée / budget non généré) | Row présente (le cumulé doit rester continu), chip « Pas de budget » | Non en v1. Hint sous la liste : « N mois sans budget — ils s'ajouteront quand tu créeras ces budgets. » |
| `future` avec ligne matérialisée | Row normale | Oui (par mois + slider global) |
| Horizon **Mois type** (au-delà du dernier budget généré) | Row + chip « Mois type », affiche `templateAmount` | Éditable **collectivement** seulement (slider global / réajuster) — pas de `budget_line` à PATCH individuellement |

> **⚠️ Report v1 — surfaçage horizon-template différé.** `buildSavingsGoalTimeline` ne bucketise que les `budget_line` : les mois horizon-template reviennent en `state: 'gap'` (indistinguables d'un vrai gap, sans `templateAmount`). En v1, les deux clients **dégradent** ces mois vers le chip « Pas de budget » et n'envoient **pas** de `templateAdjustments` (chip « Mois type » + toggle « Mettre à jour mon Mois Type » masqués, dialog d'apply simplifié). Le **contrat d'écriture reste forward-compatible** : la RPC `apply_savings_goal_plan` gère déjà le leg `templateAdjustments` (testé), donc surfacer l'horizon-template plus tard = additif (le builder shared doit recevoir les `template_line` liées + la borne du dernier budget généré et émettre un marqueur ; nouveau select repo côté backend). Voir §9 (suivi).

---

### Pilier C — Simulation + drag-to-adjust

**Intention** : #9 (redistribution). **Douleur** : D5. Le cœur de valeur.

**Entrée** :
- CTA « **Ajuster mon plan** » (bouton *outlined* dans le header de la section timeline). Visible seulement si `status === 'ACTIVE' && linkedLineCount > 0 && openMonths ≥ 1`. Masqué pour PAUSED/COMPLETED (pas de jugement de rythme → pas d'édition de plan, cohérent avec `paceStatus = null`).
- Le stat « **Pour tenir ton échéance — X/mois** » devient **actionnable** → ouvre la simulation pré-remplie avec `required` (ancrage).

**Contenant** :
- **Web** : mode **in-place** sur la page. Le chart et la timeline sont déjà rendus ; entrer en simulation bascule leur source de données vers le sandbox — l'utilisateur regarde la projection pointillée se déformer en direct. Les contributions se masquent ; une **sticky bar** apparaît en bas (« Annuler » texte / « Appliquer (N mois) » plein).
- **iOS** : **sheet plein écran** `GoalPlanSimulatorSheet` (`.large` detent). Le détail est déjà une destination poussée ~390 LOC ; le modèle mental natif « éditer puis confirmer/annuler » est un sheet ; le dismiss = revert gratuit.

**Contrôles** :
- **Slider global + input numérique jumeau** — « Chaque mois, je mets ». Web : `MatSlider` (1er usage), `min=0`, `max = niceCeil(2 × max(required, pace, templateAmount))`, `step` 10 unités. iOS : `Slider` natif (1er usage, VoiceOver-adjustable), tinte `pulpePrimary`, `sensoryFeedback(.selection)` aux paliers. L'input jumeau est le chemin de **précision + a11y** (le lecteur d'écran tape ; les flèches clavier donnent ±step). **Bouger le slider écrase les overrides par mois** — la toolbar l'annonce (« remplace tes ajustements mois par mois »).
- **Édition par mois** : tap sur une row ouverte → champ numérique inline. **Pas de drag-on-bar** (cibles trop petites pour le pouce — loi de Fitts) ni de steppers. Un champ numérique visible est la seule affordance qu'un non-tech parse en 3 s, et elle est nativement accessible.
- **« Réajuster la suite »** = bouton *tonal* héro de la toolbar : « Répartir ce qu'il reste — {X}/mois ». Un tap remplit tous les mois ouverts. C'est le geste « soulagement ».

**Feedback live** — sous le chart, une phrase verdict recalculée à chaque geste (< 16 ms) :
- Cible tenue à l'échéance : « Avec ce plan, tu atteins ta cible en **juin 2027**. »
- Plus tard que l'échéance : « Avec ce plan, tu atteins ta cible en **octobre 2027** » — **factuel, jamais ambre/rouge**.
- En avance : « …dès **mars 2027**, en avance. »

Cette phrase est aussi l'annonce `aria-live="polite"` (débounce ~500 ms).

**Application (apply-on-confirm)** :
1. « Appliquer (N mois) » → **récap dialog** (web `MatDialog` ; iOS medium-detent sheet) : titre « **On met ton plan à jour ?** » ; corps = « N mois ajustés » + diff condensé (cas uniforme : « 600 → 450 CHF/mois sur 6 mois » ; cas mixte : liste avant→après jusqu'à 5 rows + « et N autres ») ; **checkbox « Mettre à jour mon Mois Type pour la suite »** affichée seulement si des mois horizon-template ont été touchés (default coché — décocher limite l'écriture aux budgets matérialisés) ; ligne de clôture = le verdict de projection.
2. Confirm = loading button, écriture **pessimiste** (un seul appel atomique, cf. §5).
3. Succès → invalidation des caches épargne **et** budgets → toast « **Ton plan est à jour** » → sortie du mode.

**À surfacer à l'utilisateur** : une ligne appliquée passe `isManuallyAdjusted = true` → elle **ne suivra plus le Mois Type** (« cette prévision ne suivra plus ton Mois Type »). C'est voulu (un plan confirmé ne doit pas être silencieusement écrasé par une édition de template). Escape hatch existant : `reset-budget-line-from-template`.

**État / revert** :
- « Annuler » avec ajustements → confirm « Abandonner tes ajustements ? ». Sans → sortie immédiate.
- « Repartir du plan actuel » dans la toolbar → efface les overrides sans quitter le mode.
- **Reduced motion** : classes `motion-safe:` (web) + `animation: 0` chart ; `gentleSpring` gated `accessibilityReduceMotion` (iOS).

---

### Wording (DA, tutoiement)

| Élément | Copy |
|---|---|
| Section chart | « Ta trajectoire » |
| Section timeline | « Ton plan, mois par mois » |
| CTA entrée | « Ajuster mon plan » |
| Bouton redistribution | « Réajuster la suite » |
| Bannière simulation | « Rien n'est modifié tant que tu n'appliques pas » |
| Récap | « On met ton plan à jour ? » |
| Succès | « Ton plan est à jour » |
| Conflit (409) | « Le plan a changé — resimule » |
| Ligne détachée du template | « Cette prévision ne suivra plus ton Mois Type » |
| Retard (existant) | « Un peu en retrait — tu peux ajuster » |

---

## 3. Architecture d'information de la page enrichie

Même ordre sur les deux plateformes — « actions au-dessus, exploration en dessous » :

```
1. Header (retour / titre / modifier / supprimer)          inchangé
2. Status chip + échéance                                   inchangé
3. HERO : barre 2 couches + % atteint + cible               inchangé (réponse 3 s : « où j'en suis »)
4. Pace chip + stats (Pointé / Prévu / Requis / Projection) inchangé
5. Blocs D1 / D2 / COMPLETED                                RESTENT ICI (au-dessus des nouvelles sections)
6. NEW — « Ta trajectoire » (pilier A)                      visible par défaut, absent si linkedLineCount === 0
7. NEW — « Ton plan, mois par mois » (pilier B)             fenêtré ; header porte le CTA « Ajuster mon plan »
8. Contributions (« Ton suivi »)                            inchangé, en dernier (l'historique = moindre urgence)
```

**Justifications** :
- La page garde son job : « est-ce que je tiens le rythme, et que faire ? ». Hero + pace + D1/D2 y répondent au-dessus de la ligne de flottaison. L'ordre de lecture = urgence décroissante.
- Les blocs D1/D2 sont les **seuls CTAs qui comptent** sur un objectif en retard/atteint → jamais poussés sous un chart de 260 px.
- Chart **visible par défaut** (pas en disclosure) : c'est la valeur phare, le cacher contredit Clarté. Il est simplement **absent** quand aucune ligne n'est liée (l'empty state existant possède déjà ce cas).
- Timeline **progressivement dévoilée** (fenêtrée) : une liste de 24-96 rows brûle le budget d'attention.

---

## 4. Contrat de données

### 4.1 Arbitrages

1. **READ = extension additive de `GET /savings-goals/:id/progress`**, pas de nouveau `GET /:id/plan`. Même fetch repo (`findLinkedContributions` + `findPayDayOfMonth`), 1 round-trip, non-breaking (les read schemas restent loose), le serveur reste seul propriétaire des formules canoniques. iOS n'a plus besoin de `/contributions` pour cette page.
2. **WRITE = payload line-scoped** — non ambigu pour un mois multi-lignes ou un objectif lié depuis plusieurs template-lines.
3. **Mois multi-lignes** : l'UX édite le total mensuel ; `allocateMonthAmountToLines` répartit proportionnellement (cents-exact, plus-grand-reste ; Σ=0 → split égal) sur les lignes **non pointées**.

### 4.2 READ — champs additifs sur `savingsGoalProgressSchema`

```ts
// shared/schemas.ts (additif — classé non-breaking par api-contract-changes.md)
export const savingsGoalPlanMonthSchema = z.object({
  month: z.number().int().min(1).max(12),
  year: z.number().int(),
  state: z.enum(['past', 'current', 'future', 'gap']),
  isLocked: z.boolean(),           // période passée OU toute ligne liée du mois pointée
  plannedAmount: z.number(),       // Σ line.amount des lignes épargne liées, ce mois
  confirmedAmount: z.number(),     // enveloppe checked-only pour ce mois
  plannedCumulative: z.number(),   // Σ courant plannedAmount, ancrage → ce mois
  confirmedCumulative: z.number(),
  lines: z.array(z.object({
    budgetLineId: z.uuid(),
    amount: z.number(),
    checkedAt: z.iso.datetime({ offset: true }).nullable(),
    isManuallyAdjusted: z.boolean(),
  })),
});

// ajouté sur savingsGoalProgressSchema :
months: z.array(savingsGoalPlanMonthSchema),               // ancrage → cible inclus
cumulativeGap: z.number(),
estimatedCompletion: z.object({ month: z.number().int().min(1).max(12), year: z.number().int() }).nullable(),
```

Serveur : `buildSavingsGoalTimeline` (shared, cf. §5) appelé à côté de `computeSavingsGoalProgress` dans `get-savings-goal-progress.use-case.ts` ; le mapper étend `toProgressApi` ; le select repo gagne `is_manually_adjusted`. Coût payload : objectif 10 ans ≈ 120 entrées ≈ quelques Ko — acceptable ; si besoin, gater derrière `?include=months` plus tard (aussi additif).

### 4.3 WRITE — `POST /v1/savings-goals/:id/plan`

```ts
// shared/schemas.ts — strict
export const MAX_PLAN_ADJUSTMENTS = 120;   // horizon 10 ans, superset de MAX_SPREAD_TRANCHES=36

export const savingsGoalPlanApplySchema = z.strictObject({
  monthAdjustments: z.array(z.strictObject({
    budgetLineId: z.uuid(),
    amount: z.number().nonnegative(),      // 0 = « je saute ce mois »
  })).max(MAX_PLAN_ADJUSTMENTS).default([]),
  templateAdjustments: z.array(z.strictObject({
    templateLineId: z.uuid(),
    amount: z.number().nonnegative(),
  })).max(MAX_PLAN_ADJUSTMENTS).default([]),
})
  .refine(v => v.monthAdjustments.length + v.templateAdjustments.length > 0, { error: 'Empty plan' })
  .refine(/* ids uniques par tableau */, { error: 'Duplicate line in plan' });

export const savingsGoalPlanApplyResponseSchema = createSuccessResponse(z.object({
  updatedLines: z.array(budgetLineSchema),   // déchiffrées
  updatedTemplateLineIds: z.array(z.uuid()),
}));
```

**Pas de clé d'idempotence** : contrairement au spread (un INSERT → besoin de `spreadGroupId` + replay-heal), c'est un **UPDATE-by-value** — un retry ré-écrit les mêmes montants (nouveaux ciphertexts AES-GCM déchiffrant les mêmes nombres) et re-pose les mêmes flags → état final identique, recalc idempotent. L'advisory lock ferme la course du double-tap. Plus simple que PUL-17 par construction — à documenter dans la JSDoc du use-case.

---

## 5. Formules & simulation

### 5.1 Deux métriques de lecture (dans `computeSavingsGoalProgress`)

Ajoutées comme **formules 10-11** à `shared/src/calculators/savings-goal-progress.ts`, à `SavingsGoalProgressResult`, et au schéma réponse — additif.

**Formule 10 — `cumulativeGap`**
```
cumulativeGap = plannedCumulative − confirmed
```
Signé, **jamais clampé** (négatif = pointage anticipé/avance, edge béni §4.3 de SAVINGS.md). Aucune garde overdue/status nécessaire. UI (RG-002) : un écart positif est neutre, jamais ambre/rouge.

**Formule 11 — `estimatedCompletion`** (date d'atteinte au rythme confirmé)
```
if status === 'PAUSED' or targetAmount ≤ 0        → null      // miroir des gardes paceStatus
if confirmed ≥ targetAmount                        → période courante {month, year}
if confirmedPace ≤ 0                               → null      // aucun pointage → pas de prévision, jamais diviser
monthsNeeded = ceil((targetAmount − confirmed) / confirmedPace)
if monthsNeeded > MAX_ESTIMATED_HORIZON_MONTHS (600) → null    // pace dégénéré → éviter « an 2200 »
estimatedCompletion = periodFromIndex(indexCourant + monthsNeeded)   // {month, year}, index payDay-aware
```
Cohérence avec les 9 formules existantes :
- `confirmedPace = 0` → `null` (même doctrine « jamais diviser » que la garde `targetAmount ≤ 0`).
- **Overdue** (`isOverdue`) → **calculée quand même** (si pace > 0). D1 impose un état *factuel* ; « à ce rythme tu atterris en 2028-03 » est le compagnon exact du CTA « repousser la date ». `required` reste `null` ; ce champ est informatif, pas un jugement.
- **PAUSED** → `null`, comme `paceStatus`.
- Type wire `{month, year}` (pas une date ISO) — un cycle payDay n'a pas de jour canonique ; les clients formatent via `formatBudgetPeriod`.

### 5.2 Simulation client — `shared/src/calculators/savings-goal-plan.ts`

Nouveau fichier, sibling de `savings-goal-progress.ts` ; miroir Swift `ios/Pulpe/Domain/Formulas/SavingsPlanCalculator.swift`. Toutes pures, `now` injectable, payDay-aware via `getBudgetPeriodForDate`. Réutilisent `splitTotalPreserving` (`shared/index.ts`, miroir `SpreadSplit.swift`) et la période (`budget-period.ts`, miroir `BudgetPeriodCalculator.swift`).

```ts
// 1. Timeline — utilisée par le SERVEUR pour /progress.months[] ET par les clients pour rebaser le sandbox.
export function buildSavingsGoalTimeline(input: SavingsGoalProgressInput): SavingsPlanTimelineMonth[]
// Énumère periodIndex(ancrage)..periodIndex(cible) inclus ; bucket les lignes par (year, month)
// (les lignes portent déjà leur période budget) ; confirmed par mois = calculateRealizedSavings scopé
// aux lignes du mois ; cumulatifs courants. state past/current/future par index vs now ;
// 'gap' quand zéro ligne liée (couvre aussi « budget existe mais ligne non taguée » — non ajustable).

// 2. Simulation — < 400 ms trivialement (tableau ≤ 120 entrées, aucun I/O).
export function simulateSavingsPlan(input: {
  timeline: SavingsPlanTimelineMonth[];
  targetAmount: number;
  adjustments: SavingsPlanAdjustment[];   // sparse ; cibler un mois locked/gap → THROW (révèle un bug UI en dev)
  globalMonthlyAmount?: number;           // appliqué à chaque mois ouvert sans adjustment explicite
}): SavingsPlanSimulationResult
// Base par mois : locked (passé/pointé) → confirmedAmount (réalité) ; ouvert → adjustment ?? global ?? plannedAmount.
// Résultat : mois simulés + simulatedFinal, gapToTarget (signé, jamais clampé), isTargetMet.
// NB sémantique : la courbe de simulation projette le PLAN (montants prévus) ; le `projected` de /progress
// projette la PRÉVISION au confirmedPace. Les deux sont tracées ; ne jamais les confondre.

// 3. « Réajuster la suite » — redistribution de l'effort restant.
export function redistributeRemainingEffort(input: {
  timeline: SavingsPlanTimelineMonth[];
  targetAmount: number;
  pinnedAdjustments: SavingsPlanAdjustment[];   // mois explicitement fixés par l'utilisateur — tenus fixes
}): { adjustments: SavingsPlanAdjustment[]; remainingEffort: number; perRemainingMonth: number; isDistributable: boolean }
// remaining = max(0, targetAmount − Σ confirmedAmount(mois locked) − Σ pinned)
// shares    = remaining === 0 ? zéros : splitTotalPreserving(remaining, openMonths.length)
//             (cents-exact, reste sur les PREMIERS mois ; splitTotalPreserving throw si total ≤ 0 → garder la garde)
// isDistributable = false si 0 mois ouverts (overdue). Généralisation directe de PUL-290
// (remainingToProvision/perRemainingMonth), passée de la division flottante au split cents-exact.

// 4. Mapping montant-mois → payload lignes (mois multi-lignes).
export function allocateMonthAmountToLines(
  lines: { budgetLineId: string; amount: number; checkedAt: string | null }[],
  newMonthAmount: number,
): { budgetLineId: string; amount: number }[]
// Lignes non pointées seulement ; proportionnel aux montants actuels, cents-exact (plus-grand-reste) ;
// Σ actuelle = 0 → split égal via splitTotalPreserving.
```

**Edge cases** (chacun une spec, jumelée en Swift — précédent SpreadSplit) :

| Cas | Règle |
|---|---|
| Overdue / 0 mois ouvert | `isDistributable = false`, UI simulation désactivée (D1 : factuel, pas de jugement) |
| `targetAmount ≤ 0` | Garde, jamais de division |
| Pointage anticipé (mois futur pointé) | Verrouillé ; son `confirmedAmount` réduit `remaining` (trust-the-gesture, §4.3 SAVINGS.md) |
| Déjà au-dessus de la cible | `remaining = 0` → tous les mois ouverts proposés à 0 |
| Gap months | Exclus de la redistribution et de `monthAdjustments` ; ajustables via `templateAdjustments` seulement |
| PAUSED | Simulation autorisée (advisory), aucun jugement de rythme — signalé dans la copy |
| Rollover de cycle entre simulate et apply | Serveur renvoie 409 (`Plan line in past period`), le client rebase |

**Doctrine assumée** : la simulation client rompt la règle « les clients n'implémentent AUCUNE formule ». Mitigation identique à PUL-17 : **un** calculateur shared testé + **un** miroir Swift testé, le serveur reste autoritaire à l'écriture (il recalcule la progression après apply). À signaler dans la JSDoc du calculateur.

---

## 6. Écriture serveur — RPC & erreurs

### 6.1 Use case `ApplySavingsGoalPlanUseCase` (savings-goal/application)

1. `goal = repo.findById(id)` → 404 via RLS.
2. `payDay = repo.findPayDayOfMonth()` ; `minPeriodIndex = periodIndex(getBudgetPeriodForDate(now, payDay))` — le **cycle courant est éditable s'il est non pointé** ; tout ce qui est strictement avant est verrouillé.
3. `result = repo.applyPlan(goalId, monthAdjustments, templateAdjustments, minPeriodIndex)` — le repo possède le chiffrement + la RPC.
4. `await cacheService.invalidateForUser(user.id)` **une seule fois**, post-RPC, pré-recalc.
5. `Promise.all(touchedBudgetIds.map(id => budgetRecalculation.recalculate(id)))` via `BUDGET_RECALCULATION_PORT`, échec enrobé comme `recalculateAfterCommit` (sévérité critical, contexte partialFailure). **Pas de cascade** : le rollover est dérivé à la lecture (vérifié — `ending_balance` local par mois). Le leg template ne déclenche aucun recalc (n'affecte que des budgets non encore générés).
6. Log `{ operation: 'savingsGoal.planApply', userId, savingsGoalId, updatedLineCount, templateLineCount }`.

Wiring module : `savings-goal.module.ts` gagne `CacheService`, `BUDGET_RECALCULATION_PORT`, `createInfoLoggerProvider`.

### 6.2 RPC `apply_savings_goal_plan` (nouvelle migration)

```sql
CREATE OR REPLACE FUNCTION public.apply_savings_goal_plan(
  p_goal_id uuid,
  p_min_period_index int,              -- year*12+month du cycle payDay courant (calculé serveur ; payDay en user_metadata, inaccessible en SQL)
  p_line_updates jsonb DEFAULT '[]',   -- [{budget_line_id uuid, amount text}]  amount = ciphertext AES-256-GCM, stocké tel quel
  p_template_updates jsonb DEFAULT '[]'
) RETURNS SETOF public.budget_line
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
```
Corps (pattern-copy de `20260626120000_spread_group_idempotency_guard.sql`) :
1. `v_uid := (SELECT auth.uid())` ; NULL → `RAISE 'Not authenticated' (P0001)`.
2. `pg_advisory_xact_lock(hashtext('apply_savings_goal_plan'), hashtext(p_goal_id::text))` — sérialise les applies concurrents **par objectif**.
3. Ownership : `IF NOT EXISTS (SELECT 1 FROM public.savings_goal WHERE id = p_goal_id AND user_id = v_uid) THEN RAISE 'Savings goal access denied'` (message réutilisé → matcher repo existant).
4. **Un seul UPDATE set-based, tous les guards dans le WHERE** (safe READ COMMITTED, aucune fenêtre check-then-act) :
```sql
WITH updated AS (
  UPDATE public.budget_line bl
  SET amount = u.amount, is_manually_adjusted = true, updated_at = NOW()
  FROM jsonb_to_recordset(p_line_updates) AS u(budget_line_id uuid, amount text)
  JOIN public.monthly_budget mb ON mb.id = bl.budget_id
  WHERE bl.id = u.budget_line_id
    AND mb.user_id = v_uid                                -- tenant (SECURITY DEFINER bypasse RLS)
    AND bl.savings_goal_id = p_goal_id                    -- lié à cet objectif
    AND bl.kind = 'saving'                                -- double garde kind
    AND bl.checked_at IS NULL                             -- pointé = verrouillé
    AND (mb.year * 12 + mb.month) >= p_min_period_index   -- cycles passés verrouillés
  RETURNING bl.*
) ...
```
5. `count(updated)` vs `jsonb_array_length(p_line_updates)` — **tout écart → SELECT diagnostique pour choisir le message, puis RAISE (toute la txn rollback, rien de partiel)** :
   - ligne manquante/étrangère/non liée/non saving → `'Plan line not linked'`
   - `checked_at IS NOT NULL` → `'Plan line already checked'`
   - période passée → `'Plan line in past period'`
6. Leg template, même forme : `UPDATE public.template_line ... WHERE tl.savings_goal_id = p_goal_id AND tl.kind = 'saving' AND EXISTS (SELECT 1 FROM public.template t WHERE t.id = tl.template_id AND t.user_id = v_uid)` ; écart → `'Plan template line not linked'`. (Les changements de montant template **ne se propagent pas** automatiquement aux budgets déjà générés — la propagation reste un flow explicite séparé.)
7. `RETURN QUERY SELECT * FROM updated;` puis `REVOKE ... FROM PUBLIC, anon; GRANT ... TO authenticated, service_role`.

L'UPDATE amount-only **ne déclenche pas** `enforce_savings_goal_line_link` (trigger sur `UPDATE OF savings_goal_id, kind, budget_id` — `is_manually_adjusted` non listé) → zéro overhead trigger par row.

### 6.3 Chiffrement

Méthode repo `applyPlan` sur `SupabaseSavingsGoalRepository` : pour chaque ajustement, `encryption.prepareAmountData(amount, user.id, user.clientKey)` → ciphertext (pattern `toSpreadRpcLine`) ; construit le payload RPC ; **parse Zod strict avant `supabase.rpc`** :

```ts
// savings-goal/infrastructure/persistence/schemas/rpc-payload.schemas.ts
export const applySavingsGoalPlanLineSchema = z.object({ budget_line_id: z.uuid(), amount: z.string().min(1) }).strict();
export const applySavingsGoalPlanTemplateLineSchema = z.object({ template_line_id: z.uuid(), amount: z.string().min(1) }).strict();
// constantes de messages P0001 pincées à côté du contrat (couplage SQL↔TS greppable) :
export const PLAN_LINE_NOT_LINKED_RPC_MESSAGE = 'Plan line not linked';
export const PLAN_LINE_CHECKED_RPC_MESSAGE = 'Plan line already checked';
export const PLAN_LINE_PAST_RPC_MESSAGE = 'Plan line in past period';
export const PLAN_TEMPLATE_LINE_NOT_LINKED_RPC_MESSAGE = 'Plan template line not linked';
```
+ `.spec.ts` (payload valide / `.strict()` rejette les extras / uuid) et un test SQL épinglant les RAISE.

### 6.4 Taxonomie d'erreurs (mapping P0001 dans le repo, pattern `throwSpreadRpcError`)

| Message RPC | ERROR_DEFINITIONS | HTTP | UX client |
|---|---|---|---|
| `Savings goal access denied` | `SAVINGS_GOAL_NOT_FOUND` (existant) | 404 | retour liste |
| `Plan line not linked` | `SAVINGS_GOAL_PLAN_LINE_INVALID` (nouveau) | 422 | refetch + resimule |
| `Plan line already checked` | `SAVINGS_GOAL_PLAN_CONFLICT` (nouveau) | 409 | « Le plan a changé — resimule » |
| `Plan line in past period` | `SAVINGS_GOAL_PLAN_CONFLICT` | 409 | idem (cycle basculé pendant la simulation) |
| `Plan template line not linked` | `SAVINGS_GOAL_PLAN_LINE_INVALID` | 422 | refetch |
| autre | `SAVINGS_GOAL_PLAN_APPLY_FAILED` (nouveau) | 500 | retry (idempotent) |

### 6.5 RG-001 / rollover / cache

- **`isManuallyAdjusted = true`** : les lignes appliquées sortent de la propagation template **pour toujours** (garde RG-001 `bl.is_manually_adjusted = false` dans `apply_template_line_operations`). Voulu ; escape hatch = `reset-budget-line-from-template`. Documenté ici + surfacé dans l'UX.
- **Rollover** : recalc des budgets touchés seulement (rollover dérivé à la lecture).
- **Cache** : `invalidateForUser` exactement une fois, post-RPC, pré-recalc.

---

## 7. Découpage composants

### Shared (`shared/`)
| Fichier | Change | Taille |
|---|---|---|
| `schemas.ts` | `savingsGoalPlanMonthSchema`, champs `months[]`/`cumulativeGap`/`estimatedCompletion` sur progress, `savingsGoalPlanApplySchema` + response (strict) | S |
| `src/calculators/savings-goal-progress.ts` | formules 10-11 | S |
| `src/calculators/savings-goal-plan.ts` (nouveau) | `buildSavingsGoalTimeline`, `simulateSavingsPlan`, `redistributeRemainingEffort`, `allocateMonthAmountToLines` + spec | M |

### Web (`frontend/projects/webapp/src/app`)
| Fichier | Change | Taille |
|---|---|---|
| `core/chart/chart-theme.ts` (nouveau, **préreq**) | extraire les helpers hors de `feature/current-month/utils/chart-utils.ts` (ban import sibling feature) + fixer les 3 imports current-month | S |
| `core/savings-goal/savings-goal-api.ts` | `getPlan$` (via progress), `applyPlan$` (requestSchema) + invalidation cache budgets à l'apply | S |
| `feature/savings-goals/services/savings-goals-store.ts` | mutation `applyPlan` (invalide `['savings-goals']` + clés budget) | M |
| `feature/savings-goals/detail/services/goal-plan-simulator-store.ts` (nouveau) | sandbox `providers` du composant page : `overrides: Map<periodKey, amount>`, `draft = computed(simulateSavingsPlan)`, `enter/revert/exit/setMonth/setGlobalAmount/redistribute/apply` | M |
| `feature/savings-goals/detail/components/goal-projection-chart.ts` + `.config.ts` (nouveau) | pilier A | M+M |
| `.../goal-plan-timeline.ts` (nouveau) | pilier B (flag editable) | M |
| `.../goal-plan-simulator-toolbar.ts` (nouveau) | slider + input jumeau + « Réajuster » + revert | M |
| `.../goal-plan-apply-dialog.ts` (nouveau) | récap + checkbox template + loading confirm | M |
| `detail/savings-goal-detail-page.ts` | nouvelles sections, plumbing mode, sticky bar ; **extraire** les contributions en `components/goal-contributions-list.ts` (fichier déjà à 640 lignes → plafond 300) | L |
| `public/i18n/fr.json` | clés `savingsGoals.plan.*` + `savingsGoals.simulate.*` (tutoiement, DA) | S |

### iOS (`ios/Pulpe`)
| Fichier | Change | Taille |
|---|---|---|
| `Domain/Models/SavingsGoalProgress.swift` | décode `months[]` + 2 métriques (additif) | S |
| `Domain/Models/SavingsGoalPlan.swift` (nouveau) | `SavingsGoalPlanMonth` Decodable + apply DTO Encodable (1:1 schéma strict) | S |
| `Domain/Formulas/SavingsPlanCalculator.swift` (nouveau) | miroir du calculateur shared (`BudgetPeriodCalculator` + `SpreadSplit`) + suite Swift Testing jumelle | M |
| `Core/Network/Endpoints.swift` | `savingsGoalPlanApply(id:)` POST (le plan est dans /progress → pas de GET séparé) | S |
| `Domain/Services/SavingsGoalService.swift` | `applyPlan(id:_:)` dans le protocole + impl | S |
| `Features/SavingsGoals/Components/GoalProjectionChart.swift` (nouveau) | pilier A (Swift Charts, précédent `BalanceTrendChart`) | M |
| `.../GoalPlanTimelineSection.swift` + `GoalPlanMonthRow.swift` (nouveau) | pilier B | M+S |
| `.../GoalDerivedStateCards.swift` (nouveau) | extraire D1/D2/reopen de la detail view (rester < 500 LOC) | S |
| `Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift` (nouveau, VM co-localisé) | pilier C : sheet, Slider+TextField, réajuster, sticky apply | L |
| `.../GoalPlanApplyRecapSheet.swift` (nouveau) | récap confirm | S |
| `Features/SavingsGoals/SavingsGoalDetailView.swift` | insérer chart + timeline + CTA + wiring sheet | M |
| Wiring cross-store (`PulpeApp` / detail `.task`) | invalider `CurrentMonthStore`/`BudgetListStore`/caches budget + `SavingsGoalStore` + refetch progress après apply (PUL-270) | S |

---

## 8. Phasage & risques

Ship order : **A → (B ‖ C) → D → E → (F ‖ G)**.

| # | Incrément | Contenu | Risque |
|---|---|---|---|
| **A** | Read enrichment (shared+back) | formules 10-11 + `buildSavingsGoalTimeline` + `/progress.months[]` + `is_manually_adjusted` au select + tests intégration | Faible (additif, aucun client ne casse) |
| **B** | Web lecture | chart-theme extract, `goal-projection-chart`, `goal-plan-timeline`, IA page | Faible |
| **C** | iOS lecture | decode, `GoalProjectionChart`, `GoalPlanTimelineSection`, extract cards | Faible |
| **D** | Shared simulation + miroir Swift | 4 fonctions, specs jumelles, dark-ship (apply désactivé) | Faible (parité via fixtures jumelles) |
| **E** | Backend write | migration `apply_savings_goal_plan` + test SQL, rpc-payload schemas + spec, `repo.applyPlan`, use-case, controller+DTO, 3 ERROR_DEFINITIONS, tests intégration (tenant, checked/past all-or-nothing, recalc, retry) | **Le vrai risque** |
| **F** | Web simulateur | mode in-place, slider, réajuster, apply dialog, écriture pessimiste | Moyen |
| **G** | iOS simulateur | sheet, Slider, réajuster, récap, invalidations | Moyen |

**Risques (incrément E)** :
1. **Complexité RPC** — mitigée par pattern-copy du skeleton spread (guards, lock, REVOKE/GRANT) + design single-UPDATE-guards-in-WHERE (aucune fenêtre check-then-act). Rester bien sous les 340 lignes de `apply_template_line_operations`.
2. **RG-001** — lignes appliquées `isManuallyAdjusted = true` sortent du sync template pour toujours. Voulu, mais documenté (§6.5) + surfacé UX ; escape hatch reset-from-template.
3. **Concurrence** — l'advisory lock sérialise seulement les applies du même objectif ; un check-toggle ou une propagation template concurrents sont gérés par les WHERE-guards + RAISE d'écart → 409 propre → resimule. Testé explicitement.
4. **Idempotence** — volontairement sans clé (UPDATE-by-value) ; seul hasard : échec du recalc post-commit → retry ré-applique + re-recalc (heal, même raison que le replay-heal spread). Chemin retry testé.
5. **Drift de frontière payDay** simulate-client vs `p_min_period_index` — même fonction shared des deux côtés, divergence seulement à l'instant exact du rollover ; serveur autoritaire, 409 couvre.

---

## 9. Découpage Linear (proposé)

Team Pulpe, liées à l'epic Objectifs d'épargne. Estimations Fibonacci étendu (cap effectif 8).

| Issue | Contenu | Est. |
|---|---|---|
| **A** | Read enrichment : formules 10-11 + `buildSavingsGoalTimeline` + `/progress.months[]` + tests | 5 |
| **B** | Web « Ta trajectoire » + « Ton plan » (lecture) | 8 |
| **C** | iOS « Ta trajectoire » + « Ton plan » (lecture) | 8 |
| **D** | Shared simulation + miroir Swift (4 fonctions, specs jumelles) | 5 |
| **E** | Backend write path (RPC + endpoint + erreurs + tests intégration) | 8 |
| **F** | Web simulateur (in-place, slider, réajuster, apply dialog) | 8 |
| **G** | iOS simulateur (sheet, Slider, réajuster, récap, invalidations) | 8 |

**Rescoper PUL-285** : retirer « redistribution advisory » (absorbée ici) ; reste = arrêt effectif de la génération à COMPLETED/PAUSED + auto-décomposition.

### Suivi v1+ (différé, non bloquant)

- **Surfaçage horizon-template** (chip « Mois type » + toggle « Mettre à jour mon Mois Type » + write `templateAdjustments`) : nécessite d'étendre `buildSavingsGoalTimeline` avec les `template_line` liées + la borne du dernier budget généré, et un select repo dédié côté backend. La RPC d'écriture est déjà prête. Additif — aucune rework du chemin `monthAdjustments`. **~3** (shared + backend + un branchement UI par plateforme).
- **Drag-on-bar** (ajuster un mois en tirant la barre du chart plutôt qu'un champ) : polish v2, rejeté en v1 (cibles trop petites — Fitts). Le slider global + champ inline couvrent le besoin.

---

## Références

- Besoin : `docs/BUSINESS_WORKFLOW.md` intention 9, douleur D5.
- Blueprint parent (modèle/progression) : `docs/SAVINGS.md` (§4 formules, §7 couleur RG-002, §10 phasage).
- Formules existantes : `shared/src/calculators/savings-goal-progress.ts` (9 formules, `calculatePaceStatus`), `budget-formulas.ts` (`calculateRealizedSavings`), `budget-period.ts` (`getBudgetPeriodForDate`, `formatBudgetPeriod`).
- Split cents-exact : `splitTotalPreserving` (`shared/index.ts`), miroir `ios/Pulpe/Domain/Formulas/SpreadSplit.swift`. Précédent redistribution : PUL-290 (`spread-occurrence.view-model.ts`).
- Pattern RPC set-based + advisory lock + P0001 : `backend-nest/supabase/migrations/20260626120000_spread_group_idempotency_guard.sql`, use-case `create-budget-line-spread.use-case.ts`, mapping `supabase-budget-line.repository.ts`.
- Pattern chart : `frontend/.../feature/current-month/components/dashboard-projection-chart.config.ts`. Précédent chart iOS : `ios/Pulpe/Shared/Components/RealizedBalanceSheet.swift` (`BalanceTrendChart`).
- Contrat API : `.claude/rules/05-workflows-and-processes/api-contract-changes.md`. Chiffrement : `docs/ENCRYPTION.md`. Couleurs : `memory-bank/DA.md` §3.7.
