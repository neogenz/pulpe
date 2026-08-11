---
status: done
track: A
---

# Instruction: Une seule transition à l'ouverture d'un retrait — web

La double transition n'est pas un défaut d'animation, c'est le mécanisme lui-même. La ligne de
retrait demande un budget **et** transporte l'identifiant d'une transaction ; l'écran du budget
attend ensuite que ses données contiennent cette transaction pour ouvrir un éditeur. Deux
transitions séparées par une attente réseau.

Le paramètre n'a qu'un producteur et qu'un consommateur, vérifiés dans le dépôt :

| Rôle | Emplacement |
| --- | --- |
| Producteur | `goal-withdrawals-list.ts:77` — `[queryParams]="{ transactionId: w.transactionId }"` |
| Consommateur | `budget-details-page.ts` — input `transactionId`, `effect` associé, `#consumedTransactionId`, `#openDeepLinkedTransaction` |

Le correctif est donc une suppression, pas un écran de plus.

## Architecture ciblée

```text
frontend/projects/webapp/src/app/feature/savings-goals/detail/
└── components/goal-withdrawals-list.ts              ✏️ lien vers le budget seul
frontend/projects/webapp/src/app/feature/budget/budget-details/
├── budget-details-page.ts                           ✂️ input + effect + ouverture profonde
└── budget-details-page.spec.ts                      ✂️ tests du workaround
```

## Tasks to do

### `1)` Reproduire avant de supprimer

1. Depuis le détail d'un objectif, cliquer un retrait mène à `/budget/:id?transactionId=…` puis
   ouvre le dialogue d'édition. Le test constate l'URL portant le paramètre **et** l'ouverture
   automatique.
2. Le test doit échouer sur le comportement actuel avant toute correction.

### `2)` La ligne navigue vers son budget, rien d'autre

1. Retirer `[queryParams]` de l'ancre. Le `routerLink` vers `/budget/:budgetId`, le chevron et
   la structure de la ligne restent inchangés.
2. Reformuler `savingsGoals.detail.withdrawalOpenAria` : elle annonce l'ouverture du budget, ce
   qui se produira réellement, et non celle de la transaction.
3. Ne pas toucher au rendu du mouvement. Le retrait reste **neutre** : icône `call_made`,
   couleur de texte courante, montant signé négatif. `docs/SAVINGS.md` §7 et §10.1 imposent
   « vert épargne et neutres, jamais ambre ou rouge », et l'ambre de `DESIGN.md` signifie
   dépense ou dépassement — un retrait n'est ni l'un ni l'autre.

### `3)` Supprimer le workaround côté budget

1. Recherche globale de `transactionId` en paramètre de route pour confirmer qu'aucun autre
   appelant ne subsiste après l'étape 2.
2. Supprimer l'input `transactionId`, son `effect`, `#consumedTransactionId`,
   `#openDeepLinkedTransaction` et le nettoyage `queryParams: { transactionId: null }`.
3. Retirer les tests qui ne couvrent que ce chemin ; conserver ceux du dialogue d'édition
   atteint par les autres appelants.

### `4)` Ne rien ajouter d'autre dans cette phase

1. Aucun composant de détail local, aucun champ de contrat, aucune modification du repository
   savings-goal.
2. Les sections « Contributions » et « Retraits » restent séparées : la fusion est hors
   périmètre et documentée comme telle dans `plan.md`.
3. Si la relecture QA juge qu'atterrir sur le budget perd trop de contexte, cela devient une
   décision produit consignée, pas un ajout glissé ici.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le test échoue avant correctif : URL avec `transactionId` et éditeur ouvert sans geste utilisateur. |
| 2 | Le clic mène au budget, l'URL ne porte plus `transactionId`, aucun dialogue ne s'ouvre seul, l'annonce accessible correspond au comportement. |
| 3 | Plus aucune occurrence de `transactionId` comme paramètre de route dans le dépôt. |
| 4 | Le diff de la phase est net négatif et ne touche ni `shared/schemas.ts` ni le backend. |
