---
objective: "Remplacer le push de release administrateur par la promotion protégée d'un candidat unique, sans doubler la CI ni bloquer l'intégration continue sur preview."
status: in-progress
---

# Plan: Promotion de release Pulpe protégée et agentique

## Overview

| Field      | Value                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Laisser les agents préparer, vérifier et publier la release ; GitHub conserve les preuves et une personne autorise la production par la PR vers `main`.             |
| **Source** | Demande du 16 août 2026 de réévaluer le flux proposé contre la CI Pulpe réelle, son gain mesurable et son adéquation à un release management entièrement agentique. |

Le changement est pertinent, mais pour la fiabilité et l'audit avant l'économie de calcul. Le plan initial était trop large : il est ramené à une preuve légère de staging, une seule branche logique de release utilisée dans deux PR successives et un workflow de production autonome. Aucun troisième environnement permanent, aucune merge queue et aucun remplacement de Changesets ne sont nécessaires.

Audit GitHub Actions du 17 juillet au 16 août 2026 :

| Mesure réelle         | Constat                                                                                              | Conséquence du plan                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Runs `ci.yml`         | 467 `pull_request`, 118 push `preview`, 10 push `main`                                               | Toutes les exécutions PR restent ; seules les validations post-merge prouvées redondantes disparaissent.                 |
| Push `preview`        | 91/118 correspondent à une PR fusionnée ; 27 sont des push directs, dont 10 commits `chore(release)` | Les 91 runs post-merge sont supprimables. Les 27 push directs deviennent des PR et gardent donc une validation complète. |
| Runs complets réussis | 318 PR + 87 `preview` + 10 `main` = 415                                                              | 67 runs post-merge `preview` et 10 runs `main`, soit 77/415 ≈ 19 %, peuvent être remplacés par des preuves légères.      |
| Durée                 | Médiane 12,4 min sur push `preview`, 12,3 min sur push `main`                                        | Le chemin de release évite environ une matrice de 12 min ; la vérification des déploiements reste nécessaire.            |
| Consommation observée | Échantillon de 11 runs réussis : médiane 36,1 runner-min, dont 11,4 macOS                            | Ordre de grandeur évitable : ~2 800 runner-min et ~880 min macOS par mois, avant le faible coût des gates légers.        |
| Coût monétaire        | Dépôt public, runners GitHub standard                                                                | Gain direct actuel : 0 USD ; le bénéfice porte sur les files, le feedback, la lisibilité et la sécurité du processus.    |

La décision de cutover reste réversible : le nouveau flux est implémenté à côté du flux actuel, puis validé par la première vraie release utilisée comme canary. Aucun merge artificiel n'est requis et la CI post-merge actuelle n'est retirée qu'après le succès complet de cette canary.

État au 17 août 2026 : les workflows de préparation, preuve staging,
promotion, gate et publication production sont fusionnés. Le déclenchement
post-Railway a passé une canary sur une PR normale. Restent la première vraie release
de bout en bout, puis le cutover des checks requis, de la CI `push` redondante et du
bypass administrateur historique ; le plan demeure donc `in-progress`.

## Phases

| #   | Phase                                            | File                         |
| --- | ------------------------------------------------ | ---------------------------- |
| 1   | Prouver le staging en observation                | [`phase-1.md`](./phase-1.md) |
| 2   | Promouvoir un candidat unique avec deux PR       | [`phase-2.md`](./phase-2.md) |
| 3   | Publier depuis GitHub et retirer l'ancien bypass | [`phase-3.md`](./phase-3.md) |

## Resources

| Source                                                                                                                      | Verified                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| https://api.github.com/repos/neogenz/pulpe/actions/workflows/ci.yml/runs?created=%3E%3D2026-07-17T00%3A00%3A00Z             | Le volume, les événements, les conclusions et les durées des runs `ci.yml` sur 30 jours.                                                                                    |
| https://github.com/neogenz/pulpe/actions/runs/31936530681                                                                   | Un run complet récent confirme 15 jobs, environ 36 runner-min et 12 min de temps mural.                                                                                     |
| https://api.github.com/repos/neogenz/pulpe                                                                                  | Le dépôt est public, `preview` est la branche par défaut, les merge commits sont autorisés, les branches ne sont pas supprimées après fusion et l'auto-merge est désactivé. |
| https://docs.github.com/en/billing/concepts/product-billing/github-actions                                                  | Les runners GitHub standard sont gratuits sur les dépôts publics ; optimiser ces minutes ne réduit donc pas la facture actuelle.                                            |
| https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets | Les rulesets protègent les deux branches et peuvent exiger des checks différents sans donner de bypass général à l'App.                                                     |
| https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments                             | L'environnement `production` peut réserver ses secrets et ses mutations au workflow issu de la PR approuvée.                                                                |
| https://docs.github.com/en/actions/concepts/security/github_token                                                           | Une identité GitHub App est requise pour créer des PR d'automatisation qui déclenchent les workflows normaux.                                                               |

## Decisions

| Decision                                                                                                         | Why                                                                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Conserver Changesets CLI en mode `fixed` et la logique produit actuelle de `/release`.                           | Pulpe publie une seule version cohérente sur cinq packages, quatre langues et iOS ; `changesets/action` ne couvre pas seul ce contrat.                                           |
| Valider complètement les PR vers `preview`, puis prouver l'identité de l'arbre et des déploiements après fusion. | La seconde compilation du même contenu apporte peu ; l'arbre Git et les SHA fournisseurs répondent précisément au risque de drift.                                               |
| Valider `Staging Ready` sur la première vraie release canary avant de retirer la CI `push`.                      | Les échecs fermés déjà observés couvrent le drift et la preuve absente ; une canary réelle valide le chemin heureux sans imposer de merges artificiels.                          |
| Utiliser une seule branche logique `release/vX.Y.Z` et un seul commit de version.                                | La PR vers `preview` valide le candidat ; après son merge commit, la branche avance en fast-forward sur ce commit puis sert sans nouvelle modification à la PR vers `main`.      |
| Suspendre les merges vers `preview` de la création de la branche release jusqu'à sa preuve `Staging Ready`.      | Une feature arrivée pendant la CI manquerait aux notes ou changerait le tree ; après la preuve, `preview` peut avancer sans modifier le candidat figé.                           |
| Garder exactement deux environnements permanents : preview et production.                                        | Un environnement release-candidate dédié complexifierait Vercel, Railway, Supabase et les secrets pour un besoin couvert par une courte fenêtre de stabilisation.                |
| Exiger une approbation humaine uniquement sur la PR de production, l'App n'ayant aucun bypass de `main`.         | Les agents peuvent préparer et corriger ; la décision irréversible reste explicite, séparée de l'identité qui a créé la PR et auditée dans GitHub.                               |
| Conserver les rebuilds fournisseurs propres à preview et production.                                             | Vercel et Railway ont des variables et secrets d'environnement distincts ; un « build once, promote everywhere » uniforme n'existe pas pour l'ensemble web/backend/iOS de Pulpe. |
| Ne pas introduire de merge queue ni automatiser l'auto-merge de toutes les feature PR.                           | Le flux de release n'a besoin d'automatiser que sa PR de préparation ; étendre la politique aux contributions publiques serait un autre chantier.                                |
| Installer `Pulpe Release` uniquement sur `neogenz/pulpe`, avec Contents et Pull requests en lecture/écriture.    | Son jeton est court, ses deux secrets restent dans GitHub et l'App n'a ni webhook, ni permission Actions, ni bypass de ruleset.                                                  |
