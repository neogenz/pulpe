# PUL-378: Rattacher un mouvement à un compte, avec un compte par défaut

**State:** Backlog | **Priority:** --- | **Assignee:** Unassigned

## En tant que Utilisateur, je veux dire depuis quel compte part ou arrive chaque mouvement de mon budget, avec un compte par défaut, afin que la valeur de ce compte suive ce que je pointe sans que je la ressaisisse

### Contexte

Demande d'un utilisateur : rattacher une dépense prévue, imprévue ou venue du modèle à un compte de « Mon patrimoine », et choisir un compte par défaut. Son besoin : voir son compte courant bouger au fil du mois. Aujourd'hui une Dépense ne peut être liée qu'à une dette qu'elle rembourse, jamais à un compte ; un imprévu n'a aucun lien ; rien ne fait bouger un compte courant.

Cette story ajoute un champ « Compte » sur chaque mouvement et un réglage « Compte par défaut ». La valeur du compte bouge dès que je pointe, selon la règle posée par la story « Faire suivre la valeur d'un élément par ce que je pointe ».

Cadrage : `aidd_docs/tasks/2026_11/2026_11_12_suivi-comptes-depuis-budget/brainstorm.md`.

### Jeu d'essai

Flag `net_worth` allumé, devise de base CHF, aucun compte par défaut, rien de pointé.

* « Compte courant » : ce que j'ai, CHF, dernière saisie 5 000
* « Revolut » : ce que j'ai, CHF, dernière saisie 400
* « Livret » : ce que j'ai, CHF, dernière saisie 10 000
* « Leasing » : ce que je dois, CHF, dernière saisie 8 000
* Fortune brute 15 400, dettes 8 000, fortune nette 7 400

Chaque critère repart de cet état, sauf mention contraire.

### Critères d'acceptation

**Le champ « Compte » (web et iOS) :**

- [ ] CA1: Les formulaires de création et de modification d'une prévision, d'un imprévu et d'une ligne de modèle proposent un champ « Compte », pour une Dépense, un Revenu et une Épargne. Il liste « Aucun », puis deux groupes nommés : mes éléments « ce que j'ai » actifs (Compte courant, Revolut, Livret) et mes dettes actives (Leasing)
- [ ] CA2: Flag éteint, ou sans aucun élément actif, le champ est absent et la saisie est identique à aujourd'hui
- [ ] CA3: Sans compte par défaut, le champ est sur « Aucun » à la création
- [ ] CA4: Un mouvement réel rattaché à une prévision n'a pas de champ « Compte » : il suit le compte de sa prévision

**Ce que ça change dans « Mon patrimoine » (mêmes chiffres que** `GET /v1/assets`**) :**

- [ ] CA5: Dépense imprévue « Restaurant » 80, compte Compte courant, pointée : le Compte courant vaut 4 920 et la fortune nette 7 320
- [ ] CA6: Revenu « Salaire » 6 000, compte Compte courant, pointé : le Compte courant vaut 11 000 et la fortune nette 13 400
- [ ] CA7: Épargne « Épargne mensuelle » 500, compte Compte courant, « Versée sur » Livret, pointée : le Compte courant vaut 4 500, le Livret 10 500, la fortune nette reste 7 400
- [ ] CA8: Dépense « Mensualité leasing » 300, compte Compte courant, « Dette remboursée » Leasing, pointée : le Compte courant vaut 4 700, le Leasing 7 700, la fortune nette reste 7 400
- [ ] CA9: Revenu « Retrait » 1 000, « Tiré de » Livret, compte Compte courant, pointé : le Livret vaut 9 000, le Compte courant 6 000, la fortune nette reste 7 400
- [ ] CA10: Après CA5, je dépointe « Restaurant » : le Compte courant revient à 5 000
- [ ] CA11: Après CA5, je passe le compte de « Restaurant » à Revolut : le Compte courant revient à 5 000 et Revolut vaut 320
- [ ] CA12: Après CA5, je supprime « Restaurant » : le Compte courant revient à 5 000
- [ ] CA13: Un mouvement pointé dont le champ « Compte » est « Aucun » ne change aucun compte par ce champ. Ses autres liens s'appliquent : Épargne 500, compte « Aucun », « Versée sur » Livret, pointée : le Compte courant reste à 5 000 et le Livret vaut 10 500
- [ ] CA14: Dépense de 500 sur Revolut, pointée : Revolut vaut −100, porte « Découvert » et compte du côté des dettes, selon la règle existante des comptes à découvert
- [ ] CA15: Seul ce qui a bougé après ma dernière saisie du compte compte : un mouvement pointé avant ne change pas sa valeur. Pour une prévision, c'est ce qu'elle compte aujourd'hui moins ce qu'elle comptait au moment de la saisie. « Courses » prévue à 400, compte Compte courant, un mouvement réel de 120 pointé, puis je saisis 4 880 pour le Compte courant, puis je pointe la prévision : le Compte courant vaut 4 600 (280 de plus, pas 400)
- [ ] CA16: Un compte en EUR reçoit le montant converti au taux du jour ; sans taux, il garde ma dernière saisie

