# Review: Correctifs issus de la QA manuelle preview

- **Verdict**: approve
- **Diff**: `fef50776...working-tree` (uncommitted, 26 modified + 1 untracked)
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_04
- **Findings**: 0 critical, 0 warning, 2 minor

## Phases

### Phase 1 — Origine d'épargne rendue au détail d'un budget

- [x] `TransactionDecrypted` déclare les deux champs en `string | null` non optionnels ; le projet type-check — `backend-nest/src/modules/budget/domain/budget.entity.ts:152-154` ; `bun run type-check:full`, `npm run typecheck:spec` et `npm run build` (AOT, templates inclus) tous clean
- [x] Une réponse de `GET /budgets/:id/details` porte l'identifiant ET le nom, pas `null` — `supabase-budget.repository.ts:873-874` ; `budget.mapper.spec.ts:155-181`
- [x] Les tests backend passent, et retirer une affectation fait échouer un test — 111 pass / 0 fail sur les 14 fichiers des modules touchés ; `supabase-budget.repository.spec.ts:757` assert `.toBe('goal-1')`
- [x] Aucun autre site de construction non mis à jour — champs requis, tout oubli est fatal au type-check

### Phase 2 — Le reliquat cesse de piéger le retrait

- [x] Un solde résiduel sous la tolérance n'apparaît plus dans `GET /savings-goals/withdrawal-options` — `get-savings-goal-withdrawal-options.use-case.ts:54` ; spec discriminante (`> 0` renverrait `['funded','residue']`)
- [x] `112.22999999999999` s'affiche `112.23 CHF` ; `5500` reste sans décimales — `savings-goal-picker-field.ts:114,134,136` ; `savings-goal-picker-field.spec.ts:341-353`
- [x] Le sélecteur iOS affiche le même montant que le webapp — `Formatters.amountInput` (fr_CH, min 0 / max 2, groupe U+2019) rend `5’500`, `112.23`, `12’345.6` ; identique au pipe web `'1.0-2'` en `numberLocale` de-CH. iOS inchangé ce tour (`BUILD SUCCEEDED` + `TEST BUILD SUCCEEDED` sur le même contenu)
- [x] Les tests passent, et remettre `'1.0-0'` fait échouer le nouveau test web — `toContain('112.23')` impossible en `'1.0-0'`
- [x] Le contrat Zod tient — `availableAmount: z.coerce.number().positive()` inchangé
- [x] Garde d'écriture vs filtre de lecture — asymétrie bornée à ≤ un demi-centime, exigeant `available` exactement égal à 0.005 ; pas de finding
- [x] La règle projet couvre désormais le cas — `.claude/rules/03-frameworks-and-libraries/webapp-currency-formatting.md:22-27` énumère deux cas nommés et referme par « Hors de ces deux cas » ; l'exception ne sur-autorise pas (hero dashboard, pills, soldes scannés restent explicitement en `'1.0-0'`). Voir finding `rot` sur la section `Always` restée non alignée
- [x] Le commentaire du client dit la vérité — `savings-goal-picker-field.ts:238-240` cite maintenant `WITHDRAWAL_BALANCE_TOLERANCE`

### Phase 3 — Un refus serveur ne coûte plus la saisie

