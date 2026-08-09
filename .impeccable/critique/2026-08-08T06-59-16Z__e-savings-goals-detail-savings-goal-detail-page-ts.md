---
target: flux objectif d’épargne et retrait
total_score: 20
max_score: 40
na_heuristics:
p0_count: 1
p1_count: 3
timestamp: 2026-08-08T06-59-16Z
slug: e-savings-goals-detail-savings-goal-detail-page-ts
---
# Critique UX — retrait d’un objectif d’épargne

## Verdict

L’écran objectif est spécifique et rassurant, mais le raccord objectif/budget mélange trois concepts : Prévision, Réel et Pointé. Le détecteur statique ne signale aucun anti-pattern automatique ; les défauts sont fonctionnels, sémantiques et observables dans le parcours réel.

## Scores Nielsen

| Heuristique | Score | Constat |
| --- | ---: | --- |
| Visibilité de l’état | 2/4 | 100 % reçu reste « À pointer » et actionnable. |
| Correspondance au monde réel | 2/4 | Retrait, réalisation et pointage sont confondus. |
| Contrôle et liberté | 2/4 | Retrait indépendant impossible depuis le plan. |
| Cohérence et standards | 1/4 | `price_check` remplace la bascule de pointage dans le même emplacement. |
| Prévention des erreurs | 2/4 | Le négatif légitime est bloqué sans choix objectif/budget. |
| Reconnaissance plutôt que mémoire | 2/4 | L’utilisateur rapproche seul plan, revenu, enfant et retrait. |
| Flexibilité et efficacité | 2/4 | Un retrait direct force un changement de contexte. |
| Esthétique et minimalisme | 3/4 | Interface calme, mais suivi mensuel dense. |
| Diagnostic et récupération | 2/4 | Le message « depuis le budget, pas ici » contredit le besoin. |
| Aide et documentation | 2/4 | Aucun modèle explicite Prévu/Réel/Pointé. |
| **Total** | **20/40** | **Améliorations significatives nécessaires.** |

## Priorités

### P0 — retrait indépendant impossible

Accepter un mouvement mensuel signé et traduire le négatif en retrait planifié distinct. Avant application, proposer « Mettre à jour l’objectif uniquement » ou « Créer aussi un revenu dans le budget » avec l’effet de chaque choix.

### P1 — retraits planifiés absents du suivi

Séparer « Retraits planifiés » et « Retraits réalisés ». Un retrait annoncé doit apparaître avant tout Réel, avec son origine hors budget ou liée au budget et son reliquat.

### P1 — réalisation et pointage partagent la même affordance

La bascule signifie toujours « À pointer ↔ Pointé » sur un Réel. La Prévision expose un bouton textuel distinct « Réaliser ce retrait », puis « Réaliser le solde » en cas de partiel.

### P1 — état final contradictoire

À reliquat nul, masquer toute action de réalisation, afficher « Réalisé » et sortir la Prévision de la file à réaliser. Le Réel créé est unique et pointé ; aucun enfant non pointé ne subsiste.

## Copy retenue

- Champ : « Mouvement de l’objectif ce mois »
- Aide : « Positif = mettre de côté · Négatif = retirer »
- Option recommandée : « Mettre à jour l’objectif uniquement »
- Option liée : « Créer aussi un revenu dans le budget de septembre »
- Action : « Appliquer le retrait »

## Charge cognitive et personas

Charge modérée : le flux échoue sur le regroupement des états, la focalisation d’une action à la fois et la mémoire de travail entre objectif et budget. Une première utilisation peut interpréter `price_check` comme une variante cassée du pointage ; les cas partiels/totaux restent ambigus ; les contrôles imbriqués chargent aussi la navigation clavier et lecteur d’écran.

## Evidence

- Assessment A : inspection UX et code, score 20/40, 1 P0 et 3 P1.
- Assessment B : détecteur isolé, résultat exact `[]`, aucun faux positif.
- Preview : septembre contient « Retrait prévu · -4’500 CHF » ; le budget affiche 0 CHF à recevoir, 4’500 CHF reçu, 100 %, une transaction enfant et un état encore à pointer.
- Saisie `-1` : erreur « Le montant doit être positif ou nul. Un retrait se crée depuis le budget, pas ici. »

Questions skipped: findings are straightforward and the requested scope is explicit.
