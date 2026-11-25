# Suites de PUL-376 : revue, lecteur d'écran et captures

Branche `fix/pul-376-suites`. Six points demandés après la fusion de l'épique (#947 à #951).

## Ce qui a changé, point par point

| Point | Commit | Plateformes |
| ----- | ------ | ----------- |
| 1. Un seul message de conflit sur le champ « Compte » | `80beaad72` | web, Android, iOS (fr, en, de, it) |
| 2. « saisie » remplacé par « mouvement » dans l'aide du compte par défaut | `acba86404` | web, Android, iOS |
| 3. Sous-titre « Préférences » qui cite le compte par défaut quand `net_worth` est allumé | `635f010e2` (iOS), `9c4cef6e5` (Android) | iOS, Android |
| 4. Le compte d'un mouvement n'est envoyé qu'avec le flag allumé | `c0257cd51` | web, Android, iOS |
| 5. Lecteur d'écran et grand texte | `dbec9ebe6` (web, Android), `3deb1c0bd` (web), `81548e1af` (iOS) | les trois |
| Revue : paramètre `linkTitle` mort retiré | `2de3a32e6` | iOS |

Point 4, en clair : flag éteint, la requête de création d'un mouvement, d'une prévision ou d'une
ligne de modèle est celle d'avant l'épique, sans clé `accountId`. Flag allumé, le compte est
toujours dit, `null` compris pour « Aucun ». Même règle pour l'ajustement de réconciliation.
`docs/BUSINESS_RULES.md` le dit à la ligne 72.

## Lecteur d'écran et grand texte

Méthode :

- iOS : harnais UITest `NetWorthAccountsUITestHarness` + `performAccessibilityAudit()`, 7 écrans × 5 configurations (clair, sombre, XXL, AX5 clair et sombre).
- Android : `uiautomator dump` sur l'émulateur, polices 1.0, 1.3 et 2.0. TalkBack lancé mais pas parcouru en direct, la machine était trop chargée.
- Web : axe-core 4.10.2, arbre d'accessibilité Chrome, clair, sombre, texte à 200 %, 390 et 1280 px.

### Corrigés

Web :

- L'interrupteur « Déjà pointé » était lu sans nom (« interrupteur, désactivé ») dans « Prévoir une dépense » et « Ajouter un mouvement ». Le libellé était posé sur l'hôte et jamais transmis au vrai interrupteur.
- Détail d'un élément à 200 % : titre et libellés de l'historique réduits à 2 ou 3 lettres. Ils passent maintenant à la ligne, le montant descend dessous.
- Mon patrimoine à 200 % : nom d'une ligne réduit à une lettre (« R… » pour « Revolut EUR »). Le nom garde 8 caractères, le montant passe dessous.
- Conflit sur « Compte » : le message était rouge, mais pas le contour du champ, à l'inverse des autres erreurs du formulaire. Le contour passe en rouge.

Android :

- Champ « Compte » : trois arrêts TalkBack (le bouton, la valeur seule, une flèche sans nom). Un seul maintenant : « Compte, Livret Raiffeisen ».
- Ligne de patrimoine à 2.0 : nom coupé en plein mot et montant tronqué. Le nom passe au-dessus du montant à partir de 1.5, comme sur les prévisions.

iOS :

- Fortune nette lue en deux arrêts : « 12’670 », puis « CHF ». Un seul arrêt maintenant : « 12’670 CHF ». Masqué comme avant quand les montants sont cachés.
- Conflit sur « Compte » : le message apparaissait sous un menu que VoiceOver venait de fermer, sans être lu, et « Enregistrer » se désactivait sans raison dite. Le message est annoncé.
- Lignes « Versée sur », « Dette remboursée », « Tiré de » en AX5 : titre coupé en plein mot et valeur tronquée. La valeur passe sous le titre. Touche aussi les sélecteurs d'objectif d'épargne, qui partagent cette ligne.
- « Compte par défaut » en XXL : les deux lignes du titre étaient centrées. Elles sont alignées à gauche.

### Vérifié conforme

- Lignes de patrimoine lues d'un bloc avec leurs badges (« Par défaut », « Découvert », « Hors total ») sur les trois plateformes.
- « Fin novembre : 7’620.00 CHF, si tout se passe comme prévu ce mois-ci » lu en une fois.
- Historique : chaque entrée lue d'un bloc, libellé, date, montant.
- Champ « Compte » : nom, valeur, groupes « Ce que j'ai » et « Ce que je dois », sélection annoncée.
- « Compte par défaut » dans les réglages : nom, valeur et aide lus.
- Contraste de l'erreur de conflit : aucun signalement axe ; 5.24 en clair et 8.30 en sombre sur Android.

