# Review: Corriger la lisibilité du détail d’un objectif d’épargne

- **Verdict**: approve
- **Diff**: `origin/preview...HEAD` + working tree
- **Axes run**: code, functional, relevancy
- **Date**: 2026_07_28
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Rendre la dialog content-sized

- [x] La configuration d’ouverture ne définit aucune hauteur fixe et conserve un plafond de `90dvh`. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:972`
- [x] Avec aucun élément rattaché, la dialog reste compacte et ses actions suivent directement le contenu. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:972`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:114`
- [x] Avec un impact long, la dialog ne dépasse pas 90 % du viewport, la liste reste consultable et les actions restent accessibles. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:974`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:114`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:199`, `frontend/e2e/tests/features/savings-goal-deletion.spec.ts:179`
- [x] Les choix de suppression et la commande retournée restent inchangés. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:77`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog.ts:126`

### Phase 2 — Clarifier la projection et la cible

- [x] Quand la barre utilise la projection planifiée, son libellé porte le même repère bleu. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:262`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:347`
- [x] Quand une projection calculée distincte est affichée, aucun repère bleu trompeur n’est ajouté à la statistique de repli. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:347`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:381`
- [x] La ligne Cible et son échantillon utilisent l’ambre Pulpe existant, avec un contraste de 4,40:1 sur le panneau clair. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:229`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.ts:80`
- [x] Épargné reste vert, Projection reste bleue et pointillée, Cible devient ambre et pleine. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:205`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:215`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.ts:229`
- [x] Les tests ciblés de la page et du graphique passent. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.spec.ts:391`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.config.spec.ts:99`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-projection-chart.spec.ts:116`, `frontend/e2e/tests/features/savings-goals-progress.spec.ts:273`

### Phase 3 — Aligner le plan mensuel sur sa date de début

- [x] Avec un début au 1er septembre, juillet et août ne figurent pas dans « Ton plan, mois par mois ». — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.ts:225`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.spec.ts:131`, `frontend/e2e/tests/features/savings-goals-progress.spec.ts:403`
- [x] La première ligne affichée correspond à septembre et les cumuls restent ceux du serveur. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.ts:230`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.ts:247`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.spec.ts:149`
- [x] Le graphique conserve son ancre « Maintenant » et le montant de départ avant septembre. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:555`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/savings-goal-detail-page.ts:610`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.ts:225`
- [x] Un budget existant avant le début n’est jamais présenté comme absent. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.ts:227`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.spec.ts:131`
- [x] Un vrai mois sans budget après le début garde la chip « Pas de budget » et l’aide associée. — `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.ts:244`, `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-plan-timeline.spec.ts:155`

## Findings

None.

## Verification

| Metric | Value |
| --- | --- |
| Verified | 100% (14/14) |
| Runtime | Compte seed réel, création puis suppression d’un objectif temporaire et de ses 2 prévisions |
| E2E | 17/17 ciblés, puis 10/10 sur 5 répétitions des 2 scénarios ajoutés ; scénario couleur mis à jour 1/1 |
| Files checked | `savings-goal-detail-page.ts`, `savings-goal-detail-page.spec.ts`, `goal-deletion-dialog.ts`, `goal-deletion-dialog.html`, `goal-deletion-dialog.scss`, `goal-plan-timeline.ts`, `goal-plan-timeline.spec.ts`, `goal-projection-chart.config.ts`, `goal-projection-chart.config.spec.ts`, `goal-projection-chart.ts`, `goal-projection-chart.spec.ts`, `chart-theme.ts`, `savings-goal-deletion.spec.ts`, `savings-goals-progress.spec.ts` |
| Unchecked | none |
| Unplanned | none |