**Prévision et mouvements réels rattachés :**

- [ ] CA17: Dépense « Courses » prévue à 400, compte Compte courant, non pointée, avec un mouvement réel rattaché de 120 pointé : le Compte courant vaut 4 880
- [ ] CA18: Après CA17, je pointe la prévision « Courses » : le Compte courant vaut 4 600
- [ ] CA19: « Courses » pointée avec 450 de mouvements réels rattachés pointés : le Compte courant vaut 4 550
- [ ] CA20: Épargne de 500, compte Compte courant, « Versée sur » Livret, pointée avec 600 de mouvements réels rattachés pointés : le Compte courant vaut 4 400 et le Livret 10 600. Les deux côtés bougent du même montant
- [ ] CA21: Avec un seul compte « ce que j'ai », dans la devise du budget, sur tous les mouvements d'un mois et sans nouvelle saisie de valeur, ce qui bouge sur ce compte est égal à ce qui bouge sur le solde pointé du budget de ce mois, sauf le cas de CA43
- [ ] CA43: Revenu « Salaire » prévu à 6 000, compte Compte courant, pointé, avec un mouvement réel rattaché de 6 000 pointé : le Compte courant vaut 11 000. Le solde pointé du budget, lui, additionne aujourd'hui les deux (12 000) ; cette story n'y touche pas

**Modèle, lissage, suppression :**

- [ ] CA22: Une ligne de modèle avec un compte donne des prévisions qui portent ce compte. Changer le compte d'une ligne de modèle suit la propagation existante : au choix, mois en cours et suivants, sans toucher aux prévisions modifiées à la main
- [ ] CA23: Lisser une Dépense qui a un compte donne à chaque occurrence le même compte
- [ ] CA46: « Courses » prévue à 400, compte Revolut, pointée, avec 120 de mouvements réels pointés : Revolut vaut 0. Je supprime la prévision : ses mouvements réels restent dans le budget, gardent le compte Revolut, et Revolut vaut 280
- [ ] CA24: Je supprime le compte Revolut : ses mouvements restent et leur champ repasse à « Aucun ». Je l'archive : le lien reste, mais pointer ne change plus sa valeur
- [ ] CA25: Choisir le même élément dans « Compte » et dans « Versée sur » ou « Tiré de » est refusé, avec un message dans le formulaire et une erreur de l'API
- [ ] CA26: Une modification qui n'envoie pas le compte (Android, ancienne version d'iOS) le conserve
- [ ] CA27: « Disponible à dépenser », le solde pointé et le report sont identiques avant et après avoir rattaché des comptes

**Compte par défaut :**

