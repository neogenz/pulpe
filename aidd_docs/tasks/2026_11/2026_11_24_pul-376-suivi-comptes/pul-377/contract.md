# PUL-377: Faire suivre la valeur d'un élément par ce que je pointe

**State:** Backlog | **Priority:** --- | **Assignee:** Unassigned

## En tant que Utilisateur, je veux que la valeur de mes avoirs et de mes dettes bouge dès que je pointe une prévision liée afin de voir ma fortune à jour sans avoir à cliquer sur « Appliquer »

### Contexte

Aujourd'hui, pointer une prévision liée à un élément de « Mon patrimoine » ne change rien : l'élément affiche « Je propose 10 500 » avec « Appliquer » et « Écarter », et la fortune nette attend le clic (PUL-372). Cette story supprime cette étape. La valeur d'un élément devient : ma dernière saisie, plus ce que j'ai pointé depuis.

Elle ne concerne que les liens qui existent déjà : une Épargne vers un avoir, un Revenu « Tiré de mon patrimoine », une Dépense qui rembourse une dette. Aucun champ nouveau dans les formulaires. C'est le socle de la story « Rattacher un mouvement à un compte », qui fera bouger le compte courant selon la même règle.

Cadrage : `aidd_docs/tasks/2026_11/2026_11_12_suivi-comptes-depuis-budget/brainstorm.md`.

### Jeu d'essai

Flag `net_worth` allumé, devise de base CHF, rien de pointé au départ.

* « Livret » : ce que j'ai, CHF, dernière saisie 10 000
* « Leasing » : ce que je dois, CHF, dernière saisie 8 000
* Fortune brute 10 000, dettes 8 000, fortune nette 2 000
* Budget du mois : Épargne « Épargne mensuelle » 500 liée au Livret ; Dépense « Mensualité leasing » 300 liée au Leasing ; Revenu « Retrait » 1 000 tiré du Livret

Chaque critère repart de cet état, sauf mention contraire.

### Critères d'acceptation

**Commun (web et iOS, mêmes chiffres que** `GET /v1/assets`**) :**

- [ ] CA1: Je pointe « Épargne mensuelle ». Sans autre action, le Livret vaut 10 500, la fortune brute 10 500 et la fortune nette 2 500
- [ ] CA2: Je pointe « Mensualité leasing ». Le Leasing vaut 7 700, les dettes 7 700 et la fortune nette 2 300
- [ ] CA3: Je pointe « Retrait ». Le Livret vaut 9 000
- [ ] CA4: Après CA1, je dépointe « Épargne mensuelle ». Le Livret revient à 10 000 et la fortune nette à 2 000
- [ ] CA5: Après CA1, je saisis 12 000 comme valeur du Livret. Il vaut 12 000 (et non 12 500). Une autre Épargne de 200 liée au Livret, pointée ensuite, le porte à 12 200
- [ ] CA6: Le Leasing vaut 200. Je pointe « Mensualité leasing » (300). Le Leasing vaut 0, jamais un montant négatif
- [ ] CA7: La fortune brute, les dettes, la fortune nette, le sous-total de chaque type et le Sankey sont calculés avec les valeurs à jour : après CA1 et CA2, la somme des éléments affichés est égale à chaque total affiché
- [ ] CA8: Aucun élément n'affiche « Je propose », « Appliquer » ni « Écarter », quel que soit ce qui est pointé
- [ ] CA9: Après CA1, la ligne du Livret dit ce qui a bougé depuis ma dernière saisie : le montant signé (+500) et la date de cette saisie. Quand rien n'a été pointé depuis, cette mention est absente
- [ ] CA10: Après CA1, « Modifier » le Livret ouvre le champ de valeur prérempli à 10 500 et rappelle ma dernière saisie : 10 000 et sa date
- [ ] CA11: Pointer ou dépointer n'ajoute aucune entrée à l'historique des valeurs de l'élément : seules une saisie à la main et un rapprochement en ajoutent
- [ ] CA12: Je pointe une prévision liée depuis l'écran du budget, puis j'ouvre « Mon patrimoine » : la valeur est à jour sans recharger l'app
- [ ] CA13: Dans le rapprochement, l'indication sous un compte suivi affiche sa valeur à jour, pas seulement ma dernière saisie
- [ ] CA14: Un élément en EUR lié à une prévision en CHF reçoit le montant converti au taux du jour. Sans taux disponible, il garde ma dernière saisie et la page signale un total incomplet, comme aujourd'hui
- [ ] CA15: Un élément archivé garde ma dernière saisie : pointer une prévision qui lui est liée ne change ni sa valeur ni les totaux

