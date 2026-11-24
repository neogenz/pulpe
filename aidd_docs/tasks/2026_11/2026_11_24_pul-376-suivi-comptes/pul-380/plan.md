---
objective: "Le détail d'un compte affiche « Fin novembre : 8 000 » : sa valeur à jour plus ce qui reste à venir sur le budget en cours. Le serveur la calcule avec la valeur et la rend avec l'historique ; aucun client n'additionne. Web, iOS et Android, avec la même parité."
status: pending
---

# Plan: PUL-380, voir la projection de fin de mois d'un compte

Source : Linear PUL-380 ([contract.md](./contract.md)), epic PUL-376 ([../epic.md](../epic.md)), après PUL-379 ([../pul-379/plan.md](../pul-379/plan.md)). Branche `feat/pul-380-projection-fin-de-mois` empilée sur `feat/pul-379-detail-historique`. Les écrans de détail de PUL-379 (web, iOS, Android) doivent exister avant les phases 2 à 4.

## Phases

| #   | Phase                                                        | Depends on         |
| --- | ------------------------------------------------------------ | ------------------ |
| 1   | Serveur : projection rendue par `GET /v1/assets/:id/history` | none               |
| 2   | Web : ligne « Fin novembre » sous la valeur du détail        | 1, PUL-379 phase 3 |
| 3   | iOS : même ligne dans `AssetDetailView`                      | 1, PUL-379 phase 4 |
| 4   | Android : même ligne dans `(net-worth)/asset/[id].tsx`       | 1, PUL-379 phase 6 |

## Impact

| Category      | Verdict and evidence                                                                                                                                                                             | Handled in |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| runtime       | Aucune migration. Trois lectures PostgREST simples (budget du mois, ses prévisions liées, ses mouvements), en plus, seulement sur l'historique d'un élément. `GET /v1/assets` ne change pas.     | 1          |
| regression    | Le signe d'un lien est sorti de `retainedMoves` (`asset.formulas.ts:202-208`) pour servir aux deux calculs : tout `asset.formulas.spec.ts` existant reste vert sans toucher une valeur attendue. | 1          |
| architecture  | Calcul serveur seul (contrat : « jamais additionnée par les clients »). Rien dans `shared/src/calculators/`, donc pas de miroir Swift.                                                           | 1–4        |
| api           | Champ ajouté à la réponse de l'historique, aucun champ retiré ni resserré. Les apps installées (iOS 1.14, Android) n'appellent pas cet endpoint.                                                 | 1          |
| analytics     | Aucun événement : la ligne est une lecture, l'écran de détail est déjà tracé (`netWorthAssetDetail`).                                                                                            | none       |
| documentation | `docs/BUSINESS_RULES.md` § Patrimoine.                                                                                                                                                           | 1          |

## Ce que le code fait aujourd'hui

- Valeur = dernière saisie + effets retenus depuis (`assetValueCents`, `asset.formulas.ts:251-266`). Une prévision compte, à un instant, le plus grand de son montant et de ses mouvements pointés si elle est pointée, sinon ses seuls mouvements pointés (`countedCents`, `:141-148`), tous mouvements confondus, sans filtre de nature.
- Signe : par `account_id`, un Revenu monte un `own`, une Dépense ou une Épargne le baisse, l'inverse sur une dette (`accountSign`, `:131-134`). Par `asset_id`, une Épargne monte un `own`, un Revenu tiré le baisse, une Dépense baisse une dette (`linkedAssetSign`, `:120-125`).
- Zéro d'une dette : appliqué événement par événement dans l'ordre de pointage (`:238-240`).
- Un mouvement réel rattaché à une prévision n'a pas de compte : il suit celui de sa prévision (`20261125120000_link_movement_to_account.sql:18-21`). Seuls les mouvements libres portent `transaction.account_id` (`20261126120000_list_asset_movements_for.sql:80-87`).
- Le budget en cours : `getBudgetPeriodForDate(parseIsoDateLocal(formatBusinessCalendarDate()), user.payDayOfMonth)` (`get-current-month.tool.ts:40-43`, date du jour en Europe/Zurich). `payDayOfMonth` voyage déjà dans `AuthenticatedUser` (`user.decorator.ts:15`) : aucune lecture de plus.
- L'historique rend l'élément calculé à côté des entrées (`get-asset-history.use-case.ts:79-89`, `asset.mapper.ts:47-53`) ; les écrans de détail lisent leur en-tête dans cette réponse (iOS : `AssetDetailView.swift:62-77`).

