# Journey iOS — Objectif et Lissage

- **Date** : 30 juillet 2026
- **Appareil** : iPhone SE (3e génération), iOS 18.5
- **Scénario** : `UITEST_BUDGET_GOAL_SPREAD_METADATA`
- **Verdict** : 4 étapes réussies sur 4

| # | Action | Résultat attendu | Résultat observé | Statut | Capture | Impact aval |
|---|---|---|---|---|---|---|
| 1 | Ouvrir le budget d’août 2026 et observer la ligne « Voyage au Japon ». | Une seule métadonnée compacte remplace l’accumulation des pills, sans gêner le nom, le montant ni le chevron. | La carte affiche `Lissé · objectif Voyage…` sur une ligne secondaire. Le nom, le montant et le chevron restent distincts. | PASS | [`01-budget-row-light.png`](journey-screenshots/01-budget-row-light.png) | Aucun. |
| 2 | Ouvrir la ligne d’épargne. | Le héros reste prioritaire, puis Objectif et Lissage apparaissent comme deux actions séparées et tactiles. | Le détail affiche le héros en premier, suivi de `Objectif : Voyage au Japon` et `Épargne lissée`, sans pills concurrentes. Les assertions confirment des cibles ≥ 44 pt et sans intersection. | PASS | [`02-detail-light.png`](journey-screenshots/02-detail-light.png) | Aucun. |
| 3 | Activer `Objectif : Voyage au Japon`. | La destination du bon objectif s’ouvre avec ses données exploitables. | La destination `Voyage au Japon` affiche 300 CHF épargnés, un montant de départ de 300 CHF et la prévision liée d’août 2026 à 413 CHF, sans faux état vide ni erreur réseau. | PASS | [`03-goal-destination.png`](journey-screenshots/03-goal-destination.png) | Aucun. |
| 4 | Revenir au détail puis activer `Épargne lissée`. | Les occurrences du bon groupe d’épargne lissée s’ouvrent sous le titre `Épargne lissée`. | La feuille `Épargne lissée` affiche juillet 2026 à 137 CHF puis la prévision courante d’août 2026 à 413 CHF, sans erreur réseau. | PASS | [`04-spread-destination.png`](journey-screenshots/04-spread-destination.png) | Aucun. |

## Exécution

| Contrôle | Résultat |
|---|---|
| `testGoalAndSpreadMetadataRemainUsableAcrossAccessibilityMatrix` | PASS — 4 modes, métadonnée exacte visible dans le viewport, 8 captures |
| `testGoalAndSpreadMetadataRoutesOpenExpectedDestinations` | PASS — objectif sans état vide et prévision liée `Août 2026 · 413 CHF` visible dans les deux destinations |
| Journey fonctionnel complet | PASS — données fournies par les services déterministes du scénario |
| Avertissements | `PulpeChip.swift:95` et version LLDB, préexistants |

## Captures supplémentaires

| Variante | Capture |
|---|---|
| Carte sombre | [`05-budget-row-dark.png`](journey-screenshots/05-budget-row-dark.png) |
| Détail sombre | [`06-detail-dark.png`](journey-screenshots/06-detail-dark.png) |
| Carte Accessibility 3 claire | [`07-budget-row-ax3-light.png`](journey-screenshots/07-budget-row-ax3-light.png) |
| Actions du détail Accessibility 3 claire | [`08-detail-actions-ax3-light.png`](journey-screenshots/08-detail-actions-ax3-light.png) |