**Mise en service :**

- [ ] CA16: Une proposition qui attendait un clic avant la mise en service est devenue la valeur affichée après
- [ ] CA17: Une proposition que j'avais écartée avant la mise en service ne revient pas : la mise en service copie pour cet élément sa dernière photo antérieure à l'écartement, datée de l'instant où j'ai écarté. Livret saisi à 10 000, « Épargne mensuelle » pointée puis proposition écartée : après la mise en service, le Livret vaut toujours 10 000, et une Épargne de 200 pointée ensuite le porte à 10 200
- [ ] CA18: Les apps déjà installées (iOS 1.14.x et Android, qui ont « Mon patrimoine » derrière le flag) fonctionnent sans mise à jour : après CA1, elles affichent 10 500 pour le Livret, n'affichent plus de proposition, et leur bouton « Écarter » encore à l'écran répond sans erreur et ne change rien

### Règles métier

* Valeur d'un élément = ma dernière saisie + ce que j'ai pointé depuis cette saisie. Une saisie est une valeur tapée dans « Modifier » ou un solde tapé dans le rapprochement. Une valeur enregistrée avant cette story par « Appliquer » compte aussi comme une saisie
* Une dette ne descend jamais sous zéro : les mouvements sont pris dans l'ordre où je les ai pointés, et chacun est borné par ce qui reste dû à ce moment. Leasing à 200 : un remboursement de 300 retient −200 (il vaut 0), un achat de 100 pointé ensuite le porte à 100
* Sens inchangés : une Épargne pointée ajoute à l'avoir, un Revenu tiré d'un avoir le baisse, une Dépense qui rembourse une dette baisse ce qui reste dû
* Seul le pointage de la prévision compte, pour son montant prévu (inchangé ; la story « Rattacher un mouvement à un compte » aligne ce point sur le solde pointé)
* Une prévision pointée avant ma dernière saisie, dépointée puis repointée après, compte de nouveau : limite déjà acceptée dans PUL-372
* Le budget ne change pas : « Disponible à dépenser » et le solde pointé sont calculés comme avant

### Notes techniques

* **Package(s) concerné(s)** : `backend-nest` / `shared` / `frontend` / `ios`
* Le calcul reste côté serveur (`asset.formulas.ts`) : les totaux lisent aujourd'hui la dernière photo seule, ils doivent lire la valeur à jour. Web et iOS n'additionnent rien de plus qu'aujourd'hui
* L'API donne pour chaque élément la valeur à jour, la dernière saisie et sa date
* Contrat transitoire pour CA18 : iOS 1.14.x (`NetWorthView` → `AssetService`) et Android (`net-worth-api.ts`) appellent `POST /v1/assets/:id/dismiss-suggestion` et lisent `suggestion` (`shared/schemas.ts`). Le champ reste, toujours `null` ; la route reste, n'écrit plus rien et renvoie l'élément ; le champ de valeur que ces clients affichent porte la valeur à jour. Retrait possible quand plus aucune version installée ne les lit
* `asset.suggestion_dismissed_at` ne sert qu'à la migration de CA17 : une photo de la valeur du moment, datée de l'écartement, pour chaque élément écarté après sa dernière photo. Ensuite aucun calcul ne la lit. La migration passe avant le nouveau backend (`docs/DEPLOYMENT.md`) : la conversion est idempotente (élément écarté après sa dernière photo) et se relance après la bascule pour les écartements faits entre les deux
* Limite acceptée : un ancien écran resté ouvert pendant la bascule peut encore « Appliquer » une proposition périmée (flag réservé aux early adopters, fenêtre de quelques minutes). L'écran rechargé n'en montre plus
* `docs/BUSINESS_RULES.md`, section Patrimoine, à mettre à jour dans le même changement

### Hors périmètre

* Tout nouveau champ dans les formulaires de saisie
* Le détail d'un élément et la liste de ses mouvements
* Écrans Android : « Mon patrimoine » existe derrière le flag, il reçoit la valeur à jour par l'API sans changement d'écran (CA18)
* Retrait du flag `net_worth`

## Parent

- **PUL-376**: Suivre mes comptes depuis mon budget _[Backlog]_

