---
objective: "Toute décision financière et tout montant qui la justifie restent cohérents au centime sur Web, backend partagé et iOS, sans bruit décimal sur les agrégats purement visuels."
status: in-progress
---

# Plan: Rendre les arrondis monétaires cohérents dans tout le produit

## Overview

| Field      | Value                                                                                                                                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Comparer les montants à la précision monétaire avant de décider d'un dépassement, d'un déficit, d'un plafond ou d'une cible atteinte, puis afficher adaptativement les centimes qui expliquent cet état.  |
| **Source** | Demande utilisateur du 17 août 2026, à la suite de [PUL-335](https://linear.app/pulpe/issue/PUL-335/corriger-les-depassements-de-prevision-arrondis-a-0-chf) et du correctif `forecast-overage-rounding`. |

## Phases

| #   | Phase                                                           | File                         |
| --- | --------------------------------------------------------------- | ---------------------------- |
| 1   | Poser le contrat de comparaison monétaire au centime            | [`phase-1.md`](./phase-1.md) |
| 2   | Corriger les états budgétaires et les actions Web               | [`phase-2.md`](./phase-2.md) |
| 3   | Aligner les états budgétaires iOS et les formules miroirs       | [`phase-3.md`](./phase-3.md) |
| 4   | Sécuriser les décisions métier des objectifs et retraits        | [`phase-4.md`](./phase-4.md) |
| 5   | Aligner les parcours objectifs et retraits sur les deux clients | [`phase-5.md`](./phase-5.md) |
| 6   | Prouver la non-régression transversale                          | [`phase-6.md`](./phase-6.md) |

## Decisions

| Decision                                                                                                                                                    | Why                                                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Une décision monétaire compare un écart ramené au centime ; le pourcentage arrondi reste uniquement une information visuelle.                               | `0.1 + 0.2` et `0.3` doivent être égaux, tandis que `58.55` et `58.50` doivent rester séparés de `0.05`.                                               |
| Tout montant qui nomme, colore ou préremplit un état utilise un format adaptatif de 0 à 2 décimales ; les agrégats sans conséquence restent compacts.       | Un état « dépassé » ou « déficit » ne doit jamais être justifié par `0 CHF`, mais `5 000 CHF` ne doit pas devenir `5 000.00 CHF` partout.              |
| Le socle TypeScript reçoit une seule primitive de différence monétaire ; Swift réutilise `Decimal` et `rounded(2)` déjà présents.                           | C'est la plus petite correction commune : aucune dépendance décimale, aucun nouveau type de montant et aucune migration de données.                    |
| Les répartitions au plus grand reste, l'arrondi supérieur des mensualités, la conversion FX à deux décimales et les pourcentages entiers restent inchangés. | Ces arrondis ont un objectif métier explicite et des tests existants ; les remplacer créerait une régression plutôt que corriger l'incohérence d'état. |
| Toute modification d'une formule partagée est livrée avec son miroir Swift et les mêmes cas limites dans la même phase.                                     | Le build ne détecte pas une divergence `shared` / iOS ; la parité doit donc être prouvée par des fixtures jumelles.                                    |
