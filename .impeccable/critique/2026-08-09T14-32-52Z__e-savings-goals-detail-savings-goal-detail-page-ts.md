---
target: "workflow de retrait planifié PR #592 (web + iOS)"
total_score: 24
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 3
p2_count: 2
p3_count: 0
timestamp: 2026-08-09T14-32-52Z
slug: e-savings-goals-detail-savings-goal-detail-page-ts
---
Method: dual-agent (A: `/root/ux_assessment_a` · B: `/root/ux_assessment_b`)

## Design Health Score

| Heuristique Nielsen | Score | Motif |
|---|---:|---|
| Visibilité de l’état | 3/4 | Les états planifié, partiel et réalisé sont visibles, mais le conflit de plan n’offre pas de reprise opérable. |
| Correspondance avec le monde réel | 2/4 | La distinction annoncé/réalisé est bonne, mais le « mouvement » signé mélange contribution et retrait. |
| Contrôle et liberté | 3/4 | Simulation, annulation et retour existent ; la destination globale limite les lots multi-mois. |
| Cohérence et standards | 2/4 | Bonne parité générale, avec des divergences de récapitulatif et d’erreurs sur iOS. |
| Prévention des erreurs | 2/4 | Les règles serveur protègent le solde, mais le récapitulatif peut présenter une transformation différente de celle persistée. |
| Reconnaissance plutôt que mémoire | 2/4 | L’utilisateur doit se souvenir qu’une contribution positive subsiste derrière un retrait négatif. |
| Flexibilité et efficacité | 2/4 | La redistribution aide, mais un mois sans budget bloque la destination liée pour tout le lot. |
| Esthétique et minimalisme | 3/4 | Le mode simulation reste focalisé ; l’aide sur les signes est répétée dans chaque ligne. |
| Diagnostic et récupération | 2/4 | Le conflit 409 laisse un brouillon obsolète ; iOS peut afficher le message serveur anglais. |
| Aide et documentation | 3/4 | Les explications de destination sont solides, mais la conservation de la contribution n’est pas dite. |

**Total : 24/40 — améliorations significatives avant release.**

## Design Specificity Verdict

**Forte spécificité Pulpe, mais sémantique centrale pas encore prête pour release.** Le parcours est construit autour du vrai modèle Pulpe — projection mensuelle, Prévision/Réel/Pointé, retrait planifié, reliquat et lien objectif ↔ budget. Il ne ressemble pas à un CRUD financier générique. En revanche, le formulaire et le récapitulatif compressent parfois deux vérités simultanées, contribution et retrait, dans une seule valeur signée. Pour une décision financière, cette ambiguïté est trop risquée.

## Scan déterministe et inspection rendue

Le détecteur Impeccable a été exécuté une fois sur `frontend/projects/webapp/src/app/feature/savings-goals/detail` : **0 finding**, sortie JSON `[]`, aucune règle ni localisation. C’est un bon signal sur les anti-patterns statiques, pas une validation du workflow.

Le preview a été ouvert dans un onglet neuf. Le second évaluateur a pu entrer dans la démo publique, inspecter la page détail objectif aux formats desktop et 390 × 844, et confirmer une hiérarchie/accessibilité générale propre. Les données de démo ne contenaient aucun retrait, donc les nouveaux états n’ont pas pu être rendus. Le préflight d’injection a été interrompu avant vérification : aucun overlay Impeccable n’est revendiqué. Une barre de défilement horizontale persistante et un fil d’Ariane tronqué ont été observés sur mobile.

## Impression générale

Le modèle métier et les garde-fous sont nettement plus solides que la présentation du geste. Le cycle annoncé → partiel → réalisé évite correctement le double débit dans les calculs. Le principal risque UX se situe au moment où l’utilisateur confirme ce qu’il croit planifier : le récapitulatif peut raconter une autre opération que celle enregistrée. Je ne recommande donc pas de considérer le workflow « bon pour fusion » sans corriger les P1 ci-dessous.

## Ce qui fonctionne

