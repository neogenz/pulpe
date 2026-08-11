---
status: done
track: A + B
---

# Instruction: Portes de validation, deux gates distincts

La dernière release taguée est `v0.43.0`. Deux pistes, deux portes : la piste A se promeut seule,
sans attendre la fonctionnalité. Aucun verdict « prêt à release » ne repose uniquement sur des mocks.

## Architecture ciblée

```text
frontend/e2e/
├── pages/savings-goals.page.ts                         ✏️ ligne de retrait, prévision (B)
├── pages/budget-details.page.ts                        ✏️ prévision/réalisation (B)
└── tests/features/savings-goal-withdrawals.spec.ts     ✏️ parcours complet (B)
ios/PulpeTests/                                         ✏️ navigation (A), modèles et formules (B)
ios/PulpeUITests/SavingsGoalIntervalUITests.swift       ✏️ tap retrait → budget → retour (A)
```

---

## Porte A — correctifs

### `A1)` Portes automatiques

1. Tests Angular ciblés : `goal-plan-timeline.spec.ts`, `goal-plan-simulator-store.spec.ts`,
   `goal-withdrawals-list.spec.ts`, `budget-details-page.spec.ts`.
2. Tests Swift ciblés : navigation objectif → budget, et toute suite touchant `BudgetDestination`.
3. Ensuite seulement `pnpm quality` et `ng build` — seul le build typecheck les templates.
4. Suite E2E objectifs existante, sans nouveau scénario : le parcours n'a pas changé de forme,
   seulement de destination.

### `A2)` Rejouer les défauts dans le navigateur intégré

Sur la preview issue de la branche corrigée, desktop puis viewport mobile :

1. Simulateur : modifier un montant sans quitter le champ — « Appliquer » s'active immédiatement.
   Saisir `-500` — l'erreur est visible, la valeur n'est ni inversée ni ramenée à `0`, le plan reste
   inapplicable.
2. Détail d'un objectif : cliquer un retrait ouvre le budget en une transition, sans `transactionId`
   dans l'URL et sans éditeur qui s'ouvre seul.
3. Revenir en arrière : le détail de l'objectif retrouve sa position de défilement.
4. Capturer une preuve des deux états.

### `A3)` Rejouer côté iOS

1. Sur simulateur : tap sur un retrait → budget, une seule transition, retour au même écran.
2. VoiceOver : la ligne annonce l'ouverture du budget, cohérente avec ce qui se produit.

### `A4)` Prononcer la promotion de A

Promouvable si, et seulement si :

- chaque défaut possède un test qui échouait avant le correctif ;
- `pnpm quality`, `ng build`, E2E objectifs et tests iOS concernés sont verts ;
- la preview ne montre plus ni clamp silencieux ni double transition ;
- **aucune migration ni champ de contrat n'a été introduit par la piste A.**

---

## Porte B — fonctionnalité

### `B1)` Portes automatiques, dans l'ordre le plus court

1. Tests ciblés shared : schémas + `savings-goal-progress` + `savings-goal-plan`.
2. Tests backend unitaires puis intégrations savings-goal/transaction/budget-line avec Supabase local.
3. Tests Angular ciblés : create/edit budget line, picker, transaction allouée.
4. Tests Swift ciblés : modèles Codable, `SavingsPlanCalculatorWithdrawalTests`, ajout de prévision,
   picker et coordinator.
5. Ensuite seulement : `pnpm quality`, build Angular, suite E2E et build/tests iOS.

### `B2)` Automatiser le parcours métier, avec des assertions de montants

Dans `savings-goal-withdrawals.spec.ts`, réutiliser le seed et les page objects existants :

1. Objectif confirmé à 3'600 CHF ; créer une prévision source de 500 CHF.
2. Vérifier : confirmé 3'600, projeté 3'100, ligne budget « Pris sur · objectif », retrait prévu
   visible à `−500` dans le mois.
3. Réaliser 300 CHF depuis la ligne : confirmé 3'300, projeté toujours 3'100 (300 réel + 200 restant),
   une seule transaction allouée.
4. Ajouter 400 CHF : confirmé 2'900, projeté 2'900 (réel total 700 > prévu 500), jamais 2'400.
5. Supprimer un réel : le confirmé remonte et le reliquat planifié se recalcule ; supprimer la
   prévision ne supprime pas le retrait historique déjà réalisé.
6. Tenter un réel au-delà du solde : erreur conservant la saisie, aucune écriture partielle.
7. Vérifier source orpheline après suppression de l'objectif sur un scénario isolé : nom lisible,
   réalisation impossible.

### `B3)` Rejouer la fonctionnalité dans le navigateur intégré

1. Ajouter un Revenu → « Retrait d'un objectif » ; vérifier l'exclusivité avec PUL-292, l'aperçu de
   période, le texte « pas débité maintenant » et la source sur la ligne créée.
2. Cliquer « Réaliser le retrait », créer un réel partiel et revérifier les trois montants
   budget/confirmé/projeté après rafraîchissement.
