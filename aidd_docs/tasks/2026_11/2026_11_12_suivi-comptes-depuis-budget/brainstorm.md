---
status: approved
---

# Suivre mes comptes depuis mon budget

Un utilisateur demande de pouvoir rattacher une dépense (prévue, imprévue ou venue du modèle) à un compte de « Mon patrimoine », avec un compte par défaut. Son besoin : voir son compte courant bouger au fil de ce qu'il pointe, au lieu de rester figé sur sa dernière saisie. Aujourd'hui seuls l'épargne, les revenus tirés du patrimoine et les dettes font bouger un élément, et seulement après un clic sur « Appliquer ».

## Ce qui est clair

- Chaque mouvement du budget peut porter un compte : une prévision, un imprévu, une ligne de modèle. Trois états : aucun compte, le compte par défaut prérempli, ou un autre compte choisi à la main.
- Le compte par défaut est un réglage, dans les préférences : un élément actif de « Mon patrimoine », dette comprise, ou aucun.
- Les trois natures ont le champ : une dépense baisse le compte, un revenu le monte, une épargne le baisse. Sur une dette c'est l'inverse, et elle ne descend pas sous zéro. Sans les revenus, le compte ne ferait que descendre.
- Pointer un mouvement qui a un compte change la valeur de ce compte tout de suite. Dépointer annule. Il n'y a plus de « Appliquer » ni de « Écarter », pour aucun élément : la valeur d'un élément est ma dernière saisie plus ce que j'ai pointé depuis.
- Je peux toujours écraser la valeur à la main ; la suite repart de cette saisie.
- La liste des mouvements rattachés ne s'affiche pas sur la page « Mon patrimoine » : elle vit dans le détail d'un élément, un écran qui n'existe pas encore.
- Ce détail montre tout l'historique de l'élément depuis sa création : mes saisies et les mouvements pointés. Seul ce qui a bougé après ma dernière saisie entre dans la valeur ; le reste reste visible pour mémoire, et la saisie qui le suit fait foi.
- Le compte par défaut ne fait que préremplir les mouvements que je crée ensuite. Il ne change rien à ce qui est déjà saisi, pointé ou non, ni aux lignes de modèle.
- Le champ « Compte » propose aussi mes dettes. Une dépense payée avec une carte de crédit monte ce que je dois, sans toucher au compte courant : l'argent n'a pas encore quitté la banque.
- Les virements entre mes éléments ne sont pas modélisés, le débit mensuel de la carte sur le compte courant compris. Une saisie ou le rapprochement recale.
- Le lien existant (une épargne vers un avoir, une dépense qui rembourse une dette, un revenu tiré d'un avoir) reste et se cumule avec le compte : une épargne payée depuis le compte courant vers le Livret baisse l'un et monte l'autre.
- Le rapprochement reste une action spontanée. Il n'est pas la source de ce lien, seulement une des deux façons de saisir une valeur.
- On écrit des user stories, pas de code. Quatre stories liées sous PUL-376 : la valeur suit le pointage (PUL-377) ; rattacher un mouvement à un compte (PUL-378) ; le détail d'un élément (PUL-379) ; la projection de fin de mois (PUL-380).
- Rien de cela n'entre dans la PR de refonte de « Mon patrimoine ».

## Tranché en écrivant les stories

Les hypothèses du cadrage sont confirmées, et la relecture des stories a fixé les cas qu'elles laissaient ouverts. Le détail et les exemples chiffrés sont dans les tickets.

- Un mouvement réel rattaché à une prévision n'a pas son propre compte : il suit celui de sa prévision. Si la prévision est supprimée, ses mouvements réels gardent son compte (PUL-378).
- Ce qui compte pour un compte suit la règle du solde pointé : une prévision pointée compte pour le plus grand de son montant et de ses mouvements réels pointés ; non pointée, pour ses mouvements réels pointés. Un revenu prévu suit la même règle, alors que le budget additionne aujourd'hui un revenu prévu pointé et ses mouvements réels pointés (PUL-378).
- Une saisie peut couper une prévision en deux : ce qui compte après la saisie est ce que la prévision compte aujourd'hui moins ce qu'elle comptait au moment de la saisie. L'historique la montre alors une fois de chaque côté de la saisie (PUL-378, PUL-379).
- Un mouvement réel rattaché suit sa prévision, et une prévision créée depuis le modèle suit sa ligne, même quand elles n'ont pas de compte. Ailleurs, un mouvement créé sans préciser de compte (Android, import, assistant) prend le compte par défaut. Deux exceptions : l'écart noté par le rapprochement reste sans compte, et le compte par défaut ne s'applique pas quand il est déjà l'élément lié au mouvement (PUL-378).
- Une dette ne descend jamais sous zéro : les mouvements sont pris dans l'ordre où je les ai pointés, chacun borné par ce qui reste dû à ce moment (PUL-376).
- Les apps déjà installées, iOS 1.14.x et Android (qui a « Mon patrimoine » derrière le flag), continuent de fonctionner sans mise à jour. Une proposition écartée avant la mise en service ne revient pas (PUL-377).
- La projection se limite au mois du budget en cours, selon le jour de paie (PUL-380).

## Encore ouvert

- L'utilisateur qui demande a beaucoup de comptes mais un seul pour ce besoin. Celui qui paie depuis deux comptes devra choisir le compte à la main sur chaque mouvement qui ne passe pas par son compte par défaut : personne n'a encore dit si ce coût est acceptable au quotidien.
- Le débit mensuel de la carte demande de recaler deux soldes, la carte et le compte, par deux saisies ou par le rapprochement. Une action « J'ai réglé ma carte » serait un virement : à décider si ces deux saisies pèsent à l'usage.
- Le budget additionne le montant d'un revenu prévu pointé et celui de ses mouvements réels pointés, au lieu de garder le plus grand comme pour une dépense. C'est hors de ces stories, à traiter à part.