- [x] Les deux points d'entrée passent par le même service, sans dupliquer la soumission — `budget-items-container.ts:619` et `budget-details-page.ts:307` sont les seuls appelants ; la soumission vit dans `edit-transaction-dialog.ts:130-149`
- [x] Sur un refus, le dialogue reste ouvert et les valeurs saisies persistent — `edit-transaction-dialog.spec.ts:118` (`close` non appelé) ; persistance structurelle : `EditTransactionForm.model` est un `linkedSignal` sur `data.transaction`, référence figée à l'ouverture
- [x] Sur un succès, le dialogue se ferme et le toast s'affiche une seule fois — `edit-transaction-dialog.spec.ts:133` ; `budget-items-container.spec.ts:630-641` ; `budget-details-page.spec.ts:238-243`
- [x] Les tests passent, et fermer avant la réponse fait échouer le nouveau test — 158 tests frontend pass ; la preuve « ferme avant d'attendre » vit dans `edit-transaction-dialog.spec.ts:118`, seul endroit où le dialogue n'est pas mocké
- [x] La restauration optimiste n'est ni doublée ni sautée — `budget-details-store.ts` absent du diff, `#rollback` reste dans le seul `onError`
- [x] L'annulation fonctionne toujours — `closeDialog()` ferme sans valeur, les deux appelants sortent sur `if (!updated) return`
- [x] L'état d'envoi est relâché quoi qu'il arrive — `edit-transaction-dialog.ts:139-148`, `try/finally` ; l'ordre `close()` puis `finally` est sans effet (composant détruit)
- [x] Les tests des appelants discriminent le correctif — voir la ligne `Discrimination` de la table `Verification`

### Phase 4 — Ce que l'écran raconte redevient vrai

- [x] Le champ nom est vide à l'ouverture ; la clé i18n retirée n'est plus référencée — `add-transaction-form.ts:228` ; grep `addTransactionDefaultName` → 0 occurrence (code + `fr.json`, unique locale du projet)
- [x] Avec seulement des retraits, la phrase d'état vide disparaît — `goal-deletion-dialog.html:139-142` ; spec discriminante
- [x] La cible et le montant de départ s'affichent sans décimales ; les totaux du dialogue aussi — `savings-goal-detail-page.ts:240` ; `goal-deletion-dialog.html:50,63,75,259` ; lignes individuelles toujours `'1.2-2'`
- [x] Les tests passent, et rétablir un ancien comportement fait échouer son test — `'-1’300.00 CHF'` ne contient pas `'-1’300 CHF'` ; `'12’345.60 CHF'` ne contient pas `'12’346 CHF'`
- [x] L'écran ne sous-déclare plus les retraits — 4e tuile `goal-deletion-summary-withdrawals` (`html:78-93`), `'1.0-0'` conforme à la catégorie agrégation, `ph-no-capture` + `tabular-nums` présents, clé `savingsGoals.deletion.withdrawalSummary` définie et référencée une fois
- [x] Les données de la tuile atteignent réellement le dialogue — chaîne tracée : `supabase-savings-goal.repository.ts:1225-1226` (mêmes `withdrawals` que le tableau rendu, aucune troncature dans la récupération ni le `groupBy`) → `savingsGoalDeletionImpactSchema` (`shared/schemas.ts:807-808`) → `#store.fetchDeletionImpact` → `impact()`. Assertions de bout en bout côté backend : `supabase-savings-goal.repository.spec.ts:1290,1349`
- [x] La bascule 3→2 colonnes ne casse pas la mise en page à 0 retrait — `.grid-cols-2{…repeat(2…)}` ET `.grid-cols-3{…repeat(3…)}` sont bien émis dans le CSS de production (`dist/webapp/browser/*.css`), donc l'extracteur Tailwind v4 capture les candidats depuis `[class.grid-cols-N]` ; les deux specs vérifient la classe appliquée

## Findings