- [ ] CA28: « Compte par défaut » se règle à deux endroits qui montrent le même réglage : les préférences (web : Réglages ; iOS : Compte, Préférences), avec « Aucun » ou un de mes éléments actifs, dette comprise ; et le menu d'un élément actif sur « Mon patrimoine », avec « Utiliser par défaut dans le budget ». Flag éteint ou sans élément actif, le réglage est absent aux deux endroits
- [ ] CA47: Sur « Mon patrimoine », le compte par défaut porte un badge « Par défaut ». Compte courant par défaut, je choisis « Utiliser par défaut dans le budget » dans le menu de Revolut : le badge passe sur Revolut, les préférences affichent Revolut, et les nouveaux mouvements sont préremplis avec Revolut comme en CA33. Sur l'élément qui est déjà le compte par défaut, le menu propose « Ne plus utiliser par défaut », qui remet le réglage à « Aucun » comme en CA34
- [ ] CA29: Avec Compte courant par défaut, le champ « Compte » de tout nouveau mouvement est prérempli avec Compte courant. Je peux choisir un autre compte ou « Aucun »
- [ ] CA30: Choisir un compte par défaut ne change aucun mouvement existant, pointé ou non, ni aucune ligne de modèle : seuls les mouvements que je crée ensuite sont préremplis
- [ ] CA31: Une prévision créée depuis le modèle prend le compte de sa ligne de modèle, jamais le compte par défaut : une ligne de modèle sans compte donne une prévision sans compte
- [ ] CA32: Un mouvement créé sans préciser de compte (Android, import bancaire, assistant) prend le compte par défaut. Un mouvement créé avec « Aucun » reste sans compte. Ordre de priorité : un mouvement réel rattaché suit sa prévision (CA4, y compris à l'import), une prévision créée depuis le modèle suit sa ligne (CA31), un compte choisi l'emporte, sinon le compte par défaut
- [ ] CA44: Le mouvement « Écart avec mes comptes » noté par le rapprochement reste sans compte, même avec un compte par défaut. Compte courant par défaut, écart de −80 venu de Revolut : le Compte courant reste à 5 000 ; ce sont les soldes tapés dans le rapprochement qui recalent les comptes
- [ ] CA45: Le compte par défaut ne s'applique jamais à un mouvement dont « Versée sur », « Tiré de » ou « Dette remboursée » est déjà cet élément. Livret par défaut, une ancienne version d'iOS crée une Épargne 500 « Versée sur » Livret sans envoyer de compte : elle est acceptée sans compte et le Livret vaut 10 500 une fois pointée. Dans le formulaire, choisir dans « Versée sur », « Tiré de » ou « Dette remboursée » l'élément prérempli comme compte remet le compte sur « Aucun »
- [ ] CA33: Je passe le compte par défaut de Compte courant à Revolut : les mouvements qui portent Compte courant le gardent, les nouveaux sont préremplis avec Revolut
- [ ] CA34: Je retire le compte par défaut : aucun mouvement existant ne change, les nouveaux formulaires sont sur « Aucun »
- [ ] CA35: Je supprime ou j'archive le compte par défaut : le réglage repasse à « Aucun »
- [ ] CA36: Parcours du demandeur : Compte courant par défaut. Je crée ensuite « Loyer » 1 500, l'imprévu « Restaurant » 80 et « Salaire » 6 000 sans toucher au champ « Compte », puis je les pointe. Le Compte courant vaut 9 420

**Payer avec une dette :**

Pour ces critères, j'ajoute « Carte de crédit » : ce que je dois, CHF, dernière saisie 200. Les dettes valent 8 200 et la fortune nette 7 200.

- [ ] CA37: Dépense « Restaurant » 80, compte Carte de crédit, pointée : la Carte de crédit vaut 280, les dettes 8 280, la fortune nette 7 120. Le Compte courant reste à 5 000
- [ ] CA38: Après CA37, je dépointe « Restaurant » : la Carte de crédit revient à 200
- [ ] CA39: Revenu « Remboursement » 50, compte Carte de crédit, pointé : la Carte de crédit vaut 150. Un Revenu de 300 la met à 0, jamais en dessous
- [ ] CA40: Dépense « Mensualité leasing » 300, compte Carte de crédit, « Dette remboursée » Leasing, pointée : la Carte de crédit vaut 500, le Leasing 7 700, la fortune nette reste 7 200
- [ ] CA41: Régler la carte depuis le Compte courant n'est pas un mouvement du budget : rien ne bouge tout seul. Je saisis 0 pour la Carte de crédit et le nouveau solde du Compte courant, et la suite repart de ces deux saisies
- [ ] CA42: Une Dépense payée par carte et pointée en novembre reste comptée dans le budget de novembre. Quand la banque débite la carte le mois de budget suivant, aucune Dépense ne s'ajoute à ce mois-là et « Disponible à dépenser » ne change pas

### Règles métier

* Sur un élément « ce que j'ai » : une Dépense et une Épargne pointées le baissent, un Revenu pointé le monte
* Sur une dette, c'est l'inverse : une Dépense et une Épargne pointées montent ce que je dois, un Revenu pointé le baisse, jamais sous zéro
* Ce qui compte pour un compte suit la règle du solde pointé : une prévision pointée compte pour le plus grand de son montant et de ses mouvements réels pointés ; non pointée, pour ses mouvements réels pointés ; un imprévu pointé, pour son montant. Un Revenu prévu suit la même règle, alors que le solde pointé du budget additionne aujourd'hui un Revenu prévu pointé et ses mouvements réels pointés (CA43)
* Une saisie peut couper une prévision en deux : ce qui compte après la saisie est ce que la prévision compte aujourd'hui moins ce qu'elle comptait au moment de la saisie (CA15). Les deux termes se calculent avec les montants et liens actuels ; le second ne retient que les pointages encore présents et datés au plus tard de la saisie
* Les liens existants (« Versée sur », « Dette remboursée », « Tiré de ») comptent désormais le même montant que le compte, pour qu'un passage d'un élément à l'autre laisse la fortune nette inchangée. Cette neutralité ne tient que quand les deux éléments retiennent le même montant : pas quand une dette touche zéro (payer 300 depuis le Compte courant sur une dette de 200 baisse le compte de 300, la dette de 200, et la fortune nette de 100), ni quand une saisie a déjà absorbé un des deux côtés
* Une dette ne descend jamais sous zéro : les mouvements sont pris dans l'ordre où je les ai pointés, et chacun est borné par ce qui reste dû à ce moment. Leasing à 200 : un remboursement de 300 retient −200 (il vaut 0), un achat de 100 pointé ensuite le porte à 100
* Le compte se modifie à tout moment, contrairement à l'origine d'un Revenu, figée à la création
* Les virements entre mes éléments ne sont pas des mouvements du budget, régler une carte de crédit depuis un compte compris : la répartition se recale par une saisie ou un rapprochement
* Le compte par défaut ne fait que préremplir ce que je crée : il ne réécrit jamais l'existant. Pour rattacher ce qui existe déjà, je modifie le mouvement ou la ligne de modèle
* Rien n'est obligatoire : sans compte par défaut et sans compte choisi, Pulpe se comporte comme aujourd'hui

### Notes techniques

* **Package(s) concerné(s)** : `backend-nest` / `shared` / `frontend` / `ios`
* Le lien n'existe aujourd'hui que sur `budget_line` et `template_line` (`asset_id`, réservé à l'avoir alimenté ou à la dette remboursée). Il faut un second lien, distinct, sur ces deux tables et sur `transaction`, qui n'en a aucun. Il accepte les deux sens, avoir ou dette
* Les RPC qui copient les colonnes d'une prévision (création depuis le modèle, propagation, lissage) doivent porter ce lien, comme la migration `20261103130000_link_prevision_to_asset.sql` l'a fait pour `asset_id`
* Le calcul de la valeur ne lit aujourd'hui que `budget_line` : il doit lire aussi `transaction`
* Formulaires web sans sélecteur aujourd'hui : `current-month/components/add-transaction-form.ts`, `allocated-transactions/create-dialog/form.ts`, `edit-transaction-form.ts`. Avec sélecteur existant : `budget-line/create/dialog.ts`, `budget-line/edit/dialog.ts`, `edit-template-line-dialog.ts`
* Formulaires iOS : `MovementSheet` (aucun lien aujourd'hui), `AddBudgetLineSheet`, `EditBudgetLineSheet`, `EditTemplateLineSheet`, `AddTemplateLineSheet`
* Réglage : `GET` / `PUT /v1/users/settings`. Les réglages vivent dans `user_metadata`, sans clé étrangère ; CA35 demande soit une table dédiée, soit un nettoyage à la suppression du compte. À trancher au plan
* « Mon patrimoine » écrit le même réglage par la même route : menu et badge sur la ligne d'un élément (`net-worth-asset-row.ts` sur le web, `NetWorthAssetRow.swift` sur iOS). Un changement fait d'un côté se voit de l'autre sans recharger l'app
* Android n'envoie jamais ce lien : CA26 et CA32 le couvrent côté serveur, sans écran Android
* L'import groupé (`confirm-transaction-import.use-case.ts`) applique la priorité de CA32 : une ligne allouée à une prévision prend le compte de la prévision
* Supprimer une prévision rend ses mouvements réels libres (`ON DELETE SET NULL` sur `transaction.budget_line_id`) : ils reçoivent le compte de la prévision dans la même écriture (CA46)
* Le mouvement d'écart du rapprochement est créé déjà pointé, avant les photos (`reconcile-accounts-dialog.ts`, `AccountReconciliation.swift`, rapprochement Android), comme un mouvement ordinaire que le serveur ne distingue pas. Pour CA44, le rapprochement envoie explicitement « Aucun » sur le web, iOS et Android (un champ envoyé, pas un écran). Limite acceptée : une version déjà installée qui ne l'envoie pas reçoit le compte par défaut, et la photo écrite juste après recale ce compte s'il fait partie du rapprochement
* `docs/BUSINESS_RULES.md`, section Patrimoine, à mettre à jour dans le même changement

### Hors périmètre

* Virements entre mes comptes
* Régler une carte de crédit depuis un compte autrement que par une saisie (virement entre deux éléments)
* Un compte propre à un mouvement réel rattaché à une prévision
* Écrans Android
* Le détail d'un compte et la projection de fin de mois (stories liées)

## Parent

- **PUL-376**: Suivre mes comptes depuis mon budget _[Backlog]_

