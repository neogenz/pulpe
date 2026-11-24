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

## Phases 7 et 8

1. **Une seule vue pour le champ et le réglage.** `AccountPickerField` sert aux feuilles et à la ligne « Compte par défaut » des préférences (style `.row`). Elle porte sa propre carte et disparaît seule, flag éteint ou sans élément actif (CA2, CA28). Choix : la carte n'est pas posée par l'appelant, sinon une carte vide resterait à l'écran avant le premier chargement.
2. **Préremplissage au chargement des éléments.** `AssetStore` n'est chargé qu'à l'ouverture d'un sélecteur : le champ attend ce chargement puis s'aligne sur `defaultAccountId`, une seule fois par apparition. Si l'utilisateur a rebasculé « C'était prévu ? » après avoir mis « Aucun », le champ réapparaît et se préremplit. Cas rare, pas de mémoire ajoutée.
3. **CA45 sans drapeau « touché ».** Le compte remis sur « Aucun » quand on choisit le même élément en lien est celui qui égale le compte par défaut. Un compte choisi à la main qui égale le lien reste, et affiche le message (CA25), bouton bloqué. Pas de mémoire du geste de l'utilisateur.
4. **CA45 seulement à la création.** En modification, aucune remise à « Aucun » : le message et le bouton bloqué suffisent.
5. **Création toujours explicite, mouvement rattaché muet.** Une prévision, une ligne de modèle, un lissage ou un mouvement libre envoie `accountId` (`null` pour « Aucun »), y compris flag éteint (CA2). Un mouvement rattaché à une prévision n'envoie rien (CA4). `CreateTemplateView` n'envoie pas de compte : ses lignes n'ont ni objectif ni élément lié, donc pas de champ ; le serveur ne met pas de défaut sur une ligne de modèle.
6. **Modification : trois états.** Le compte n'est dans le PATCH que s'il a bougé (`assetLinkChange`), pour une prévision, une ligne de modèle et un mouvement libre (CA26). Le PATCH d'un mouvement rattaché n'en porte jamais.
7. **Compte par défaut non actif.** `UserSettingsStore.defaultAccountId` garde ce que le serveur renvoie. La lecture « seulement si actif » est dans `AssetStore.activeAssetId(_:)`, utilisée par les préférences et le préremplissage. Après un archivage ou une suppression depuis « Mon patrimoine », les réglages sont rechargés (CA35).
8. **Pas de lien hors patrimoine pour la modification d'un revenu.** Le lien « Tiré de » d'un revenu existant est figé : il compte pour le message CA25 tant que la ligne reste un revenu.
9. **Rafraîchissement après pointage.** `AssetStore` n'est pas invalidé par un pointage depuis le budget ; « Mon patrimoine » le recharge à chaque ouverture (`forceRefresh` dans `.task`). Rien ajouté : les valeurs ne s'affichent nulle part ailleurs sur iOS.

## Phases 5 et 6

