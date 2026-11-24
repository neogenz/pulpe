# PUL-379 : questions tranchées

1. **Android.** Le contrat le met hors périmètre ; l'utilisateur a demandé Android sur toute l'epic, en parité avec iOS. Inclus (phases 5 et 6).
2. **CA4 et CA18.** L'écran dit « Valeur enregistrée », CA18 dit « Valeur saisie » pour VoiceOver. VoiceOver lit le texte visible, « Valeur enregistrée » : le nom accessible doit contenir le libellé visible.
3. **CA8, où dépointer.** Le détail n'a pas de case à pointer, et ouvrir un mouvement depuis l'historique est hors périmètre. On dépointe dans le budget ; le détail se relit seul au retour.
4. **CA16 et CA17.** CA17 parle de « feuille », CA16 exige une adresse. Page routée `/net-worth/:id`, comme le détail d'un objectif ; sur téléphone elle occupe toute la zone de contenu.
5. **CA7.** Un mouvement pointé avant la première saisie n'est pas affiché : l'historique commence à la première saisie.
6. **CA13, effet entièrement absorbé** (remboursement sur une dette déjà à 0) : affiché avec un effet 0, l'historique montre ce qui est pointé.
7. **Élément en devise étrangère sans taux.** `effect: null`, affiché « — » ; la valeur reste la dernière saisie (règle existante).
8. **CA15 par l'adresse web.** Le serveur répond 404 pour un élément archivé ; le web affiche « introuvable » avec un retour.
9. **CA12.** Le détail offre « Modifier » ; Archiver et Supprimer restent dans le menu de la ligne.
10. **Taille de page.** 30, maximum 100.
11. **Nouvelle fonction SQL** `list_asset_movements_for` plutôt que modifier `list_asset_movements` : migrations publiées immuables, et un backend PUL-378 déjà déployé appelle l'ancienne. À retirer dans un lot ultérieur.
12. **Discriminant des entrées.** `type: 'snapshot' | 'movement'` (`kind` désigne déjà la nature d'un mouvement). L'`id` d'un mouvement est celui de sa Prévision ou de son mouvement libre : une Prévision présente dans deux périodes (CA19) répète son `id`. Les clients identifient une ligne par `type` + `id` + `at`.
13. **Mouvement qui n'a rien fait bouger.** Une Prévision dont le pointage n'ajoute rien (ses mouvements réels dépassaient déjà son montant) n'a pas d'événement et n'apparaît pas dans la période. Seul le plancher d'une dette produit un effet 0 (question 6).
14. **Dates de l'historique.** `at` et `supersededAt` sont en ISO UTC à la milliseconde (`…Z`) ; le curseur est fait de ces millisecondes. `asset.latestRecordedAt` garde le format de `GET /v1/assets`.
15. **Requête.** `assetHistoryQuerySchema` est un `z.object` souple : un paramètre inconnu est ignoré, une limite hors 1–100 ou un curseur mal formé répond 400.