## Decisions

| Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Why                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Formule.** Projection = valeur à jour + Σ signe × reste, pour chaque mouvement du budget en cours lié au compte. Reste d'une prévision = `max(prévu, Σ de tous ses mouvements réels)` − ce qu'elle compte aujourd'hui (`countedCents` à maintenant). Reste d'un mouvement libre = son montant s'il n'est pas pointé, 0 sinon. Chaque reste est converti au taux du jour et arrondi au centime comme un effet de la valeur.                                                                                   | « Ce qu'il comptera une fois tout pointé, moins ce qu'il compte déjà » : soustraire ce qu'il compte maintenant, et non ce qui a bougé depuis la saisie, évite de compter deux fois ce qu'une saisie a absorbé (CA10). Le reste n'est jamais négatif : tous les réels ≥ réels pointés. |
| **Mouvements du mois.** Les prévisions du budget en cours dont `account_id` ou `asset_id` est le compte, pointées ou non, avec tous leurs mouvements réels ; les mouvements libres du budget dont `account_id` est le compte, pointés ou non. Les deux liens, avec le signe de la valeur (fonction `linkSign` extraite de `retainedMoves`).                                                                                                                                                                    | Projection et valeur suivent la même règle : une Épargne 500 du Compte courant versée sur le Livret baisse l'un de 500 et monte l'autre de 500.                                                                                                                                       |
| **Dette.** Le zéro s'applique au résultat : `max(0, valeur + Σ)`.                                                                                                                                                                                                                                                                                                                                                                                                                                              | L'ordre des pointages à venir est inconnu.                                                                                                                                                                                                                                            |
| **Rien à venir.** `monthEndProjection: null` quand aucun mouvement n'a de reste (CA6, CA7), quand le mois n'a pas de budget, sans taux de change.                                                                                                                                                                                                                                                                                                                                                              | Condition du contrat, pas « projection égale à la valeur » (voir questions).                                                                                                                                                                                                          |
| **Où elle voyage.** Champ `monthEndProjection: { month, year, value } \| null` à la racine de la réponse de `GET /v1/assets/:id/history`, calculé à chaque page. Pas dans `assetSchema`, donc pas dans `GET /v1/assets`.                                                                                                                                                                                                                                                                                       | Seul le détail l'affiche : la liste ne paie aucune lecture de plus et les apps installées ne voient rien changer. Chaque page porte la même projection : une page suivante ne vide pas l'en-tête.                                                                                     |
| **Lecture.** Nouvelle méthode du port `findMonthMovements(assetId, month, year)` : id du budget par `month`/`year`/`user_id` (comme `fetchBudgetIdByPeriod`, `supabase-budget.repository.ts:1042-1053`), puis en parallèle les prévisions `budget_id = … AND (account_id = X OR asset_id = X)` et les mouvements `budget_id = …` liés à ces prévisions ou libres avec `account_id = X`, paginés par `fetchAllPages`, déchiffrés en strict comme `findMovementsSince` (`supabase-asset.repository.ts:212-215`). | Pas de migration, pas de cache (le module budget met ses détails en cache 30 s : CA2 exige que la valeur et la projection viennent du même instant).                                                                                                                                  |
| **Affichage.** Le détail seulement, sous la valeur, au-dessus de la dernière saisie : « Fin novembre : 8 000 », même format et même masquage que la valeur. Pas sur la ligne de « Mon patrimoine ».                                                                                                                                                                                                                                                                                                            | Le contrat ne parle que du détail (CA1).                                                                                                                                                                                                                                              |
| **Mois affiché.** Le mois du budget, dans la langue de l'interface, en minuscules dans la phrase selon la langue (« novembre », « November »), sans l'année.                                                                                                                                                                                                                                                                                                                                                   | Le budget en cours est toujours celui de l'année qu'on lit.                                                                                                                                                                                                                           |

### Exemples chiffrés (jeu d'essai du contrat)

