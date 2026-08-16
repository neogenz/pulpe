# Review: réalignement en/de/it sur le français arrivé de preview

- **Verdict**: approve
- **Diff**: `11c081457...HEAD`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_14
- **Findings**: 0 critical, 0 warning, 2 minor

## Phases

### Phase 2 — Webapp Transloco

- [x] `2)` Le contrôle de parité échoue si une clé ou un jeton `{{…}}` manque dans l'un des trois catalogues, et passe sur l'arbre réel ; aucune valeur n'est vide — `frontend/projects/webapp/src/app/core/i18n/catalog-parity.spec.ts:54` (11/11, dont les 6 rouges avant le correctif)
- [x] `6)` `pnpm test` et `pnpm quality` passent sans modifier une seule assertion de copie française — `frontend/projects/webapp/public/i18n/en.json:1` (root `pnpm test` 5/5 tâches, backend 1512/0, webapp 2991/2991 ; aucune spec touchée)
- [ ] `1)` Démarrer avec un snapshot `de`, clé retirée, `it.json` en 404 — `not-applicable` : le diff ne touche ni le chargeur ni la configuration, seulement le contenu des catalogues
- [ ] `3)` Devise CHF sous interface anglaise, dates dans la langue — `not-applicable` : aucun format ni locale dans le diff
- [ ] `4)` Bascule de langue, persistance, `language_changed` — `not-applicable` : aucun code de bascule dans le diff
- [ ] `5)` Export Excel allemand, amorçage des prévisions — `not-applicable` : aucune clé d'export ni d'amorçage dans le diff

## Findings

| Sev | Kind | Phase | Location                                           | Issue                                                                                                                                                                                                                        | Fix                                                                                                                             |
| --- | ---- | ----- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 🟢  | rot  | 2     | `frontend/projects/webapp/public/i18n/fr.json:539` | Six clés arrivées de preview n'ont aucun consommateur (`budget.forecastsLabel`, `forecastsPeriod`, `checkingLabel`, `checkingScope`, `accountBalanceBasis`, `budgetLine.forecastActions`). Elles coûtent trois traductions chacune | Les retirer de `fr.json` et des trois catalogues, ou brancher la surface qui les attendait. Appartient à preview, pas à ce diff |
| 🟢  | code | 2     | `frontend/projects/webapp/public/i18n/en.json:551` | `checkingScope` rend « Prévisions et mouvements » par `Planned and activity` : fidèle au lexique mais bancal comme syntagme anglais                                                                                            | `Planned items and activity`, si la clé trouve un consommateur                                                                  |

Corrigés dans ce même passage, donc absents du tableau : le terme du déficit divergeait du libellé voisin du même composant (`gap` / `Minus` / `scoperto` contre `Shortfall` / `Fehlbetrag` / `Ammanco`), et la divergence n°3 de `docs/I18N.md` décrivait encore la puce « Réalisé » sur une prévision, que preview a renommée « Revenu saisi ».

## Verification

| Metric        | Value                                                                              |
| ------------- | ---------------------------------------------------------------------------------- |
| Verified      | 100% (2/2 applicables, 4 non applicables)                                          |
| Files checked | `frontend/projects/webapp/public/i18n/{en,de,it}.json`, `docs/I18N.md`             |
| Unchecked     | `1)` not-applicable, `3)` not-applicable, `4)` not-applicable, `5)` not-applicable |
| Unplanned     | none                                                                               |
