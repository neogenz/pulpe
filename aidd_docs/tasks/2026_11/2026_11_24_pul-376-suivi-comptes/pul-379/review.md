# PUL-379 : revue indépendante

Périmètre : `git diff 496668322..HEAD` (hors `aidd_docs/**/shots`), branche `feat/pul-379-detail-historique`, tip `3e23bcd63`.

## Verdict : prêt avec correctifs

Aucun défaut bloquant. Le calcul serveur tient (valeur et historique sortent de la même fonction, l'invariant est vérifié, la pagination keyset est cohérente avec le tri). Restent une divergence visible entre plateformes, un flash d'état sur Android après archivage depuis le détail, et deux écarts mineurs de format.

## Constats, du plus grave au moins grave

### 1. iOS ajoute « Pointé le » devant la date d'un mouvement, le web et Android non (moyen, confirmé)

- `ios/Pulpe/Features/NetWorth/AssetHistoryRow.swift:36` : `date = AppLocale.string("Pointé le \(day(entry.at))", …)`.
- Web `frontend/.../detail/asset-detail-page.ts:329` et Android `android/src/features/net-worth/components/asset-history-row.tsx:32` affichent la date seule.
- Impact : avec le jeu d'essai, la même ligne se lit « Salaire / Pointé le 10 novembre / +6’000.00 CHF » sur iOS et « Salaire / 10 novembre / +6’000.00 CHF » ailleurs. VoiceOver lit « Salaire, Pointé le 10 novembre, +6’000.00 CHF » quand TalkBack lit « Salaire, 10 novembre, +6’000.00 CHF ». La parité des textes et des libellés accessibles fait partie de la story.
- Correctif le plus petit : choisir une forme. Côté iOS, `date = day(entry.at)` et mettre à jour `ios/PulpeTests/Features/NetWorth/AssetHistoryModelTests.swift:195,217,225`. Sinon ajouter la clé « Pointé le {{date}} » sur web et Android, dans les 4 catalogues.

### 2. Android : archiver ou supprimer depuis « Modifier » affiche « Cet élément n'est plus disponible » avant le retour (faible à moyen, plausible : chemin confirmé dans le code de la librairie, pas reproduit sur appareil)

- `android/src/app/(main)/(tabs)/(net-worth)/asset/[id].tsx:79-85` : `router.back()` est dans le `onSuccess` passé à `mutate`.
- `useNetWorthMutation` (`android/src/features/net-worth/net-worth-queries.ts:78`) a un `onSettled` au niveau du hook qui renvoie `invalidateQueries({ queryKey: netWorthKeys.all })`. Cette invalidation couvre aussi `["net-worth","history",id]`, qui est actif. TanStack 5.102.8 attend ce `onSettled` (`query-core/build/modern/mutation.js:108-110`) avant d'appeler les callbacks de `mutate` (`mutationObserver.js:86`). Pendant ce temps, l'historique est relu, le serveur répond 404, `isNotFound` passe à vrai et l'écran « introuvable » s'affiche jusqu'à la fin de la relecture de `GET /v1/assets`, puis l'écran revient en arrière.
- Impact : après l'action de l'utilisateur, l'écran indique brièvement que l'élément « n'est plus disponible ». Une requête 404 inutile part aussi. Q29 n'a aucun test : `asset-detail-screen.spec.tsx` ne couvre pas archiver ou supprimer depuis le détail.
- Correctif le plus petit : `const isRemoving = updateAsset.isPending || deleteAsset.isPending;`, puis ne montrer l'écran introuvable que si `isNotFound && !isRemoving`, et ajouter un test pour chacun des deux cas.

### 3. La légende « Déjà compris dans ta saisie du … » affirme ce que la règle métier dit pouvoir être faux (faible, décision produit à reconfirmer)

- Web `fr.json` `netWorth.detail.superseded`, Android et iOS ont la même phrase (Q24, Q25).
- La règle du contrat dit : « la saisie qui les suit fait foi, qu'elle les comprenne ou non (une saisie créée à la mise en service de PUL-377 pour une proposition écartée ne les comprend pas) ». CA6 demande qu'on lise que le mouvement « n'entre plus dans la valeur ». Pour ces saisies, qui existent en base, la légende dit au contraire que la saisie contient le mouvement.
- Correctif le plus petit : une phrase qui ne prétend pas que la saisie contient le mouvement, par exemple celle du plan, « Avant ta saisie du {{date}}, qui fait foi », dans les 3 plateformes et les 4 langues. Si la décision Q24 est maintenue en connaissance de cause, rien à changer.

### 4. Italien, le 1er du mois : le web écrit « 1 novembre », iOS et Android « 1º novembre » (faible, confirmé)

- `frontend/.../net-worth/components/entry-date.ts:8,18` ne traite que le français. Android (`android/src/core/ui/date-format.ts:106-109`) et iOS (`Formatters.swift:275`) ajoutent `1º` en italien (Q28).
- Impact : avec le jeu d'essai en italien, la saisie du 1er novembre ne porte pas la même date sur le web que sur mobile. La légende « Già compreso nel tuo inserimento del 1 novembre » est concernée aussi.
- Correctif le plus petit : une table `{ fr: '1er', it: '1º' }` dans `formatEntryDate`, avec un cas `it` dans `entry-date.spec.ts`.

### 5. Web : la valeur négative de l'en-tête prend un trait d'union, les entrées et les mobiles le signe U+2212 (faible, confirmé, motif déjà présent sur la ligne web)

- `asset-detail-page.ts:139` : `a.latestValue | appCurrency` produit « -150.00 CHF » via `formatNumber`. Les entrées de la même page passent par `#signed` (U+2212), comme l'en-tête iOS (`netWorthSigned`) et Android (`−${formatAmount}`).
- Impact : pour un compte à découvert, l'en-tête et les lignes du même écran n'ont pas le même signe. La ligne de « Mon patrimoine » sur le web a déjà ce comportement : le détail le reprend sans le créer.
- Correctif le plus petit : `{{ signedValue() }}` calculé avec `#signed(a.latestValue, a.currency, false)`.

## Vérifié sans constat

- **Calcul serveur** (`asset.formulas.ts`) : `assetValueCents` réécrit sur `retainedMoves` donne la même valeur, et les attentes existantes de `asset.formulas.spec.ts` et `get-net-worth.use-case.spec.ts` sont inchangées (seuls les fixtures gagnent `id` et `name`). J'ai lancé une sonde hors dépôt : une dette en EUR avec un taux de 0.9137, deux saisies, un mouvement pointé à l'instant exact d'une saisie, une Prévision présente dans deux périodes, deux mouvements libres au même instant et un plancher atteint deux fois. La somme des effets non dépassés est égale à `value − recordedValue` au centime, et le mouvement placé à l'instant de la saisie passe sous elle, marqué « dépassé ».
- **Pagination** : le tri (instant décroissant, saisie avant mouvement, id croissant) et la recherche du curseur dans `pageOf` utilisent la même clé. Aucun triplet (instant, rang, id) ne se répète, puisqu'une Prévision présente dans deux périodes a deux instants différents. Il n'y a donc ni doublon ni trou sur une liste stable. Le web ignore une page en retard après une relecture (`asset-history-store.ts:89`), iOS fait de même avec `generation`, et Android relit les pages dans l'ordre (TanStack v5).
- **Sécurité** : la fonction s'exécute avec les droits de l'appelant et un `search_path` vide, elle est fermée à `anon`, et ses trois branches dépendent de `own_budget` ou de la RLS. Un élément d'un autre utilisateur, archivé ou inconnu donne 404 : il n'est pas trouvé dans `findAllWithLatestValue` sous RLS. Aucun montant n'apparaît dans les logs (le `warn` ne porte que la devise) ni dans les événements analytics. Les noms d'écran sont statiques : `NetWorthAssetDetail` sur iOS, et les segments de fichier `[id]` sur Android, sans identifiant. `ph-no-capture` couvre le nom, le type, la valeur, la dernière saisie, les libellés et les montants. Sur iOS, `sensitiveAmount()` couvre la valeur, la légende de saisie et les montants, et Android masque via `formatCurrency`.
- **Invalidation** : sur le web, une écriture budgétaire invalide `['assets']` (`asset-api.ts:58`), ce qui couvre `['assets','history',id]`, et la sauvegarde depuis le détail passe par `NetWorthStore`. Sur iOS, `.task` relit à chaque apparition et `editDismissed` relit aussi. Sur Android, `invalidateAfterBudgetWrite` marque `["net-worth"]` périmé et `useFocusEffect` relit.
- **Déploiement et compatibilité** : `node .github/scripts/check-migration-contract.cjs 496668322 HEAD` répond « Migration contract valid », et v0.66.2 est bien un ancêtre. Les migrations sont appliquées avant le fast-forward de `production`. L'ancienne `list_asset_movements` reste en place pour un backend PUL-378 déjà déployé. L'API ne fait qu'ajouter : iOS 1.14 et les builds Android installés ne changent pas.
- **Textes** : fr/en/de/it identiques entre le web, Android et iOS pour « Valeur enregistrée », la légende, « rien pointé depuis » et « introuvable ». La seule différence voulue est le retour Android « Back to My assets » (Q26).

## Preuves exécutées (au tip `3e23bcd63`)

- `bun test asset.formulas.spec.ts get-asset-history.use-case.spec.ts asset-history.http.spec.ts` : 94 réussis, 0 échec.
- `ng test --include "**/feature/net-worth/**/*.spec.ts" --include "**/core/asset/*.spec.ts"` : 15 fichiers, 144 réussis.
- `jest src/features/net-worth src/core/navigation` : 20 suites, 146 réussis.

## Non vérifié

Tests SQL `asset_history_movements.sql` (base locale partagée non migrée sur cette branche), tests iOS (exclus par consigne), typage strict des templates Angular (`ng build`), e2e Playwright, rendu sur appareil (Dynamic Type, taille de police Android).