3. Vérifier que le retrait réalisé apparaît dans « Retraits » et reste **neutre** : pas d'ambre, pas
   de rouge, montant signé.

### `B4)` Valider l'UX iOS comme une surface native

1. Rejouer création planifiée → réalisation partielle → lecture du suivi, sur simulateur et appareil.
2. Dynamic Type standard puis accessibilité : montants sous le texte, aucun nom tronqué, CTA ≥ 44 pt.
3. VoiceOver : type, nom, période, statut, montant ; avec montants masqués, ne pas divulguer la
   valeur. Vérifier aussi Reduce Motion.

### `B5)` Prononcer la promotion de B

Promouvable si, et seulement si :

- les scénarios 500/300/700 sont identiques en TS, Swift, API, web et iOS ;
- migration montante + types générés sont présents, sans commande DB destructive ;
- la garde `transactionCreateSchema` rouverte porte, dans le code, la justification écrite exigée par
  la phase 2 ;
- `pnpm quality`, build web, E2E ciblé/complet et tests iOS concernés sont verts ;
- aucun double décompte ni état ambigu sur la preview et sur iOS.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| A1–A3 | Les deux défauts web et le glitch iOS sont absents sur preview desktop/mobile, chacun couvert par un test qui échouait avant. |
| A4 | La piste A est promouvable sans migration, sans champ de contrat, avec un diff net négatif. |
| B1–B2 | Les portes ciblées puis globales passent ; le scénario partiel/dépassement prouve numériquement l'absence de double décompte et l'atomicité. |
| B3–B4 | Web et iOS rendent la même sémantique, et le retrait reste neutre conformément à `docs/SAVINGS.md` §7. |
| B5 | Le compte rendu final sépare clairement bloquants release et observations non bloquantes. |

---

# Verdicts

Données de référence : compte de seed, objectif `Fond d'urgence`, budget Août 2026, une
prévision annoncée de 500 CHF réalisée à hauteur de 300. L'arbitre des montants est le JSON
servi par `/savings-goals/{id}/progress`, jamais la lecture d'un nombre à l'écran.

## `A4)` Piste A — **promouvable**

| Critère | Verdict |
| --- | --- |
| Chaque défaut porte un test qui échouait avant | Tenu — phases 1, 5, 7 |
| `pnpm quality`, `ng build`, E2E objectifs, tests iOS verts | Tenu |
| Plus de clamp silencieux ni de double transition | Tenu |
| Aucune migration ni champ de contrat introduits par A | Tenu — les quatre commits A ne touchent ni `migrations/`, ni `shared/schemas.ts`, ni `database.types.ts` |
| Diff net négatif | Tenu — **−81 lignes** (347 insertions, 428 suppressions) |

Preuves de rejeu, mesurées dans le DOM :

- Frappe sans quitter le champ — `Appliquer (0 mois)` désactivé devient `Appliquer (18 mois)`
  activé alors que `document.activeElement` est toujours le champ et qu'aucun `blur` ni
  `change` n'a été émis.
- Saisie `-500` — le champ conserve `-500` (ni ramené à `0`, ni inversé), l'erreur
  « Le montant doit être positif ou nul. Un retrait se crée depuis le budget, pas ici. »
  s'affiche en `rgb(186,26,26)` avec `role="alert"`, et `Appliquer` reste désactivé.
- Ouverture d'un retrait — la ligne est un `<a href="/budget/{id}">` ; après clic,
  `location.search` est vide et aucun dialogue n'est ouvert. Idem sur iOS, où le budget Août
  2026 s'affiche d'un seul enchaînement, y compris Reduce Motion actif.

**Un critère de A2 n'est pas tenu, et il ne bloque pas la release.** Au desktop, le retour
arrière ne restitue pas la position de défilement (`main.scrollTop` 1528 → 0). En mobile
375 px le même parcours la restitue exactement (`window.scrollY` 1703 → 1703). La cause est
structurelle et antérieure à la branche : `core.ts:117-119` demande
`scrollPositionRestoration: 'enabled'`, qui restaure la **fenêtre**, alors qu'au desktop le
shell fait défiler `<main>`. `core.ts` n'apparaît pas dans `preview...HEAD`. Corriger cela
touche la coquille de l'application entière, pas les retraits.

## `B5)` Piste B — **promouvable**

| Critère | Verdict |
| --- | --- |
| Scénarios identiques en TS, Swift, API, web et iOS | Tenu |
| Migration montante + types générés, sans commande destructive | Tenu |
| Garde `transactionCreateSchema` justifiée par écrit | Tenu |
| `pnpm quality`, build web, E2E, tests iOS verts | Tenu |
| Aucun double décompte ni état ambigu | Tenu |

