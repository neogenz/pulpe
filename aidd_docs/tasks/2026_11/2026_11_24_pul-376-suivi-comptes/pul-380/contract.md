# PUL-380: Voir la projection de fin de mois d'un compte

**State:** Backlog | **Priority:** --- | **Assignee:** Unassigned

## En tant que Utilisateur, je veux voir ce que vaudra un compte à la fin du mois si tout ce que j'ai prévu arrive afin de savoir où j'en serai sans faire le calcul moi-même

### Contexte

La valeur d'un compte suit ce que j'ai pointé. Cette story ajoute l'étage au-dessus : ce qui est prévu ce mois-ci et pas encore pointé. Elle répond à la question « on peut faire des projections par bien ? » posée pendant le cadrage. Elle vient après les autres et peut être abandonnée sans rien casser.

Cadrage : `aidd_docs/tasks/2026_11/2026_11_12_suivi-comptes-depuis-budget/brainstorm.md`.

### Jeu d'essai

Flag `net_worth` allumé, devise de base CHF, on est le 12 novembre, le mois du budget va du 1er au 30 novembre.

* « Compte courant » vaut 3 800 (dernière saisie 5 000, 1 200 de dépenses pointées depuis)
* Prévu ce mois, rattaché au Compte courant, pas encore pointé : Dépense « Loyer » 1 500 ; Dépense « Assurance » 300 ; Revenu « Salaire » 6 000
* Prévu en décembre, rattaché au Compte courant : Dépense « Impôts » 2 000

### Critères d'acceptation

**Commun (web et iOS) :**

- [ ] CA1: Le détail du Compte courant affiche « Fin novembre : 8 000 » (3 800 − 1 500 − 300 + 6 000)
- [ ] CA2: Je pointe « Loyer ». La valeur passe à 2 300 et la projection reste 8 000
- [ ] CA3: Je passe « Assurance » de 300 à 400 sans la pointer. La projection passe à 7 900, la valeur ne change pas
- [ ] CA4: « Impôts », prévu en décembre, n'entre pas dans la projection de novembre
- [ ] CA5: Une Dépense « Courses » prévue à 400, non pointée, avec 450 de mouvements réels rattachés dont 100 pointés, compte pour 450 dans la projection : les 100 déjà dans la valeur, 350 encore à venir
- [ ] CA6: Quand il ne reste rien à venir ce mois, la projection est égale à la valeur et la ligne n'est pas affichée. Une prévision de 400 pointée avec un mouvement réel de 450 pas encore pointé laisse encore 50 à venir
- [ ] CA9: Une Dépense imprévue « Pharmacie » 40, saisie et pas encore pointée, rattachée au Compte courant, enlève 40 à la projection
- [ ] CA10: Une saisie en milieu de mois ne fait pas compter deux fois ce qu'elle a absorbé : « Courses » prévue à 400, non pointée, avec 450 de mouvements réels, dont 100 pointés avant une saisie de 4 900 pour le Compte courant, et rien d'autre de prévu : la projection est 4 550
- [ ] CA7: Un élément sans rien à venir ce mois, ni prévision ni mouvement saisi pas encore pointé, n'affiche pas de projection. Avec la seule « Pharmacie » de CA9, la projection s'affiche
- [ ] CA8: La projection ne change ni la valeur de l'élément, ni la fortune nette, ni l'historique des valeurs

### Règles métier

* Projection = valeur à jour + ce qui reste à venir ce mois. Pour chaque mouvement du mois rattaché au compte : ce qu'il comptera une fois tout pointé, moins ce qu'il compte déjà, même si une saisie l'a déjà absorbé
* Une fois tout pointé, une prévision compte pour le plus grand de son montant prévu et de tous ses mouvements réels rattachés, comme le total effectif du budget (`docs/BUSINESS_RULES.md`) ; un imprévu, pour son montant. Sur une dette, le zéro s'applique comme pour la valeur (règle de l'epic)
* Le mois est celui du budget en cours, selon mon jour de paie

### Notes techniques

* **Package(s) concerné(s)** : `backend-nest` / `shared` / `frontend` / `ios`
* Calculée côté serveur avec la valeur, jamais additionnée par les clients

### Hors périmètre

* Projection sur plusieurs mois
* Projection de la fortune nette entière
* Rendement des placements et cours de marché
* Android

## Parent

- **PUL-376**: Suivre mes comptes depuis mon budget _[Backlog]_