1. **Annoncé et réalisé sont correctement séparés.** La projection ne consomme que le reliquat et les scénarios E2E couvrent la réalisation partielle sans double comptage.
2. **Les deux destinations sont expliquées clairement.** « Objectif uniquement » indique que le budget ne change pas ; « revenu lié » expose la conséquence sur le disponible à dépenser.
3. **Le budget devient actionnel.** Les revenus liés affichent leur provenance, proposent « Réaliser ce retrait / le solde » et ramènent vers l’objectif.
4. **Le mode simulation inspire du contrôle.** Rien n’est écrit avant confirmation, l’abandon est explicite et les autres sections sont masquées pour garder le focus.
5. **La parité web/iOS est réelle sur l’essentiel du modèle.** Les statuts, destinations et protections sont présents sur les deux plateformes.

## Problèmes prioritaires

### P1 — Le récapitulatif certifie une opération différente de celle persistée

La règle métier conserve une contribution positive lorsqu’un retrait est ajouté au même mois. Le calculateur additionne correctement les deux, mais l’UI choisit soit la contribution, soit le retrait comme « mouvement courant ». Un mois `+200` auquel on ajoute `−500` peut donc être résumé `+200 → −500`, alors que la persistance conserve `+200` **et** ajoute `−500`.

**Pourquoi c’est critique :** l’utilisateur confirme une représentation fausse d’une décision financière ; il peut croire que sa prévision d’épargne a été supprimée.

**Correction minimale :** remplacer le mouvement signé par trois informations explicites au récapitulatif : « Épargne prévue conservée +200 », « Retrait planifié −500 », « Effet net du mois −300 ». Renommer le CTA en « Planifier le retrait » pour rappeler qu’aucun argent ne sort encore.

**Preuves :** [SAVINGS.md](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/docs/SAVINGS.md:386), [calculateur partagé](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/shared/src/calculators/savings-goal-plan.ts:531), [récapitulatif web](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:1217), [récapitulatif iOS](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanApplyRecapSheet.swift:215).

### P1 — La destination globale peut modifier silencieusement plusieurs mois

Web et iOS demandent une seule destination pour tous les retraits modifiés. Si des mois existants ont des destinations mixtes, le dialogue retombe sur « objectif uniquement » ; la confirmation peut donc convertir silencieusement des revenus liés. De plus, un seul mois sans budget désactive l’option liée pour tous les autres mois éligibles.

**Pourquoi c’est critique :** le lot peut retirer des revenus de budgets que l’utilisateur n’avait pas l’intention de changer, donc modifier son disponible à dépenser.

**Correction minimale :** conserver la destination existante par mois ; ne demander un choix que pour les nouveaux retraits. Si un choix global est gardé, afficher les mois qui seront convertis et demander une confirmation explicite. Nommer aussi les périodes sans budget au lieu de désactiver silencieusement tout le lot.

**Preuves :** [dialogue web](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-apply-dialog.ts:228), [application web](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/frontend/projects/webapp/src/app/feature/savings-goals/detail/services/goal-plan-simulator-store.ts:259), [récapitulatif iOS](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanApplyRecapSheet.swift:45), [application iOS](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:434).

### P1 — Le conflit de plan n’a pas de chemin de reprise, et iOS ne le localise pas

Le web traduit le conflit mais conserve le brouillon obsolète ouvert avec une instruction de resimuler sans action dédiée. iOS ne mappe pas `SAVINGS_GOAL_PLAN_CONFLICT` et peut afficher le message serveur anglais dans l’app française.

**Pourquoi c’est critique :** après une modification sur un autre appareil/onglet, l’utilisateur peut retenter sur une base invalide sans comprendre ce qui a changé.

**Correction minimale :** au 409, fermer le récapitulatif, relire le plan et afficher « Le plan a changé. Vérifie les montants actualisés avant de réappliquer. » Conserver les intentions compatibles si possible ; sinon repartir d’un plan frais. Ajouter les codes de plan au mapping iOS.

**Preuves :** [gestion web](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:1237), [mapping iOS](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/ios/Pulpe/Core/Network/APIError.swift:159), [gestion iOS](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/ios/Pulpe/Features/SavingsGoals/Simulator/GoalPlanSimulatorSheet.swift:479), [code backend](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/backend-nest/src/common/constants/error-definitions.ts:565).

