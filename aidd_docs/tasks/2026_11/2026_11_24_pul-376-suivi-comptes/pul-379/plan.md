---
objective: "Toucher un élément actif de « Mon patrimoine » ouvre son détail : nom, type, valeur à jour, dernière saisie, et tout son historique paginé (saisies et mouvements pointés, effet signé). Le serveur calcule l'historique et la valeur avec la même fonction. Web, iOS et Android, avec la même parité."
status: pending
---

# Plan: PUL-379, ouvrir le détail d'un élément et revoir tout son historique

Source: Linear PUL-379 ([contract.md](./contract.md)), epic PUL-376 ([../epic.md](../epic.md)), après PUL-378 ([../pul-378/plan.md](../pul-378/plan.md)). Branche empilée sur `feat/pul-378-compte-par-mouvement`.

## Phases

| #   | Phase                                                                     | Depends on |
| --- | ------------------------------------------------------------------------- | ---------- |
| 1   | Serveur : un seul calcul pour la valeur et l'historique                   | none       |
| 2   | Serveur : `GET /v1/assets/:id/history` paginé                             | 1          |
| 3   | Web : route `/net-worth/:id` et écran de détail                           | 2          |
| 4   | iOS : écran de détail poussé dans l'onglet Patrimoine                     | 2          |
| 5   | Android : l'onglet Patrimoine devient une pile (aucun changement visible) | none       |
| 6   | Android : écran de détail, parité iOS                                     | 2, 5       |

## Impact

| Category      | Verdict and evidence                                                                                                                                                                                                                                                                      | Handled in |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| runtime       | Une migration contract `safe-after v0.66.2` (REVOKE, interdit en expand) qui ajoute une fonction SQL, sans rien modifier ni supprimer. v0.66.2 n'appelle aucune fonction `list_asset_movements*`. Un backend PUL-378 déjà déployé continue d'appeler `list_asset_movements(timestamptz)`, gardée intacte. | 1          |
| regression    | `computeNetWorth` est refactoré pour sortir les effets événement par événement. `GET /v1/assets` doit rendre exactement les mêmes chiffres : tout `asset.formulas.spec.ts` existant reste vert sans toucher une valeur attendue.                                                             | 1          |
| regression    | Toucher une ligne ouvre désormais le détail, plus « Modifier » (web, iOS, Android). Les specs et l'e2e qui cliquent la ligne pour modifier passent par le menu ou le détail.                                                                                                                  | 3, 4, 6    |
| regression    | Android : `net-worth.tsx` déménage dans `(net-worth)/`. Redirection flag éteint, nom d'écran analytics et icône de la barre identiques.                                                                                                                                                       | 5          |
| architecture  | Aucune formule client : le détail affiche ce que le serveur rend. Le miroir de formules n'est pas déclenché.                                                                                                                                                                                  | 1–6        |
| api           | Endpoint ajouté, aucun champ retiré ni resserré.                                                                                                                                                                                                                                              | 2          |
| documentation | `docs/BUSINESS_RULES.md` § Patrimoine (historique) ; `backend-nest/supabase/tests/README.md`.                                                                                                                                                                                                 | 1, 2       |

## Decisions