- CA1 : 3 800 − 1 500 − 300 + 6 000 = **8 000**.
- CA2 : Loyer pointé : valeur 2 300, reste du Loyer 0, 2 300 − 300 + 6 000 = **8 000**.
- CA3 : Assurance à 400 : 3 800 − 1 500 − 400 + 6 000 = **7 900**, valeur 3 800.
- CA5 : saisie 3 800, Courses prévue 400 non pointée, 450 de réels dont 100 pointés après la saisie : valeur 3 700, reste `max(400, 450) − 100 = 350`, projection **3 350** (= 3 800 − 450).
- CA6 : tout pointé : `null`. Prévision 400 pointée, réel 450 non pointé : compte aujourd'hui `max(400, 0) = 400`, à la fin 450, reste **50**.
- CA9 / CA7 : Pharmacie 40 seule, libre, non pointée : 3 800 − 40 = **3 760**, affichée. Rien du tout : `null`.
- CA10 : saisie 4 900 après 100 pointés sur Courses : valeur 4 900, reste 350, **4 550**.
- Dette : Carte de crédit 200 dû, Dépense « Remboursement » 300 liée par `asset_id` (−300) et Dépense « Restaurant » 80 avec la carte pour compte (+80), non pointées : `max(0, 200 − 300 + 80)` = **0**. Restaurant seul : **280**.
- Deux liens : Épargne 500 non pointée, compte Compte courant, versée sur Livret 10 000 : Compte courant **3 300**, Livret **10 500**.
- Devise : compte en EUR à 1 000, 1 EUR = 0,95 CHF, Dépense 95 CHF à venir : 1 000 − 100 = **900 EUR**.

## Phase 1 — Serveur : projection dans l'historique

Commit : `feat(patrimoine): projeter la valeur d'un compte à la fin du mois (serveur)`