### P2 — Un retrait figé indique le budget sans y conduire

Dans le simulateur, un retrait partiellement ou totalement réalisé est verrouillé et le texte dit « Modifie-le depuis le budget ». La ligne n’est pourtant pas interactive et ne connaît pas le budget à ouvrir. L’utilisateur doit quitter la simulation, retrouver la section Retraits puis retrouver la bonne ligne.

**Correction minimale :** ajouter une action « Ouvrir le budget de [mois] » directement dans l’état figé, ou au minimum un bouton de sortie qui repositionne la page sur le retrait lié.

**Preuves :** [timeline web](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.ts:155), [ligne iOS](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/ios/Pulpe/Features/SavingsGoals/Components/GoalPlanMonthRow.swift:156).

### P2 — La lecture d’un retrait partiel ressemble encore à un double comptage

Une ligne planifiée partielle affiche le montant planifié complet comme valeur principale, le reliquat en petit, puis les réalisations dans une autre section. Un retrait planifié de `500`, réalisé à `300`, peut donc montrer visuellement `−500`, `reste −200` et `−300`. Le calcul est juste, mais la lecture rapide suggère `800` retirés. Sur le web, l’`aria-label` explicite du lien remplace aussi le nom accessible visible et masque montant/statut/reliquat aux lecteurs d’écran.

**Correction minimale :** pour un retrait partiel, afficher le **reliquat** comme montant principal (`−200 restant`) et l’original/réalisé comme contexte secondaire, ou regrouper les réalisations sous leur plan. Enrichir le nom accessible web avec mois, statut, reliquat et montant.

**Preuves :** [liste web](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-withdrawals-list.ts:114), [section iOS](/Users/maximedesogus/.codex/worktrees/0bd1/pulpe-workspace/ios/Pulpe/Features/SavingsGoals/GoalWithdrawalsSection.swift:110).

## Charge cognitive et parcours émotionnel

- **Réussi :** focus unique, groupement, hiérarchie, choix limité à deux destinations et divulgation progressive simulation → récapitulatif → réalisation.
- **Fragile :** le champ signé oblige à mémoriser qu’une contribution reste active derrière une valeur négative ; l’aide « positif/négatif » répétée augmente la densité sans résoudre cette ambiguïté.
- **Entrée rassurante :** projection en direct, annulation et message « rien n’est modifié » donnent du contrôle.
- **Creux principal :** `+200 → −500` et « Appliquer le retrait » font craindre un remplacement ou un débit immédiat.
- **Remontée :** les destinations et les actions de réalisation dans le budget sont claires.
- **Échec mal accompagné :** le 409 ne donne pas de reprise, surtout sur iOS.

## Red flags personas

- **Jordan, novice financier :** interprète littéralement la flèche comme un remplacement de la contribution.
- **Riley, stress/multi-appareil :** rencontre le conflit et ne sait pas comment repartir sans perdre ou rejouer son intention.
- **Sam, VoiceOver :** la radio iOS n’expose pas explicitement l’état sélectionné ; les liens web de retrait masquent les informations financières visibles derrière un `aria-label` générique.

## Observations mineures

- iOS considère un lot uniforme si les montants finaux sont identiques, même lorsque les montants initiaux diffèrent ; le web est plus prudent.
- Les retraits hors budget et liés sont rendus dans deux boucles, donc l’ordre n’est pas chronologique à travers les deux destinations.
- L’état d’erreur de la liste web n’offre pas « Réessayer ».
- La légende positif/négatif devrait être unique plutôt que répétée sur chaque mois.
- Sur mobile, le fil d’Ariane observé dans le preview déborde horizontalement avec une barre de défilement visible.

## Questions à considérer

1. Si le retrait n’efface pas la contribution, pourquoi l’utilisateur édite-t-il un mouvement unique plutôt que deux valeurs explicites ?
2. Une action qui ne sort encore aucun argent doit-elle s’appeler « Appliquer le retrait » ou « Planifier le retrait » ?
3. La destination doit-elle être globale au lot, ou attachée à chaque mois — comme le permet déjà le contrat backend ?
