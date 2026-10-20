# Une seule façon de dire d'où vient un revenu

Quand on crée un revenu dans Pulpe, la question « d'où vient cet argent ? » ne se pose pas de la même façon selon le parcours. Une prévision propose un menu « Origine » à trois choix, dont « Revenu habituel », qui laisse croire à une récurrence alors que la prévision créée est ponctuelle, et un libellé si long qu'il casse le menu iOS (texte coupé sur quatre lignes). Un mouvement ajouté depuis l'accueil affiche un simple interrupteur, sans l'option « à remettre ». Résultat : une question confuse et deux parcours qui se contredisent.

On pose désormais la même question, de la même façon, dans les deux parcours et sur les trois plateformes (iOS, webapp, Android). Le cas courant (salaire, remboursement, cadeau) ne demande rien : l'interrupteur reste éteint par défaut.

## Ce qui est clair

- Interrupteur « Cet argent vient de mon épargne », éteint par défaut, dans le parcours prévision et dans le parcours mouvement.
- Une fois allumé, un choix segmenté à deux options :
  - « D'un objectif » : retrait définitif d'un objectif (PUL-329), avec le sélecteur d'objectif et la légende « Le montant sera retiré de l'objectif choisi. »
  - « À remettre » : « Couvrir ce mois avec mon épargne » (PUL-292). Une paire Revenu M + Épargne M+1 du même montant, prise sur l'épargne générale. Légende « À remettre le mois prochain : je te le rappellerai. »
- Le menu « Origine » et le libellé « Revenu habituel » disparaissent. Le bug du texte coupé disparaît avec eux.
- Depuis l'accueil, « À remettre » ouvre le parcours existant « Couvrir ce mois avec mon épargne ». Le résultat est une paire de prévisions, pas un Réel. C'est accepté.
- La copie n'emploie jamais « avance » ni « emprunt » (copie validée en test utilisateur, voir `TightMonthCard.swift`).
- Les règles actuelles restent en place : « Pointé » est interdit dans les deux modes épargne. Aucun changement backend.
- Mêmes libellés sur iOS, la webapp et Android.

## Encore ouvert

- iOS : `Features/CurrentMonth` ne peut pas importer `Features/Budgets`. Le parcours « À remettre » doit passer dans `Shared/` ou être routé au niveau de l'app. C'est un choix de mise en œuvre, sans effet sur l'UX.
- Android : je ne sais pas si le parcours « Couvrir ce mois avec mon épargne » existe déjà côté Android. Sinon, « À remettre » n'a nulle part où aller.
- Hypothèse : la puce « déficit » qui pré-remplit le montant reste telle quelle quand on ouvre le parcours depuis l'accueil.

## Prochaine étape

Plan d'implémentation par phases (iOS, webapp, Android), puis code.
