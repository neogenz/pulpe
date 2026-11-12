---
status: approved
---

# Suivre mes comptes depuis mon budget

Un utilisateur demande de pouvoir rattacher une dépense (prévue, imprévue ou venue du modèle) à un compte de « Mon patrimoine », avec un compte par défaut. Son besoin : voir son compte courant bouger au fil de ce qu'il pointe, au lieu de rester figé sur sa dernière saisie. Aujourd'hui seuls l'épargne, les revenus tirés du patrimoine et les dettes font bouger un élément, et seulement après un clic sur « Appliquer ».

## Ce qui est clair

- Chaque mouvement du budget peut porter un compte : une prévision, un imprévu, une ligne de modèle. Trois états : aucun compte, le compte par défaut prérempli, ou un autre compte choisi à la main.
- Le compte par défaut est un réglage : un compte de « Mon patrimoine », ou aucun.
- Les trois natures ont le champ : une dépense baisse le compte, un revenu le monte, une épargne le baisse. Sans les revenus, le compte ne ferait que descendre.
- Pointer un mouvement qui a un compte change la valeur de ce compte tout de suite. Dépointer annule. Il n'y a plus de « Appliquer » ni de « Écarter », pour aucun élément : la valeur d'un élément est ma dernière saisie plus ce que j'ai pointé depuis.
- Je peux toujours écraser la valeur à la main ; la suite repart de cette saisie.
- La liste des mouvements rattachés ne s'affiche pas sur la page « Mon patrimoine » : elle vit dans le détail d'un élément, un écran qui n'existe pas encore.
- Les virements entre mes comptes ne sont pas modélisés. Le rapprochement recale.
- Le lien existant (une épargne vers un avoir, une dépense qui rembourse une dette, un revenu tiré d'un avoir) reste et se cumule avec le compte : une épargne payée depuis le compte courant vers le Livret baisse l'un et monte l'autre.
- Le rapprochement reste une action spontanée. Il n'est pas la source de ce lien, seulement une des deux façons de saisir une valeur.
- On écrit des user stories, pas de code. Quatre stories liées sous PUL-376 : la valeur suit le pointage (PUL-377) ; rattacher un mouvement à un compte (PUL-378) ; le détail d'un élément (PUL-379) ; la projection de fin de mois (PUL-380).
- Rien de cela n'entre dans la PR de refonte de « Mon patrimoine ».

## Hypothèses

Proposées pendant l'échange, non corrigées, à confirmer avant de démarrer la story concernée.

- Le détail montre les mouvements pointés depuis ma dernière saisie, pas tout l'historique : la liste et le chiffre s'additionnent.
- Choisir un compte par défaut s'applique aussi à ce qui est déjà saisi et pas encore pointé, dans le mois en cours et les suivants, et aux lignes de modèle sans compte. Ce qui est déjà pointé ne bouge pas.
- On peut choisir tout élément « ce que j'ai » actif, jamais une dette. Payer par carte de crédit est hors périmètre.
- Un mouvement réel rattaché à une prévision n'a pas son propre compte : il suit celui de sa prévision.
- Ce qui compte pour un compte suit la règle du solde pointé : une prévision pointée compte pour le plus grand de son montant et de ses mouvements réels pointés ; non pointée, pour ses mouvements réels pointés.
- Un mouvement créé sans préciser de compte (Android, import, assistant) prend le compte par défaut.

## Encore ouvert

- L'utilisateur qui demande a beaucoup de comptes mais un seul pour ce besoin. Celui qui paie depuis deux comptes devra choisir le compte à la main sur chaque mouvement : personne n'a encore dit si ce coût est acceptable au quotidien.
- Où se choisit le compte par défaut : dans les réglages, ou depuis le détail du compte.
- La projection (« ce compte vaudra tant à la fin du mois ») se limite-t-elle au mois en cours.