- `asset.entity.ts` : `MonthLine { kind, amount, checkedAt, accountId, assetId, reals: { amount, checkedAt: string | null }[] }`, `MonthFreeMovement { kind, amount, accountId, checkedAt: string | null }`, `MonthMovements`, `MonthEndProjection { month, year, value }` ; `AssetHistoryPage.monthEndProjection: MonthEndProjection | null`.
- `asset.formulas.ts` : `linkSign(asset, line)` extrait de `retainedMoves` ; `monthEndValue(asset: NetWorthAsset, movements: MonthMovements, rate: number | undefined): number | null` (archivé, sans taux, ou aucun reste → `null`).
- Port + repository : `findMonthMovements(assetId, month, year)` ; budget absent → listes vides.
- `get-asset-history.use-case.ts` : période calculée comme `get-current-month.tool.ts:40-43`, lecture ajoutée au `Promise.all` de la ligne 69 (aucune lecture en série de plus), `monthEndProjection` ajouté à la page.
- `shared/schemas.ts` : `assetMonthEndProjectionSchema` (`month` 1–12, `year`, `value`) et `assetHistorySchema.monthEndProjection: … .nullable().optional()` avec JSDoc (jamais dans les totaux, `null` quand rien n'est à venir). Spec du schéma.
- `asset.mapper.ts` `toAssetHistoryApi` ; DTO swagger.
- `docs/BUSINESS_RULES.md` § Patrimoine : une puce, la formule et l'exemple CA10.

Tests :

- `asset.formulas.spec.ts`, un test par exemple ci-dessus : CA1, CA2, CA3, CA5, CA6 (deux cas), CA7, CA9, CA10, dette (0 et 280), deux liens, EUR, sans taux `null`, archivé `null`. Invariant CA2 : partant du jeu CA1, une fois tout pointé, la valeur vaut la projection d'avant (8 000).
- `get-asset-history.use-case.spec.ts` : 12 novembre, jour de paie absent → lecture de novembre 2026 ; jour de paie 27, le 28 novembre → décembre (temps figé). CA4 : la lecture reçoit novembre, « Impôts » de décembre n'y est pas. CA8 : `asset` et `entries` identiques avec et sans mouvements du mois.
- `supabase-asset.repository.spec.ts` : réels regroupés sous leur prévision (pointés et non pointés), mouvement d'une autre prévision écarté, libre d'un autre compte écarté, budget absent → vide, montant indéchiffrable → erreur.
- `asset-history.http.spec.ts` : réponse parsée par `assetHistoryResponseSchema` avec une projection et avec `null`. `get-net-worth.use-case.spec.ts` inchangé (CA8 côté liste).
- Vérification locale : jeu d'essai posé par SQL sur la base partagée (pas de reset), `curl` de l'historique du Compte courant → `monthEndProjection.value` 8 000, puis Loyer pointé → valeur 2 300, projection 8 000.

## Phase 2 — Web

Commit : `feat(patrimoine): afficher la fin de mois d'un compte dans son détail (web)`

- Page de détail de PUL-379 (`feature/net-worth/detail/asset-detail-page.ts`) : ligne sous la valeur quand `monthEndProjection` n'est pas `null`, mois par `Intl.DateTimeFormat(locale, { month: 'long' })` (comme `dashboard-hero.ts:620`), montant par le formateur et le masquage de la valeur, `aria-label` = libellé d'accessibilité.
- Le store de l'historique expose la projection de la dernière page chargée.
- Catalogues `fr/en/de/it.json` : clés de la section Textes.

Tests : spec de page (CA1 « Fin novembre : 8 000 », `null` → aucune ligne, montants masqués, libellé d'accessibilité) ; e2e du détail avec une projection dans la réponse simulée. Visuel : 375 et 1280 px, clair et sombre.

## Phase 3 — iOS

Commit : `feat(patrimoine): afficher la fin de mois d'un compte dans son détail (iOS)`

- `AssetHistory` décode `monthEndProjection` optionnel (absent ou `null` → `nil`) ; `AssetHistoryModel` le garde à chaque chargement.
- `AssetDetailView.summary` : `Text` entre la valeur et `lastEntryCaption()`, même police que la légende, `.sensitiveAmount()` ; mois par `Formatters.monthNameInText(for:)` (`Formatters.swift:159`), montant par `netWorthSigned` comme la valeur. Libellé et libellé VoiceOver composés par une fonction pure.
- `Localizable.xcstrings` : clés françaises de la section Textes, en/de/it.

Tests : décodage (champ présent, `null`, absent) ; libellé fr/en/de/it ; libellé VoiceOver avec et sans montants masqués. Visuel : FR clair, sombre, AX5 (la ligne passe à la ligne sans tronquer). Build et tests avec `-derivedDataPath` explicite sur le simulateur de test dédié.

## Phase 4 — Android

Commit : `feat(patrimoine): afficher la fin de mois d'un compte dans son détail (Android)`

- `(net-worth)/asset/[id].tsx` (PUL-379 phase 6) : même ligne, mois par `formatMonthName` (`android/src/core/ui/date-format.ts:30`), montant et masquage de la valeur, `accessibilityLabel`.
- `android/src/core/i18n/catalogs/{fr,en,de,it}.json`.

Tests : spec de l'écran (CA1, `null`, masqué, libellé) et des catalogues. Visuel : police 1.0 et 1.3, clair et sombre.

## Textes

| Clé                                     | fr                                                                    | en                                                                         | de                                                                                 | it                                                                                |
| --------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `netWorth.detail.monthEnd`              | Fin {{month}} : {{amount}}                                            | End of {{month}}: {{amount}}                                               | Ende {{month}}: {{amount}}                                                         | Fine {{month}}: {{amount}}                                                        |
| `netWorth.detail.monthEndAccessibility` | Fin {{month}} : {{amount}}, si tout ce que tu as prévu ce mois arrive | End of {{month}}: {{amount}}, if everything you planned this month happens | Ende {{month}}: {{amount}}, wenn alles eintrifft, was du diesen Monat geplant hast | Fine {{month}}: {{amount}}, se tutto ciò che hai previsto questo mese si realizza |

Espace insécable avant « : » en français. `{{month}}` est le nom du mois dans sa casse de phrase. Montants masqués : le libellé d'accessibilité suit ce que fait déjà la valeur sur chaque plateforme.

## API

`GET /v1/assets/:id/history` : la réponse gagne `monthEndProjection`.

```json
{
  "asset": { "...": "inchangé" },
  "monthEndProjection": { "month": 11, "year": 2026, "value": 8000 },
  "entries": [],
  "nextCursor": null
}
```

`value` est dans la devise de l'élément, `month`/`year` sont ceux du budget en cours selon le jour de paie. `null` quand rien n'est à venir, quand le mois n'a pas de budget ou sans taux de change. Jamais additionnée dans `latestValue`, les totaux ou les entrées. `GET /v1/assets` ne change pas.

## Risques

- Extraction de `linkSign` : aucun chiffre de `GET /v1/assets` ni de l'historique ne doit bouger (specs existantes inchangées).
- Fuseau : le serveur prend la date de Zurich. Autour du jour de paie, quelques heures d'écart possibles avec le mois que l'app affiche sur un appareil dans un autre fuseau. Accepté, comme `get_current_month`.
- Coût : deux allers-retours de plus par page d'historique, en parallèle des lectures existantes ; volume borné à un mois et un compte.
- Déploiement : champ facultatif dans le schéma, un web déployé avant le serveur n'échoue pas.
- Base locale partagée : jeu d'essai posé par SQL, pas de reset.