| Sev | Kind | Phase | Location | Issue | Fix |
| --- | ---- | ----- | -------- | ----- | --- |
| 🟢 | rot | 2 | `.claude/rules/03-frameworks-and-libraries/webapp-currency-formatting.md:105` | La règle amendée se contredit encore à un endroit : le blockquote d'exception (`:25`) place explicitement le sélecteur de retrait en `'1.0-2'`, mais la section `Always` — celle qu'une passe de conformité lit en premier, elle s'appelle « Always » — liste toujours « **Aggregation `'1.0-0'`** : hero, pills, totaux, **soldes**, balances… » sans renvoi vers l'exception. Portée limitée : le test `savings-goal-picker-field.spec.ts:341` échoue immédiatement si quelqu'un applique la section `Always` au sélecteur | Suffixer la puce Aggregation par « (hors les deux cas adaptatifs `'1.0-2'` ci-dessus) » |
| 🟢 | rot | 4 | `frontend/projects/webapp/src/app/feature/savings-goals/detail/components/goal-deletion-dialog/goal-deletion-dialog.html:78` | Le même template lit désormais deux sources de vérité pour « y a-t-il des retraits » : la nouvelle tuile teste `summary.withdrawalCount > 0` alors que la section sœur (`:217`) et la phrase d'état vide (`:141`) testent `withdrawals.length`. Or `withdrawalCount` est déclaré `.default(0)` dans `shared/schemas.ts:807` (repli de compatibilité pré-PUL-329) : un producteur qui l'oublierait rendrait `0` en silence et ferait disparaître la tuile — exactement la classe de défaut que la phase 1 a supprimée. Les deux valeurs concordent aujourd'hui (même tableau, aucune troncature) et aucune fixture ne les fait diverger, donc aucun test ne verrait l'écart | Aligner la garde de la tuile sur ses voisines : `@if (currentImpact.withdrawals.length > 0)`, et ne lire `summary.withdrawalCount` que pour l'afficher |

## Verification

| Metric        | Value                                             |
| ------------- | ------------------------------------------------- |
| Verified      | 100% (25/25) — 15 critères du plan + 10 vérifications adverses demandées |
| Files checked | `webapp-currency-formatting.md`, `budget.entity.ts`, `supabase-budget.repository.ts`, `budget.mapper.spec.ts`, `get-savings-goal-withdrawal-options.use-case.ts`, `savings-goal-withdrawal-policy.service.ts`, `supabase-savings-goal.repository.ts`, `shared/schemas.ts`, `savings-goal-picker-field.ts` + spec, `budget-details-dialog.service.ts` + spec, `budget-details-page.ts` + spec, `budget-items-container.ts` + spec, `edit-transaction-dialog.ts` + spec, `edit-transaction-form.ts`, `run-form-submit.ts`, `budget-details-store.ts`, `add-transaction-form.ts` + spec, `goal-deletion-dialog.html` + `.ts` + spec, `savings-goal-detail-page.ts` + spec, `fr.json`, `Decimal+Extensions.swift`, `Formatters.swift`, `SavingsGoalPickerField.swift` |
| Commands run  | `bun test` (14 fichiers) 111 pass / 0 fail · `vitest run` (9 specs) 158 pass / 0 fail · `bun run type-check:full` clean · `npm run typecheck:spec` clean · `npm run build` exit 0 (AOT : templates typés) · `prettier --check` clean (TS, HTML, MD) · grep du CSS de production pour `.grid-cols-2` / `.grid-cols-3` |
| Discrimination | Les deux tests réécrits pinent du comportement, pas seulement la signature. Chacun échoue sur trois régressions distinctes : (a) closure absente → `TypeError` ; (b) closure câblée sur le mauvais identifiant ou la mauvaise charge → `toHaveBeenCalledWith(TX_ID, update)` échoue ; (c) toast rétabli sur le chemin de refus → `not.toHaveBeenCalled()` échoue. Le cas « signature gardée mais dialogue fermé avant l'attente » n'est pas de leur ressort — le service y est mocké — et il est couvert par `edit-transaction-dialog.spec.ts:118`. Reste non discriminant, volontairement : `budget-items-container.spec.ts:630` « toasts success » est une caractérisation du critère 3 (« comportement inchangé »), pas une preuve de régression |
| Unchecked     | none |
| Unplanned     | none — les 27 fichiers du diff se rattachent tous à une phase. Écart assumé et justifié : phase 2 tâche 3 prescrivait `asCurrency` sur iOS ; `asAdaptiveCurrency` a été créé à la place, car `asCurrency` force 2 décimales (`5’500.00`) et aurait violé le critère 2 de la même phase |