### Laissés : touchés par l'épique, pas corrigés

- Web : les entrées chargées au défilement de l'historique ne sont pas annoncées (comportement courant pour ce motif).
- Web : dans les réglages, l'aide du compte par défaut est en retrait, celle de « Langue » est collée à gauche.
- Web : un nom long reste tronqué sur la ligne de patrimoine à taille normale (« Compte courant U… » à 390 px). Le nom complet est lu et visible sur le détail.
- Android : historique d'un élément à 2.0, date coupée (« 10 nove/mbre ») et montant sur deux lignes. La cause est `LedgerRow`, partagé par d'autres écrans.
- Android : le hero lit « Comptes 9’420.00 CHF » sans pause, et les tuiles lisent le montant avant le libellé.
- iOS : « · à la comparaison » dans le sous-titre d'un compte suivi est peu clair pour un débutant. Question de texte produit, pas d'accessibilité.

### Pas vérifiable ici

- Android : annonce du message de conflit par TalkBack en direct (le texte est présent dans l'arbre).
- Android : badges « Découvert » et « Hors total », faute de données (même code que « Par défaut »).
- iOS et Android : prononciation du séparateur ’ des milliers par la synthèse vocale.
- iOS : pavé numérique sans bouton pour fermer le clavier en taille par défaut.

### Antérieurs à l'épique, hors périmètre

- Web : graphique Sankey de Mon patrimoine non atteignable au clavier sur téléphone.
- Web : un bloc vide hors repère sur toutes les pages.
- Web : à 200 %, le rail latéral mord sur le contenu, les puces de montant débordent, plusieurs libellés de champ sont rognés.
- Web : chaque menu de ligne de modèle s'appelle « Plus d'options », sans le nom de la ligne.
- Web : l'aide de « Langue » n'est pas reliée à son champ.
- Web : le sélecteur de devise d'un nouvel élément porte le même nom que le montant (« Valeur actuelle »).
- Android : segmenté « Dépense / Épargne » et titre de la barre coupés à 2.0, « Close menu » en anglais, fond de sheet sans nom.
- Android : la prévision « Épargne mensuelle » n'apparaît pas dans la liste de novembre alors qu'elle s'ouvre par lien direct (non creusé).
- iOS : en-tête de « Compte » en AX5, le prénom se casse lettre par lettre.
- iOS : pied des Préférences avec un double point (« 24 nov.. »).
- iOS : l'icône de bandeau d'information est lue « Erreur ».
- iOS : en AX5, « Description » se coupe en plein mot et les segmentés tronquent (« Men… »).
- iOS : contrastes limites sur « Quel montant ? » et « Mensuel » désactivé.

## Revue de code

- Aucun point bloquant.
- Corrigés : nom `isAccountOffered` remplacé par `isNetWorthEnabled` (Android) ; parité du sous-titre Préférences sur Android ; paramètre `linkTitle` mort retiré (iOS).
- Gardé : `statesAccount: Bool = true` dans la réconciliation iOS. Seuls les tests s'appuient sur la valeur par défaut ; les deux écrans passent le flag.

## Risque à connaître

Flag éteint, l'app n'envoie plus de compte. Si l'utilisateur a choisi un compte par défaut quand
le flag était allumé, le serveur l'applique aux nouveaux mouvements. Le compte reste invisible tant
que le flag est éteint, et réapparaît s'il est rallumé.

## Captures

Dossier `aidd_docs/tasks/2026_11/2026_11_24_pul-376-suivi-comptes/suites/shots/`, non versionné comme pour les stories précédentes :

- `web/` (37) : formulaires (dépense, conflit sur prévision et sur ligne de modèle), compte par défaut, liste, détail ; clair, sombre, 200 % ; 390 et 1280 px.
- `android/` (38) : champ, conflit, liste et badges, détail, Préférences, compte par défaut ; clair, sombre ; 1.0, 1.3, 2.0 ; plus la liste après correctif.
- `ios/` (45) : liste, lignes, détail, historique, Préférences, Compte, trois sheets ; clair et sombre en taille par défaut, XXL, AX5.
