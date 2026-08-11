---
status: done
---

# Instruction: Ce que l'écran raconte redevient vrai

Trois écrans affirment quelque chose de faux, chacun pour une raison différente.

1. Le formulaire d'ajout rapide pré-remplit le nom avec « Dépense ». Un revenu enregistré sans
   toucher ce champ s'appelle donc « Dépense ». Le champ a déjà un placeholder qui porte la même
   indication : la valeur par défaut fait double emploi avec lui.
2. Le dialogue de suppression d'un objectif imprime « Aucune prévision ni transaction n'est rattachée
   à cet objectif. » juste au-dessus du bloc « Retraits vers tes budgets » qui en liste deux. La
   condition d'état vide ne regarde que les prévisions et les budgets, jamais les retraits.
3. Sur la fiche objectif, la cible s'affiche avec deux décimales quand les six autres montants de la
   même grille n'en ont aucune ; et les totaux du dialogue de suppression sont des sommes affichées
   avec les décimales d'une ligne individuelle.

## Architecture projection

```txt
frontend/projects/webapp/
├── public/i18n/fr.json                                                        ✏️ clé de nom par défaut retirée
└── src/app/feature/
    ├── current-month/components/
    │   ├── add-transaction-form.ts                                            ✏️ nom par défaut vide
    │   └── add-transaction-form.spec.ts                                       ✏️ régression
    └── savings-goals/
        ├── detail/
        │   ├── savings-goal-detail-page.ts                                    ✏️ cible en '1.0-0'
        │   ├── savings-goal-detail-page.spec.ts                               ✏️ régression format
        │   └── components/goal-deletion-dialog/
        │       └── goal-deletion-dialog.html                                  ✏️ état vide + totaux
        └── detail/components/goal-deletion-dialog.spec.ts                     ✏️ régression copie
```

## Tasks to do

### `1)` Un revenu ne s'appelle plus « Dépense »

> Le placeholder dit déjà ce qu'il faut ; la valeur par défaut ne fait que mentir.

1. Dans `add-transaction-form.ts`, initialiser le nom à la chaîne vide. Les validateurs de champ
   requis bloquent déjà la soumission d'un nom vide.
2. Retirer l'injection de traduction devenue inutile et la clé i18n correspondante dans `fr.json`.
3. Vérifier qu'aucun autre écran ne consomme cette clé avant de la supprimer.

### `2)` L'état vide tient compte des retraits

> Un retrait est une transaction rattachée ; la phrase ne peut pas dire le contraire.

1. Dans `goal-deletion-dialog.html`, étendre la condition de la phrase d'état vide pour qu'elle exige
   aussi l'absence de retraits.
2. Ne pas réécrire la phrase : la reformuler la laisserait affirmer « aucune transaction » au-dessus
   de deux transactions listées.

### `3)` Les décimales suivent la règle

> Un agrégat se scanne, une ligne se réconcilie ; le projet a déjà tranché.

1. Sur la fiche objectif, passer la cible en `'1.0-0'` — c'est le seul montant de la grille qui ne
   l'était pas.
2. Dans le dialogue de suppression, passer les totaux à `'1.0-0'` : ce sont des sommes, pas des
   lignes. Laisser les montants de retrait ligne à ligne tels quels s'ils portent une transaction
   unique.
3. Vérifier l'écran liste : il rend déjà la cible sans décimales, ne rien y changer.

### `4)` Verrouiller par des tests

> Les specs existants ne vérifient que la présence, jamais le format : c'est ce qui a laissé passer.

1. Un test sur le nom par défaut vide à l'ouverture du formulaire.
2. Un test asserant que la phrase d'état vide disparaît quand seuls des retraits sont rattachés.
3. Un test de format sur la cible et le montant de départ, sans décimales, en reprenant le style
   d'assertion déjà présent dans le spec pour le séparateur de milliers.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                    |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | À l'ouverture du formulaire d'ajout rapide, le champ nom est vide, quel que soit le type ; la clé i18n retirée n'est plus référencée.     |
| 2    | Avec seulement des retraits rattachés, le dialogue de suppression n'affiche plus « Aucune prévision ni transaction ».                     |
| 3    | La cible et le montant de départ de la fiche objectif s'affichent sans décimales ; les totaux du dialogue de suppression aussi.           |
| 4    | Les tests passent, et rétablir l'un des trois anciens comportements fait échouer le test correspondant.                                   |
