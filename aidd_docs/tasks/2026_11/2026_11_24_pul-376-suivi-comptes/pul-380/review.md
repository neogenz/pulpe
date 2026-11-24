# PUL-380 : revue indépendante

Diff : `git diff f608d037b..HEAD` (hors `shots/`), branche `feat/pul-380-projection-fin-de-mois`, tip `c1a7e6579`.

## Verdict

**Ready.** Aucun défaut bloquant trouvé. Trois suggestions mineures, aucune n'est une condition de merge.

## Ce qui a été vérifié (et tenu)

- **Règle du contrat.** `monthEndValue` (`asset.formulas.ts:299`) = valeur à jour + Σ (fin `max(montant, tous les réels)` − `countedCents(line, ∞)`) par prévision, + montant des libres non pointés. Sonde ad hoc sur la fonction réelle : CA1 8000, CA5 3450 (3800 − 350), CA6 3750 (reste 50), CA10 4550, Revenu 300 + Dépense 300 → 3800 (affichée), Épargne 500 liée par `asset_id` au Livret → 10500, dette 200 avec remboursement 300 + Restaurant 80 → 0, EUR au taux 0.95 → 894.74, archivé → `null`, tout pointé → `null`. Un réel d'une autre nature sous une prévision compte en magnitude, comme la valeur (décision n° 6).
- **Double lien sur le même élément.** Impossible : contrainte `budget_line_account_not_asset CHECK (account_id <> asset_id)` (`20261125120000_link_movement_to_account.sql:30`).
- **Extraction de `linkSign`.** Équivalente à l'ancien code : `FreeMovement` n'a pas d'`assetId`, donc un libre ne bouge que son compte, comme avant. 165 tests `src/modules/asset` verts (`bun test src/modules/asset`).
- **Filtre `.or(...)`.** Pas d'injection possible : `ParseUUIDPipe` sur la route (`asset.controller.ts:122`), et `findMonthMovements` n'est appelé qu'après avoir trouvé l'élément actif de l'utilisateur. Un seul appelant du port. `transaction` n'a pas de colonne `asset_id` : lire les libres par `account_id` seul suit `list_asset_movements_for`.
- **Requêtes PostgREST.** Les deux `select` exacts exécutés contre la base locale : embarquement `transaction(amount, checked_at)` non ambigu, `monthly_budget!inner` + `.or()` filtrent bien la racine. Scope utilisateur : client RLS + `monthly_budget.user_id = user`. Déchiffrement strict comme `findMovementsSince`. DEK en cache (déjà chauffée par `findAllWithLatestValue`). Lectures bornées à un mois, sans N+1.
- **Mois.** Même calcul que l'outil MCP `get_current_month` (`getBudgetPeriodForDate(parseIsoDateLocal(formatBusinessCalendarDate()), user.payDayOfMonth)`), indépendant du fuseau du serveur. Jour de paie 27, 28 novembre → décembre testé.
- **CA8.** La projection ne passe que par `toAssetHistoryApi` ; `GET /v1/assets`, la fortune nette et les entrées sont intacts.
- **Compatibilité.** Champ `.nullable().optional()` ; iOS décode un `var` optionnel (absent → `nil`) ; Zod enlève la clé inconnue côté apps installées.
- **Fraîcheur après écriture (CA3, CA9).** Web : toute écriture budget invalide `['assets']` (`asset-api.ts:58`). Android : `invalidateAfterBudgetWrite` marque `netWorthKeys.all`. iOS : `.task` relance à l'apparition, et `load()` prend la projection avant l'early-return quand la première page n'a pas changé (test dédié).
- **Textes.** Même ligne et même phrase lue sur les trois plateformes, fr/en/de/it, mois en casse de phrase via le formateur de chaque plateforme, `−` typographique et 2 décimales partagés avec la valeur. Masquage : chaque plateforme suit sa valeur (web flou, iOS `.sensitiveAmount()`, Android `formatCurrency` masqué).
- Tests lancés : web `asset-*.spec.ts` 37/37, Android `asset-detail-screen.spec.tsx` 26/26, backend asset 165/165. iOS non lancé (consigne).

## Suggestions (non bloquantes)

1. **Web : la ligne est plus appuyée que sur iOS et Android** (confirmé, visuel). `asset-detail-page.ts:142` : `text-body-large` couleur par défaut, alors qu'iOS (`captionRegular`, `textSecondary`) et Android (`bodyMedium`, `hero.support`) la rendent comme la légende « Ta dernière saisie ». Sur `shots/web-compte-courant-mobile-light.png`, « Fin novembre » prend plus de poids que la légende du dessous ; sur `ios-detail-projection-light.png` elles sont au même niveau. Impact : une info conditionnelle concurrence la valeur sur le web seul. Plus petit correctif : `text-body-medium text-on-surface-variant`, comme `asset-detail-last-entry` (`:150`). Si l'emphase web est voulue, l'écrire dans `questions.md`.

2. **Projection de « la dernière page » sur web et Android, de la première page sur iOS** (confirmé, maintenabilité). Web `asset-history-store.ts` (`monthEndProjection` + champ dans `LaterPages`) et Android `[id].tsx:74` lisent la dernière page chargée, iOS ignore celle de `loadMore`. Aucun écart visible : la projection ne bouge pas au pointage (CA2), et toute écriture locale recharge la première page, ce qui vide les suivantes. Coût : deux règles pour une même donnée, et deux lectures serveur par page suivante que personne n'utilise vraiment. Plus petit correctif : lire `firstPage.value()?.monthEndProjection` comme `asset` (web) et `pages[0]` (Android), et retirer le champ de `LaterPages` et son test. Le serveur peut continuer à l'envoyer sur chaque page.

3. **Garde `archivedAt` morte dans `monthEndValue`** (confirmé, nit). `asset.formulas.ts:304` : le seul appelant répond 404 sur un élément archivé avant d'appeler la fonction. Inoffensif, et cohérent avec `assetValueCents` (`:276`) ; à garder seulement si on tient à une fonction de domaine autonome.

## Hors diff

Rien de préexistant relevé qui touche cette story.