1. **`defaultAccountId` du magasin non filtré par les éléments actifs.** Le plan le voulait « calculé, nul si l'élément n'est plus actif ». Le lire dans « Mon patrimoine » aurait déclenché une lecture des éléments pour tout écran qui lit les réglages, même flag éteint. Choix : valeur brute du réglage ; le serveur la remet à « Aucun » à l'archivage et à la suppression (CA35), et chaque écran qui modifie un élément recharge les réglages. Fenêtre acceptée : un autre appareil archive l'élément, ce formulaire garde l'ancien compte jusqu'au prochain chargement des réglages.
2. **Flag géré dans le sélecteur.** `AccountPickerField` lit le flag `net_worth` lui-même (comme les autres sélecteurs le font via leur hôte) : un seul endroit pour CA2. L'écran « Mon patrimoine » n'ajoute pas de test de flag : il n'est atteignable que par le menu, lui-même derrière le flag.
3. **Modification : `accountId` envoyé seulement flag allumé** (et, pour un réel libre, seulement s'il n'est pas rattaché). Flag éteint, la clé est absente et le compte est gardé (CA26).
4. **Ligne de modèle : création préremplie avec le compte par défaut, modification avec son propre compte** (CA29, CA30). Le serveur n'applique pas le défaut aux lignes de modèle, le champ est donc toujours envoyé à la création.
5. **CA45 à la création seulement.** Choisir « Versée sur » / « Dette remboursée » sur l'élément déjà prérempli en « Compte » remet « Compte » à « Aucun ». En modification, ou en choisissant le compte après le lien, c'est le message CA25 qui bloque.
6. **« Compte par défaut » s'enregistre au choix** (comme la langue), hors du brouillon « Enregistrer / Annuler » des réglages.
7. **Captures** : le serveur `ng serve` de :4200 sert une préparation de dépendances périmée (`pulpe-shared` sans `defaultAccountId`, `Unrecognized key`). Les captures viennent du build `dist` servi à part sur :4300, serveur arrêté depuis. Un redémarrage de `ng serve` règle le cas. Pendant les captures, le compte par défaut du compte de démo a changé tout seul (Neon puis Livret Raiffeisen) : la base locale est partagée avec l'agent iOS.

## Android

1. **Pas de « Versée sur » sur Android.** Aucun écran Android ne pose ni n'affiche le lien d'un élément (`assetId`). CA25 est donc tenu contre le lien que la prévision porte déjà (elle vient du web ou d'iOS) : choisir le même élément dans « Compte » bloque l'enregistrement avec le message de la règle. CA45 n'a rien à remettre à « Aucun » à la création, puisqu'un nouveau mouvement n'a pas de lien ; la règle reste dans `startAccount`, testée.
2. **Chips au lieu d'un menu.** Le champ « Compte » est une rangée de chips (« Aucun », puis « Ce que j'ai » et « Ce que je dois »), comme le Type d'un élément : un menu Paper s'ouvre derrière la feuille native.
3. **Revenu tiré d'un objectif d'épargne.** Le champ est masqué et `accountId` n'est pas envoyé : iOS route ce cas à part, sans champ, et le serveur applique le compte par défaut (phase 4, question 3).
4. **Mouvement supprimé puis rétabli (annuler).** Un mouvement libre renvoie son compte, « Aucun » compris, sinon le compte par défaut s'y poserait. Un mouvement rattaché à une prévision n'en envoie pas (CA4).
5. **Flag éteint ou aucun élément actif.** Le champ est absent et la création envoie `accountId: null`, comme iOS (CA2) : la saisie reste celle d'avant, sans compte par défaut surprise. Une modification n'envoie rien.
6. **Lissage d'une prévision existante** (`spread-existing-sheet`) : non touché, le serveur copie le compte de la prévision.
7. **Route d'écartement.** Android n'appelle plus `dismiss-suggestion` ni ne lit `suggestion` ; le champ reste dans le schéma partagé, toujours `null`, pour les versions déjà installées.
8. **Introduction de « Mon patrimoine ».** Le texte de l'étape « Garde-la à jour » et l'exemple parlaient encore de proposition : alignés mot pour mot sur le web et iOS.
9. **Compte par défaut qui change.** Le réglage passe par `useUpdateUserSettings`, qui invalide tout le cache comme pour la devise : « Mon patrimoine » et les feuilles se rechargent. Archiver ou supprimer l'élément relit le réglage (CA35).
10. **`reconcile-accounts-sheet.spec.tsx`.** L'attendu du mouvement d'écart reçoit `accountId: null` (CA44, posé dans `reconciliation.ts` par l'agent web, que je n'ai pas touché).
- Préférences : la ligne « Compte par défaut » montre le nom du compte en description et non en valeur, sinon le titre se tronque à l'échelle de police 1,3. L'aide iOS est sur l'écran de choix.
- Menu d'un élément : l'entrée « Utiliser par défaut dans le budget » dépasse les 280dp imposés par Paper, d'où une largeur forcée à 400.
- Le message de CA25 n'apparaît qu'en cas de conflit (un HelperText réserve sinon une ligne vide sous les chips).
