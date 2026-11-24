# PUL-378 : questions tranchées pendant l'implémentation

Choix prudents pris là où le plan ne tranchait pas. À relire.

## Phase 1

1. **Mouvement réel rattaché qui porterait quand même un `account_id`.** Aucune contrainte de base ne l'interdit : le trigger de suppression d'une prévision écrit le compte sur des mouvements encore rattachés, juste avant que la clé étrangère les détache, donc une contrainte `budget_line_id IS NULL OR account_id IS NULL` casserait CA46. Choix : `list_asset_movements` ne renvoie jamais le compte d'un mouvement rattaché et la formule ne lit que celui de la prévision. La phase 2 force `null` à l'écriture.
2. **Deux mouvements pointés au même instant sur une dette.** L'ordre de pointage décide du plancher à zéro ; à égalité d'horodatage, les prévisions passent avant les mouvements libres, dans l'ordre de lecture. Cas improbable (même milliseconde), pas de clé de départage ajoutée.
3. **Précision des instants.** La formule compare les dates à la milliseconde (`Date.parse`), la base à la microseconde. Un mouvement pointé dans la même milliseconde qu'une saisie, mais après elle, est considéré comme déjà inclus dans la saisie. Même limite qu'en PUL-377.
4. **Lecture paginée.** `list_asset_movements` est lue page par page (`max_rows` de PostgREST à 1 000), chaque page dans sa propre requête. Une écriture entre deux pages peut décaler la lecture d'un appel ; la page suivante de `GET /v1/assets` la corrige. Une seule page dans l'immense majorité des cas.
5. **« Migration appliquée deux fois ».** Interprété comme : appliquée dans une transaction annulée, puis appliquée pour de bon sur la base locale (psql, version inscrite dans `supabase_migrations.schema_migrations`). Pas de `supabase:reset`, la base locale étant partagée entre worktrees.
6. **Montants dans la devise de base.** Comme en PUL-377, les montants des prévisions et des mouvements sont tenus pour exprimés dans la devise de base de l'utilisateur, celle des totaux. Un budget dans une autre devise que le réglage courant n'est pas reconverti.

## Phases 2 et 3

1. **`accountId` optionnel dans les réponses, sans `default(null)`.** `default(null)` rend le champ obligatoire dans le type inféré et casserait des dizaines de fixtures web et Android pour rien. Absent d'une réponse = aucun compte, comme le ferait un backend plus ancien. Le backend, lui, renvoie toujours `accountId` (nul ou non).
2. **Compte envoyé sur un mouvement rattaché à une prévision.** Ignoré, pas de 400 : le mouvement suit le compte de sa prévision (CA4). Un ancien client qui renverrait le champ n'est pas puni. Vaut aussi pour le PATCH d'un retrait d'objectif rattaché.
3. **Refus du compte.** Un compte d'un autre utilisateur donne un 404 (`Account access denied` du trigger), un compte égal à l'avoir lié donne un 400 avec la règle (contrainte `*_account_not_asset`). Le mapping est appliqué partout où `throwIfAssetLinkRefused` l'était déjà, plus l'insertion, la mise à jour et les retraits de mouvements.
4. **CA25 tenu par la seule contrainte de base.** Pas de raffinement Zod partagé : `budgetLineUpdateSchema` dérive de la base par `omit`, et un PATCH qui n'envoie qu'un des deux champs ne peut être jugé qu'avec la ligne en base. La base renvoie le 400.
5. **Changement de nature.** Passer une prévision de dépense à revenu garde son compte : le compte n'a pas de sens imposé, contrairement au lien vers un avoir ou une dette.
6. **`update_template_line_with_tags`.** Réécrite dans la migration de la phase 3 avec les autres RPC de modèle, pour qu'un PATCH de ligne de modèle avec tags garde ou écrive le compte.
7. **Mouvements listés à la suppression d'un objectif.** La RPC de suppression ne projette pas le compte ; le type renvoyé l'exclut plutôt que d'inventer un `null`.

## Phase 4

1. **Vérifier l'élément avant d'écrire le réglage.** `PUT /v1/users/settings` lit l'élément (actif, à l'utilisateur) puis fait l'upsert : deux requêtes, pas une transaction. Si l'élément est archivé entre les deux, le réglage pointe un élément archivé jusqu'au prochain archivage ou choix ; s'il est supprimé entre les deux, la clé étrangère refuse l'écriture (erreur 500 générique). Fenêtre de quelques millisecondes sur un geste manuel, pas de RPC ajoutée.
2. **`defaultAccountId` avec `locale` dans le même `PUT`.** Accepté : la règle « la langue se met à jour seule » ne vise que les réglages encore dans `user_metadata`.
3. **Revenu libre tiré d'un objectif d'épargne.** Il reçoit le compte par défaut s'il n'en envoie pas : l'argent sorti du pot arrive sur un compte, le défaut est le plus probable. Le couple « Remettre sur ton épargne » (`create-savings-withdrawal`) ne lit jamais le défaut.
4. **CA45 seulement sur les prévisions.** Un mouvement réel n'a pas d'`asset_id`, donc rien à comparer ; le lissage additif applique la même règle que la prévision.
5. **Prévision créée par `POST /v1/budget-lines` avec un `templateLineId`.** Aucun client ne l'envoie à la création ; si un client le faisait sans compte, il recevrait le défaut. CA31 reste tenu par les RPC du modèle, qui ne lisent jamais le réglage.
6. **`defaultAccountId` optionnel dans la réponse, sans `default(null)`.** Écart au plan, même raison que `accountId` en phases 2 et 3 : `default(null)` rend le champ obligatoire dans le type inféré et casse 12 fixtures des specs web, hors périmètre de cette phase. Absent = aucun compte par défaut (backend ancien) ; le backend, lui, renvoie toujours le champ. La phase 6 peut le resserrer en touchant ses fixtures.