**L'absence de double décompte, chiffrée.** Mois 8/2026 tel que servi par l'API :
`withdrawnAmount 300`, `plannedWithdrawalAmount 500`, `remainingPlannedWithdrawalAmount 200`,
`confirmedCumulative 300`, `projectedCumulative 200`. Le stock de juillet valant 600, on lit
600 − 300 = 300 confirmé, un reliquat `max(0, 500 − 300)` = 200, et 300 + 100 − 200 = 200
projeté. Sans le rattachement de la transaction réelle à sa prévision, le reliquat resterait à
500 et le projeté tomberait à **−100** : les 300 seraient comptés deux fois. L'aperçu affiché
au moment de créer un retrait part lui aussi du projeté — « Projection du mois · 200 CHF →
50 CHF » pour 150 annoncés — donc il ne recompte pas davantage.

Le rattachement est visible dans la réponse serveur elle-même : la transaction porte
`budgetLineId: ad05911e-…`, l'identifiant exact de la prévision annoncée
(`sourceSavingsGoalId: aaaaaaaa-3333-…`, `kind: income`, `one_off`).

**Migration.** `20260805120000_add_planned_savings_goal_withdrawals.sql`, montante, 488
lignes. Ses `DROP` sont un `DROP TRIGGER IF EXISTS` de ses propres déclencheurs et le
remplacement documenté du CHECK `transaction_source_savings_goal_free_income` — une
contrainte ne pouvant pas lire la ligne référencée, la règle de forme passe dans un trigger
qui, lui, le peut. Le `DELETE` de la ligne 456 est le remplacement des tags d'une transaction,
borné à `p_transaction_id`. Aucune commande destructive n'a été exécutée. Les types générés
portent les colonnes et les deux RPC.

**Garde du contrat.** Elle n'est pas relâchée côté client : envoyer ensemble
`sourceSavingsGoalId` et `budgetLineId` reste refusé (`shared/schemas.ts:1488-1495`). Le
commentaire qui la précède (lignes 1461-1476) porte la justification demandée par la phase 2 —
la prévision de retrait ne contredit pas la garde, elle en sort par le haut, et le serveur
hérite la source de la prévision référencée au lieu de la recevoir. C'est la garde SQL, et
elle seule, qui s'est déplacée ; la migration explique pourquoi.

**Sémantique commune.** Web et iOS disent la même chose des mêmes données : 200 restant à
réaliser, 300 fait, 60 %, source « Fond d'urgence », retrait neutre et signé. L'exclusivité
avec PUL-292 est structurelle — les trois origines sont les options d'un même select.

## Observations non bloquantes

1. **Défilement non restitué au retour, au desktop uniquement.** Structurel, antérieur à la
   branche, corrigé au niveau du shell (voir `A4` ci-dessus).
2. **Deux surfaces iOS antérieures cassent aux tailles d'accessibilité.** La carte de la
   liste des objectifs se replie en colonnes d'une lettre et son titre se tronque
   (« Objectifs d'é… ») ; les lignes de contributions tronquent le nom
   (`GoalContributionsSection.swift:47,92` posent `.lineLimit(2)`). Ni `SavingsGoalsListView`
   ni `GoalContributionsSection` n'apparaissent dans `preview...HEAD`. Les surfaces que la
   branche possède tiennent : la ligne de retrait n'a aucune limite de ligne et
   `BudgetLineMixedRow` bascule sur `lineLimit(nil)` en taille d'accessibilité.
3. **« 300 CHF dépensé » sur une ligne de revenu, côté web.** Les clés `budgetLine.spent` /
   `budgetLine.available` sont génériques et réutilisées telles quelles pour un retrait. iOS
   dit « 200.00 CHF à recevoir », ce qui est juste. Les montants concordent, seul le verbe
   diverge.
4. **Nom tronqué dans « Retraits » au web en 375 px** (`scrollWidth 132` pour
   `clientWidth 121`). iOS ne tronque pas.
5. **Le champ jumeau n'est pas marqué invalide.** Le message porte `role="alert"` et est donc
   annoncé quand il apparaît, mais le champ garde `aria-invalid="false"` sans
   `aria-describedby` : un lecteur d'écran revenant sur le champ ne réentend pas la raison.
6. **Tonalité du texte d'aide.** Web : « Le solde baisse quand le revenu réel est créé. » ;
   iOS : « … quand tu crées le revenu réel. » La voix du produit est la seconde.
7. **`ng build` dépasse le budget de bundle initial** (1,33 Mo pour 1,25 Mo). Antérieur à la
   branche.

## Couverture non atteinte

- `B4.1` demande le rejeu « sur simulateur **et appareil** ». Seul le simulateur a été mené ;
  aucun appareil physique n'est pilotable depuis cet environnement.
- `B4.3` : les libellés VoiceOver ont été vérifiés à la source, pas en pilotant VoiceOver.
  La ligne de retrait combine ses enfants et annonce « Ouvre le budget de ce revenu » ; la
  ligne de budget compose type, nom, montant et statut. Les montants masqués sont retirés de
  l'arbre d'accessibilité par `.accessibilityHidden(amountsHidden)`, donc VoiceOver ne peut
  pas en divulguer la valeur. La période n'est pas dans le libellé de la ligne de budget :
  elle est portée par l'écran du mois.