| Decision | Why |
| -------- | --- |
| Nouvelle fonction SQL invoker `list_asset_movements_for(p_since, p_asset_id DEFAULT NULL)`, même sélection que `list_asset_movements`, plus `name` et un filtre facultatif par élément. `GET /v1/assets` et l'historique la lisent tous les deux. | Une seule sélection en service : valeur et historique ne divergent pas. Migrations publiées immuables ; changer le type de retour imposerait un `DROP`. L'ancienne fonction reste, à retirer plus tard. |
| `assetValueCents` est découpé en `retainedMoves(...)`, qui rend l'effet retenu de chaque événement (dette bornée à 0 à chaque pas). Valeur = saisie + somme des effets de la période ouverte. Historique = la même fonction sur chaque période entre deux saisies. | CA5 et CA19 tenus par construction, plus un test d'invariant. |
| Pagination en mémoire après calcul de tout l'historique de l'élément, curseur keyset opaque `(instant, rang, id)`. | Le plancher d'une dette dépend de tout ce qui précède dans la période. Volume borné à un élément ; commentaire `shortcut:`. |
| La réponse porte l'élément calculé (`asset`, même schéma que `GET /v1/assets`) à côté des entrées. | En-tête et historique viennent d'un même état (CA2, CA5). |
| Web : page routée `/net-worth/:id` (précédent : `savings-goals/:id`). | CA16 (adresse, Précédent) ; sur téléphone la page prend toute la zone (CA17). |
| Le détail ne pointe rien. CA8 se fait dans le budget ; le détail se relit au retour (cache `assets` sur le web, relecture à l'apparition sur iOS et Android). | Ouvrir un mouvement depuis l'historique est hors périmètre. |
| Archivé ou inconnu : 404 `ERR_ASSET_NOT_FOUND`. Les lignes archivées ne sont pas pressables. | CA15, y compris par l'adresse web. |

## Phase 1 — Serveur : un seul calcul pour la valeur et l'historique

Commit : `feat(patrimoine): calculer l'historique d'un élément avec la règle de sa valeur (serveur)`

- `backend-nest/supabase/migrations/20261126120000_list_asset_movements_for.sql` : contract, `safe-after v0.66.2`. Corps de `list_asset_movements` (`20261125120000_link_movement_to_account.sql`) plus colonne `name`, `linked_line` filtrée par élément quand `p_asset_id` est donné, lignes `free` filtrées par `t.account_id = p_asset_id`. `REVOKE ALL … FROM PUBLIC, anon; GRANT EXECUTE … TO authenticated`.
- `database.types.ts` (`generate-types:local`, sans reset : base partagée).
- `asset.entity.ts` : `MovementLine.name`, `FreeMovement.id/name`, `AssetSnapshot`, `AssetHistoryEntry` (snapshot | movement avec `effect: number | null`, `supersededAt`).
- `asset.formulas.ts` : `retainedMoves`, `assetValueCents` réécrit dessus, `assetHistory(asset, snapshots, movements, rate)` (une entrée par source et par période, à l'instant de son dernier événement dans la période ; tri instant décroissant, saisie avant mouvement à instant égal).
- Port + repository : `findMovementsSince(since, assetId?)`, `findSnapshots(assetId)` (déchiffrement strict).
- `asset_history_movements.sql` + README ; `docs/BUSINESS_RULES.md`.

Tests `asset.formulas.spec.ts` (jeu d'essai du contrat) : CA3 ordre, CA4 effets +6 000/−80/−1 500/−300, CA5 somme du dessus 4 420 = 9 420 − 5 000 (+ invariant), CA6 Assurance `supersededAt`, CA7 dernière entrée 4 800, CA8 sans Restaurant 9 500, CA9 saisie 9 000 en tête, CA10 Livret seul, CA13 dette 200 : 300 → −200 puis +100, CA14 EUR, CA19 Courses −120 sous / −280 au-dessus, 9 140, +4 140. Non-régression : specs existantes inchangées.

## Phase 2 — Serveur : `GET /v1/assets/:id/history`

Commit : `feat(patrimoine): lire l'historique paginé d'un élément (serveur)`

- `shared/schemas.ts` : `assetHistoryQuerySchema`, `assetHistoryEntrySchema`, `assetHistorySchema`, `assetHistoryResponseSchema` + spec.
- `get-asset-history.use-case.ts` + spec ; `asset.controller.ts` `@Get(':id/history')` ; DTO swagger ; mapper ; module.

Tests : CA2 en-tête (9 420, 5 000, 1er nov., même valeur que `GetNetWorthUseCase`), CA11 pages de 2 avec curseur jusqu'à `nextCursor: null`, saisie ajoutée entre deux pages sans décalage, curseur invalide 400, CA15 archivé/inconnu 404, CA5 sur la réponse.

## Phase 3 — Web

Commit : `feat(patrimoine): ouvrir le détail d'un élément et son historique (web)`

Routes enfants `''` et `':id'` sous `net-worth.routes.ts` ; `AssetApi.getHistory$` (clé `['assets','history',id]`) ; `detail/asset-history-store.ts` (première page en cache, suite paginée) ; `detail/asset-detail-page.ts` (retour, en-tête, « Modifier », phrase CA10, liste, sentinelle, états) ; ligne → action `open` ; i18n 4 catalogues ; specs + e2e. CA1–CA17 selon le contrat, CA17 vérifié à 375 px.

## Phase 4 — iOS

Commit : `feat(patrimoine): ouvrir le détail d'un élément et son historique (iOS)`

`AssetHistory`/`AssetHistoryEntry` décodables ; endpoint ; `AssetService.getHistory` ; `AssetHistoryModel` ; `AssetDetailView` poussé par `NetWorthDestination.asset(id:)` ; tap de ligne → push, « Modifier » dans le menu et le détail ; libellé VoiceOver composé par une fonction pure ; xcstrings. Tests : décodage, modèle (load, loadMore, concurrence), libellés CA18.

## Phase 5 — Android : pile Patrimoine

Commit : `refactor(patrimoine): donner une pile à l'onglet Patrimoine (Android)`

`(tabs)/net-worth.tsx` → `(tabs)/(net-worth)/net-worth.tsx` + `_layout.tsx` Stack ; specs de navigation.

## Phase 6 — Android : écran de détail

Commit : `feat(patrimoine): ouvrir le détail d'un élément et son historique (Android)`

`assetHistory` endpoint ; `fetchAssetHistory` ; clé `history` sous `netWorthKeys.all` ; `useAssetHistory` (`useInfiniteQuery`) ; `(net-worth)/asset/[id].tsx` ; `asset-history-row.tsx` ; ligne → push ; catalogues ; specs. Mêmes CAs que la phase 4.

## Textes

| Clé | fr | en | de | it |
| --- | -- | -- | -- | -- |
| `netWorth.detail.back` | Retour à Mon patrimoine | Back to My net worth | Zurück zu Mein Vermögen | Torna a Il mio patrimonio |
| `netWorth.detail.history` | Historique | History | Verlauf | Cronologia |
| `netWorth.detail.recorded` | Valeur enregistrée | Recorded value | Erfasster Wert | Valore registrato |
| `netWorth.detail.superseded` | Avant ta saisie du {{date}}, qui fait foi | Before your entry on {{date}}, which takes over | Vor deiner Eingabe vom {{date}}, die massgebend ist | Prima del tuo inserimento del {{date}}, che fa fede |
| `netWorth.detail.nothingSince` | Rien n'a été pointé depuis ta saisie du {{date}}. | Nothing checked since your entry on {{date}}. | Seit deiner Eingabe vom {{date}} wurde nichts abgehakt. | Niente spuntato dal tuo inserimento del {{date}}. |
| `netWorth.detail.loadError` | Impossible de charger cet historique, réessaie | Couldn't load this history, try again | Dieser Verlauf konnte nicht geladen werden, versuche es nochmal | Impossibile caricare questa cronologia, riprova |
| `netWorth.detail.loadMoreError` | Impossible de charger la suite, réessaie | Couldn't load more, try again | Weitere Einträge konnten nicht geladen werden, versuche es nochmal | Impossibile caricare il resto, riprova |
| `netWorth.detail.notFound` | Cet élément n'est plus disponible | This item is no longer available | Dieses Element ist nicht mehr verfügbar | Questo elemento non è più disponibile |
| `netWorth.openAccessibility` | Ouvre le détail de {{name}} | Opens the details of {{name}} | Öffnet die Details von {{name}} | Apre il dettaglio di {{name}} |

Les traductions de/it du verbe « pointer » sont à relire contre les catalogues existants.

## API

`GET /v1/assets/:id/history?limit=30&cursor=<opaque>`. Query : `limit` 1–100 (30 par défaut), `cursor` opaque `<epochMs>.<rang 0=saisie|1=mouvement>.<id>`. Réponse : `{ asset, entries, nextCursor }` ; entrée `snapshot { id, at, value }` ou `movement { id, at, name, effect: number | null, supersededAt: string | null }`. Erreurs : 404 `ERR_ASSET_NOT_FOUND` (inconnu, autre utilisateur, archivé), 400 query invalide, 500 `ASSET_FETCH_FAILED`. Invariant : somme des `effect` avec `supersededAt === null` = `asset.latestValue − asset.recordedValue`.

## Risques

- Refactor de `assetValueCents` : aucun chiffre de `GET /v1/assets` ne doit bouger.
- Arrondi par événement : même chemin que la valeur, l'invariant le teste.
- Performance : tout l'historique de l'élément est déchiffré à chaque page (`shortcut:` documenté).
- Android : déplacement de route (flag, icône, analytics).
- iOS : relecture du détail en revenant sur l'onglet (CA8).
- Base locale partagée : jeu d'essai posé par SQL, pas de reset.
