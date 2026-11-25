# PUL-379: Ouvrir le détail d'un élément et revoir tout son historique

**State:** Backlog | **Priority:** --- | **Assignee:** Unassigned

## En tant que Utilisateur, je veux ouvrir le détail d'un élément de mon patrimoine et y revoir tout son historique, mes saisies et les mouvements pointés, afin de comprendre comment sa valeur a évolué

### Contexte

Une fois que la valeur d'un élément suit ce que je pointe, je dois pouvoir vérifier d'où vient le chiffre et remonter dans le temps. Aujourd'hui il n'existe aucun écran de détail, ni sur le web ni sur iOS : toucher un élément ouvre directement « Modifier », et les valeurs passées sont gardées sans être montrées nulle part. L'historique ne va pas sur la page « Mon patrimoine », il la rendrait trop lourde : il vit dans un écran à part, ouvert depuis l'élément.

Cadrage : `aidd_docs/tasks/2026_11/2026_11_12_suivi-comptes-depuis-budget/brainstorm.md`.

### Jeu d'essai

Flag `net_worth` allumé, devise de base CHF.

* « Compte courant » : ce que j'ai, CHF, créé le 1er octobre avec une première saisie de 4 800, puis une saisie de 5 000 le 1er novembre
* Pointée entre les deux saisies, rattachée au Compte courant : Dépense « Assurance » 300 le 28 octobre
* Pointés depuis la dernière saisie, rattachés au Compte courant : Dépense « Loyer » 1 500 le 3 novembre ; Dépense imprévue « Restaurant » 80 le 5 novembre ; Revenu « Salaire » 6 000 le 10 novembre
* Le Compte courant vaut donc 9 420
* « Livret » : ce que j'ai, CHF, une seule saisie de 10 000, rien de pointé depuis

### Critères d'acceptation

**Commun (web et iOS) :**

- [ ] CA1: Toucher ou cliquer le Compte courant sur « Mon patrimoine » ouvre son détail, et non plus directement « Modifier »
- [ ] CA2: Le détail affiche le nom, le type, la valeur à jour (9 420) et ma dernière saisie avec sa date (5 000, le 1er novembre)
- [ ] CA3: L'historique est une seule liste, du plus récent au plus ancien, qui mêle mes saisies et les mouvements pointés. Dans l'ordre : « Salaire », « Restaurant », « Loyer », la saisie de 5 000 du 1er novembre, « Assurance », la saisie de 4 800 du 1er octobre
- [ ] CA4: Chaque mouvement affiche son libellé, la date où je l'ai pointé et son effet signé : +6 000, −80, −1 500, −300. Chaque saisie s'affiche « Valeur enregistrée », avec la valeur et sa date, qu'elle vienne de « Modifier », du rapprochement ou d'un ancien « Appliquer »
- [ ] CA5: La somme des effets des mouvements placés au-dessus de ma dernière saisie (+4 420) est égale à la valeur à jour moins cette saisie (9 420 − 5 000)
- [ ] CA6: Un mouvement placé sous une saisie se distingue de ceux du dessus : on lit qu'il n'entre plus dans la valeur, la saisie qui le suit fait foi. « Assurance » est dans ce cas
- [ ] CA7: L'historique remonte jusqu'à la création de l'élément : la saisie du 1er octobre est la dernière entrée
- [ ] CA8: Je dépointe « Restaurant » : il disparaît de l'historique et la valeur passe à 9 500, sans recharger
- [ ] CA9: Je saisis 9 000 depuis le détail : cette saisie apparaît en tête, la valeur est 9 000, et « Salaire », « Restaurant » et « Loyer » restent dans l'historique, sous elle
- [ ] CA10: Le détail du Livret affiche sa saisie de 10 000 et une phrase qui dit que rien n'a été pointé depuis, pas une liste muette
- [ ] CA11: Avec plus d'entrées que l'écran n'en charge d'un coup, les plus récentes s'affichent d'abord et la suite se charge en descendant, sans bloquer l'ouverture
- [ ] CA12: « Modifier » est accessible depuis le détail et ouvre la feuille existante ; le menu de la ligne garde Modifier, Archiver et Supprimer
- [ ] CA13: Le détail d'une dette liste les Dépenses pointées qui la remboursent (effet négatif), les Dépenses et Épargnes payées avec elle (effet positif) et les Revenus portés sur elle (effet négatif) ; celui d'un avoir liste aussi les Épargnes qui l'alimentent et les Revenus qui en sont tirés. Un effet borné par le zéro d'une dette s'affiche pour ce qu'il a retenu, selon la règle de l'epic : 300 payés sur une dette de 200 s'affichent −200, un achat de 100 pointé ensuite +100
- [ ] CA14: Pour un élément en EUR, chaque effet est affiché dans la devise de l'élément
- [ ] CA15: Un élément archivé n'ouvre pas de détail, comme il n'ouvre pas « Modifier » aujourd'hui
- [ ] CA19: J'ajoute au jeu d'essai « Courses » prévue à 400, rattachée au Compte courant : un mouvement réel de 120 pointé le 28 octobre, puis la prévision pointée le 4 novembre. « Courses » apparaît deux fois : −120 sous la saisie du 1er novembre, −280 au-dessus, daté du 4 novembre. La valeur passe à 9 140 et CA5 reste vrai (+4 140)

**Web :**

- [ ] CA16: Le détail a sa propre adresse : recharger la page ou y revenir avec « Précédent » retombe sur le même élément
- [ ] CA17: Sous 40rem, le détail occupe tout l'écran, comme les autres feuilles de « Mon patrimoine »

**iOS :**

- [ ] CA18: Le détail s'ouvre par navigation depuis la liste et se quitte par le geste de retour ; VoiceOver lit pour chaque entrée son libellé ou « Valeur saisie », sa date et son montant

### Règles métier

* Seuls les mouvements pointés après ma dernière saisie entrent dans la valeur à jour. Ceux d'avant restent visibles pour mémoire : la saisie qui les suit fait foi, qu'elle les comprenne ou non (une saisie créée à la mise en service de PUL-377 pour une proposition écartée ne les comprend pas)
* Une saisie est une valeur tapée dans « Modifier » ou un solde tapé dans le rapprochement
* Une prévision qui a des mouvements réels rattachés apparaît une fois par période entre deux saisies où elle a bougé, avec ce qu'elle a fait bouger dans cette période, à la date de son dernier pointage dans cette période (CA19)
* Un mouvement dépointé ou supprimé sort de l'historique : l'historique montre ce qui est pointé, pas un journal des clics
* Le détail ne recalcule rien : l'historique et les montants viennent du serveur, comme la valeur

### Notes techniques

* **Package(s) concerné(s)** : `backend-nest` / `shared` / `frontend` / `ios`
* L'API ne donne aujourd'hui que la dernière valeur d'un élément : les saisies passées sont en base (`asset_snapshot`) sans aucune lecture, et rien ne liste les mouvements liés. Il faut une lecture paginée qui mêle les deux, avec l'effet de chaque mouvement déjà converti
* Web : une seule route existe (`net-worth.routes.ts`), le détail en ajoute une
* iOS : `NetWorthView` n'a que des feuilles ; le détail est un écran poussé

### Hors périmètre

* Courbe d'évolution de la valeur
* Ouvrir un mouvement dans son budget depuis l'historique
* Modifier ou supprimer une saisie passée
* Les mouvements prévus et pas encore pointés (story « Projection de fin de mois »)
* Android

## Parent

- **PUL-376**: Suivre mes comptes depuis mon budget _[Backlog]_

