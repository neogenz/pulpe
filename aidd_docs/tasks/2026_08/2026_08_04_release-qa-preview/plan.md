# QA de release — `preview` → v0.44.0

Plan d'exécution manuelle/assistée. Chaque scénario est autonome : contexte, étapes, critères
d'acceptation vérifiables. Destiné à être exécuté tel quel dans une session dédiée.

Périmètre : le delta `v0.43.0..preview` (181 commits). Les fonctionnalités concernées sont
PUL-329 (retrait d'un objectif d'épargne), la refonte de l'accueil iOS, le lien lissage ↔
objectifs, et la réparation des plans d'épargne.

---

## 0. Environnement et préconditions

### Cibles

| Surface | URL / cible | Backend | Base de données |
| --- | --- | --- | --- |
| Webapp preview | `https://pulpe-frontend.vercel.app` | `https://backend-preview-34f4.up.railway.app` | Supabase `lrphlfjkzkwyllejanrd` |
| iOS | build simulateur pointée sur le backend preview | idem | idem |

La base de données de preview est **distincte de la production**. Aucun scénario ci-dessous ne
touche des données réelles d'utilisateur.

### Contrainte CORS

Le backend preview tourne en mode `productionLike` (`NODE_ENV=preview`). Les origines acceptées
sont exactement :

- `https://pulpe-frontend.vercel.app` (valeur de `CORS_ORIGIN`)
- toute URL correspondant à `^https://pulpe-frontend-.+-maximes-projects-.+\.vercel\.app$`

Une URL de déploiement Vercel sans le suffixe de scope (`pulpe-frontend-<hash>.vercel.app`) sera
**rejetée en CORS**. Utiliser l'alias stable ou l'URL de branche complète.

### Préconditions bloquantes

Ces trois points sont à vérifier **avant** de démarrer. Si l'un échoue, tous les scénarios W* et
S* échoueront pour une raison qui n'est pas un défaut du code.

- **P1 — Migrations appliquées sur la base preview.** Le job CI `🗄️ Apply Migrations` est gaté sur
  `github.ref == 'refs/heads/main'` : rien n'applique automatiquement les migrations à
  l'environnement de preview. Les deux migrations de ce lot
  (`20260802120000_add_savings_goal_withdrawals.sql`,
  `20260804120000_bump_savings_goal_revision_on_start_date.sql`) doivent y être poussées à la main.

  Vérification :

  ```sql
  select
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='transaction'
        and column_name='source_savings_goal_id') as source_goal_col,
    (select count(*) from information_schema.columns
      where table_schema='public' and table_name='savings_goal'
        and column_name='balance_revision') as balance_revision_col,
    (select count(*) from pg_trigger
      where tgname='bump_own_savings_goal_balance_revision') as revision_trigger;
  ```

  Attendu : `1 / 1 / 1`. Si `revision_trigger` vaut 1 mais que la seconde migration manque, vérifier
  que la définition du trigger contient bien `UPDATE OF initial_amount, start_date` — sans
  `start_date`, le scénario S3 ne peut pas passer.

- **P2 — Le déploiement Vercel de preview correspond bien au SHA candidat.** Comparer le commit
  affiché dans Vercel avec `git rev-parse preview`.

- **P3 — Compte de test avec des données exploitables.** Il faut au minimum : un budget sur le mois
  courant, un objectif d'épargne au solde confirmé strictement positif et connu, et une prévision
  d'épargne liée à cet objectif. Les scénarios notent leur état de départ.

### Ce que la suite e2e prouve déjà (ne pas le rejouer à la main)

`frontend/e2e/tests/features/savings-goal-withdrawals.spec.ts` couvre déjà, contre un backend
**simulé**, tout le câblage d'interface : création du retrait, propagation du solde, édition,
suppression, blocage au-delà du solde, objectif vidé retiré de la liste, suppression de l'objectif
et lien cassé. Ces assertions passent en CI.

La session manuelle sert donc à prouver ce que les mocks ne peuvent pas prouver : **le comportement
réel du serveur et de la base** — atomicité, concurrence, chiffrement, arithmétique flottante,
isolation RLS. Les scénarios ci-dessous sont écrits dans cette optique. Les scénarios purement
visuels (iOS) n'ont, eux, aucun filet automatisé et sont à jouer intégralement.

### Convention

Chaque scénario porte un identifiant, une priorité (**P0** bloquant la release, **P1** à corriger
avant release si possible, **P2** à consigner), et une plateforme.

---

## Section S — Vérités serveur et base de données

Ces scénarios s'exécutent contre le backend de preview. Ils demandent un accès SQL à la base de
preview en lecture, et un client HTTP authentifié (le jeton peut être récupéré depuis la session
de la webapp).

### S1 — Le retrait est atomique — P0

**Intention.** La transaction de revenu et la décrémentation du solde de l'objectif doivent être
une seule écriture indivisible. Un demi-retrait laisse un revenu fantôme ou un objectif faussement
appauvri.

**État de départ.** Objectif `G` de solde confirmé `B` strictement positif. Noter `B` et
`G.balance_revision`.

**Étapes.**

1. Créer un revenu libre de montant `A` (avec `0 < A < B`) dont la source est `G`, depuis la webapp.
2. Relever en base : la ligne `transaction` créée, et `savings_goal.balance_revision` de `G`.

**Critères d'acceptation.**

- La transaction existe avec `kind = 'income'`, `budget_line_id IS NULL`,
  `source_savings_goal_id = G.id`, et `source_savings_goal_name` égal au nom de `G` au moment de
  l'écriture.
- Le solde confirmé de `G` lu par l'API vaut exactement `B − A`.
- `amount` en base est un texte chiffré (pas un nombre lisible).
- Aucune ligne orpheline : aucune transaction portant `source_savings_goal_id = G.id` sans entrée
  correspondante dans la liste des retraits renvoyée par l'API.

### S2 — Vider l'objectif au dernier centime est accepté — P0

**Intention.** Le solde confirmé est une somme de flottants : un pot de 150 peut valoir
`149.99999999999997` en mémoire. La tolérance `WITHDRAWAL_BALANCE_TOLERANCE = 0.005` (côté partagé)
et son miroir Swift `SavingsGoalProgress.withdrawalBalanceTolerance` existent pour que le geste le
plus légitime de la fonctionnalité ne soit pas refusé.

**État de départ.** Objectif `G` dont le solde confirmé provient d'au moins **trois** contributions
non rondes (par exemple 33.33 + 66.67 + 50.01), et non d'un unique montant initial rond. C'est cette
composition qui produit l'erreur d'arrondi.

**Étapes.**

1. Lire le solde confirmé `B` affiché par l'application.
2. Créer un revenu de montant exactement `B` avec `G` pour source.

**Critères d'acceptation.**

- La création est **acceptée** (pas d'erreur `ERR_SAVINGS_GOAL_WITHDRAWAL_INSUFFICIENT_BALANCE`).
- Le solde confirmé affiché après l'opération est `0`, pas une valeur négative résiduelle du type
  `-0.00000000000003`.
- La progression affichée n'est pas négative.
- `G` n'apparaît plus dans les options de retrait proposées au formulaire suivant.

### S3 — Déplacer la date de début invalide un retrait en vol — P0

**Intention.** C'est le défaut que corrige la migration du 4 août, la plus récente du lot et celle
qui a le moins de recul. `start_date` ancre la fenêtre de contributions : la reculer ou l'avancer
change le stock confirmé sans toucher un seul montant. Avant le correctif, `balance_revision` ne
bougeait pas et un retrait calculé sur l'ancienne fenêtre était accepté après coup.

**État de départ.** Objectif `G` avec plusieurs prévisions d'épargne liées, réparties sur des mois
différents, et une `start_date` antérieure à la première d'entre elles.

**Étapes.**

1. Ouvrir le formulaire de création de revenu, sélectionner `G` comme source, saisir un montant
   proche du solde total. **Ne pas valider.**
2. Dans un autre onglet, éditer `G` et **avancer sa date de début** de plusieurs mois, de manière à
   faire sortir au moins une prévision liée de la fenêtre.
3. Revenir sur le premier onglet et valider le retrait.

**Critères d'acceptation.**

- La création est **refusée** avec le code `ERR_SAVINGS_GOAL_WITHDRAWAL_CONFLICT`.
- Le message affiché à l'utilisateur explique le conflit (solde modifié entre-temps) et n'est pas
  une erreur générique.
- En base, `G.balance_revision` a été incrémenté par le changement de date de début.
- Rejouer l'opération après rechargement de l'écran fonctionne, sur le nouveau solde.

**Variante S3b — même scénario en modifiant le montant initial au lieu de la date de début.** Même
critère de refus. Cette variante était déjà couverte avant la migration du 4 août ; elle sert de
témoin.

### S4 — Le double envoi ne débite qu'une fois — P1

**Intention.** Le contrat de création accepte un `id` généré par le client pour permettre des
reprises idempotentes.

**Étapes.** Émettre deux fois la même requête de création de retrait avec le **même** `id` client.

**Critères d'acceptation.**

- Un seul revenu existe en base.
- Le solde de l'objectif n'a été décrémenté qu'une fois.
- La seconde réponse n'est pas une erreur serveur non gérée (5xx).

### S5 — Isolation entre comptes — P0

**Intention.** `source_savings_goal_id` est une nouvelle clé étrangère traversant deux tables
soumises à RLS.

**Étapes.** Avec le jeton du compte de test, tenter de créer un revenu dont
`source_savings_goal_id` désigne un objectif appartenant à un **autre** compte (identifiant obtenu
en base).

**Critères d'acceptation.**

- La requête est refusée.
- Le solde de l'objectif de l'autre compte est inchangé.
- Aucune fuite du nom de l'objectif dans le corps de la réponse d'erreur.

### S6 — Un revenu lié ne peut être ni une dépense ni alloué à une prévision — P1

**Intention.** Trois garde-fous se superposent : le raffinement Zod partagé, l'invariant applicatif,
et la contrainte `transaction_source_savings_goal_free_income` en base. Le test vise la couche la
plus basse.

**Étapes.** Émettre directement à l'API deux créations avec `sourceSavingsGoalId` renseigné :
(a) `kind: 'expense'`, (b) `kind: 'income'` avec un `budgetLineId` non nul.

**Critères d'acceptation.**

- Les deux sont refusées en 4xx, avec un message explicite (pas une violation de contrainte
  PostgreSQL brute remontée en 500).
- Aucune ligne n'est créée.

---

## Section W — Webapp

À jouer sur `https://pulpe-frontend.vercel.app` avec le compte de test.

### W1 — L'aperçu avant/après du retrait est juste — P1

**Étapes.** Mois courant → nouvelle transaction → montant `A` → type « Revenu » → activer la source
d'épargne → choisir l'objectif `G` de solde `B`.

**Critères d'acceptation.**

- L'aperçu affiche le solde avant (`B`) et le solde après (`B − A`).
- Les deux montants sont formatés en **agrégation, sans décimales** (`10 000 CHF`, `5 500 CHF`) —
  ce sont des soldes.
- La modification du montant met l'aperçu à jour sans validation intermédiaire.
- En CHF, le séparateur de milliers est l'apostrophe (`10’000 CHF`), conformément à la locale
  `de-CH`.

### W2 — Le dépassement de solde est bloqué avant l'envoi — P0

**Étapes.** Même formulaire, saisir un montant strictement supérieur à `B`.

**Critères d'acceptation.**

- Un avertissement de solde insuffisant est visible.
- Le bouton de validation est désactivé.
- **Aucune requête `POST /transactions` n'est émise** (onglet réseau).
- Ramener le montant sous `B` réactive le bouton et fait disparaître l'avertissement.

### W3 — Un objectif vide n'est plus proposé — P1

**État de départ.** Objectif dont le solde confirmé est zéro (issu de S2).

**Critères d'acceptation.**

- L'activation de la source d'épargne affiche l'état vide dédié, et non une liste vide silencieuse.
- Le bouton de validation est désactivé.

### W4 — L'argent est navigable dans les deux sens — P1

**Étapes.** Depuis le détail du budget, ouvrir le revenu lié ; puis depuis le détail de l'objectif,
ouvrir le retrait.

**Critères d'acceptation.**

- Dans la liste des transactions du budget, le revenu porte la mention `Pris sur · <nom objectif>`.
- Le détail de l'objectif liste le retrait, avec un montant à **deux décimales** (`4 500.00 CHF`) —
  c'est une ligne, pas un agrégat — tandis que le solde confirmé reste sans décimales.
- Cliquer le retrait ouvre la transaction dans son budget.
- Le retour arrière revient au détail de l'objectif **sans rouvrir** la boîte de dialogue de la
  transaction (le paramètre d'URL consommé ne doit pas se rejouer).

### W5 — Éditer et supprimer le retrait conservent l'équation du solde — P0

**Intention.** Contrairement à l'e2e simulé, ici c'est le serveur qui recalcule.

**Étapes.** Depuis un retrait de montant `A` sur un objectif au solde `B` :

1. Éditer la transaction, passer le montant à `A'`.
2. Recharger le détail de l'objectif.
3. Supprimer la transaction.
4. Recharger le détail de l'objectif.

**Critères d'acceptation.**

- Après l'édition, le solde confirmé vaut exactement `B + A − A'`.
- Après la suppression, le solde revient exactement à `B + A`.
- La section des retraits disparaît quand il n'en reste aucun (elle ne s'affiche pas vide).
- Aucun rechargement manuel supplémentaire n'est nécessaire pour voir le bon solde.

### W6 — Supprimer l'objectif conserve le revenu et casse seulement le lien — P0

**Étapes.** Ouvrir la boîte de suppression d'un objectif ayant au moins un retrait, puis confirmer.

**Critères d'acceptation.**

- L'aperçu de suppression comporte un bloc dédié aux retraits, avec leur nombre et leur total, et
  **aucune action de suppression par ligne** — un revenu déjà vécu n'est pas un candidat à la
  suppression.
- Après suppression, le revenu existe toujours dans son budget.
- Sa mention devient `Objectif supprimé · <nom>`, le nom restant lisible.
- Cette mention n'est plus cliquable (aucun lien).
- L'icône associée est masquée aux lecteurs d'écran (`aria-hidden="true"`), le nom accessible est
  porté par le texte visible.
- Le solde du budget porteur est inchangé par la suppression de l'objectif.

### W7 — Le motif d'un refus serveur remonte à l'écran — P1

**Intention.** Un correctif dédié de ce lot rend visible la raison d'un refus au lieu d'un message
générique.

**Étapes.** Provoquer un refus serveur réel (le conflit de S3 est le plus simple).

**Critères d'acceptation.**

- Le message affiché reprend le motif renvoyé par le serveur.
- Un nouvel essai n'est proposé que si le rejouer peut aboutir différemment.
- L'écran n'est pas laissé dans un état de chargement bloqué.

### W8 — Le lissage lié à un objectif — P1

**Étapes.** Créer une dépense lissée (`mode: perMonth` puis `mode: total`) en lui associant un
objectif d'épargne.

**Critères d'acceptation.**

- La répartition sur les mois conserve le total (aucun centime perdu à l'arrondi).
- Le « reste à provisionner » affiché vaut `max(0, total − cumulé)` et ne devient jamais négatif.
- L'objectif lié est visible depuis les trois surfaces de détail d'enveloppe de la webapp, avec le
  même montant.

### W9 — Réparation d'un plan d'épargne troué — P1

**Intention.** Ces commits écrivent dans des données utilisateur existantes ; le risque est le
doublon.

**État de départ.** Objectif dont le plan comporte au moins un mois sans budget matérialisé et un
mois sans prévision liée. Relever le nombre de prévisions liées avant l'opération.

**Étapes.** Déclencher la récupération des prévisions manquantes / l'application du plan.

**Critères d'acceptation.**

- Les mois manquants sont provisionnés.
- **Aucun doublon** : le nombre de prévisions liées augmente exactement du nombre de mois réparés.
- Rejouer l'opération immédiatement une seconde fois ne crée rien de plus.
- Un objectif dont la période du budget est déjà passée est désactivé dans les sélecteurs.

### W10 — Compte en EUR — P1

**Intention.** Le contrôle de solde porte sur le montant converti.

**Étapes.** Rejouer W1, W2 et W5 sur un compte configuré en EUR.

**Critères d'acceptation.**

- Les montants s'affichent avec le symbole `€` en suffixe, séparateur d'espace (`10 000 €`).
- Le blocage de dépassement se déclenche sur le solde converti, pas sur une valeur brute.
- Aucun code ISO brut (`EUR`, `CHF`) n'apparaît dans une carte, un titre ou une pastille — il n'est
  admis que dans les libellés d'accessibilité et les phrases de taux.

### W11 — Mode démo — P2

**Intention.** Plusieurs commits modifient le jeu de données de démonstration.

**Critères d'acceptation.**

- Le parcours de démonstration s'ouvre sans identifiants.
- Le mois amorcé montre une dépense lissée, des objectifs alimentés, et un consommé/restant non nuls.
- Aucune erreur de console au chargement.

---

## Section I — iOS

Non couvert par l'URL de preview : nécessite une build simulateur pointée sur le backend de
preview. Aucun filet automatisé n'existe sur le rendu — cette section est à jouer intégralement.

### I1 — Parité du retrait d'épargne — P0

**Étapes.** Rejouer S1, W2, W5 et W6 depuis l'application iOS, sur le même compte.

**Critères d'acceptation.**

- Les soldes affichés sur iOS et sur le web sont **identiques au centime** pour le même objectif.
- Le blocage de dépassement s'applique avec la même tolérance qu'en web (un retrait du solde total
  passe des deux côtés, ou échoue des deux côtés).
- La mention d'origine et son état cassé après suppression sont présents.

### I2 — Accueil refondu, états limites — P0

**Critères d'acceptation.**

- Mois sans aucune transaction : l'écran affiche un état vide intentionnel, pas une carte vide ni un
  squelette figé.
- Mois chargé : la liste par jour reste lisible, sans séparateurs superflus.
- Mois passé et mois futur s'ouvrent sans erreur.
- La carte d'activité apparaît dès qu'il existe au moins une transaction.

### I3 — Courbe de trajectoire — P1

**Critères d'acceptation.**

- Au premier jour du mois, la courbe est tracée (elle ne démarre pas vide).
- En milieu de mois, la partie réalisée et la partie prévisionnelle sont distinguables.
- Quand le mois sort de son plan, la phrase de l'accueil le dit explicitement.
- Le graphique n'intercepte pas le geste de défilement de la page.

### I4 — Accessibilité et tailles de texte — P0

**Critères d'acceptation.**

- En taille de texte accessibilité maximale, aucun montant ni libellé n'est tronqué sur l'accueil.
- Avec les montants masqués, les libellés d'accessibilité ne prononcent aucun montant.
- L'en-tête reste opaque au défilement (correctif de ce lot).

### I5 — Navigation et actions — P1

**Critères d'acceptation.**

- Ce qui s'ouvre depuis l'accueil reste dans l'onglet accueil.
- La création de budget est atteignable depuis la barre d'outils.
- La création de transaction est contextualisée au budget courant.
- Le report d'une opération se présente comme un choix et recalcule les deux budgets concernés.

### I6 — Compatibilité descendante du client publié — P0

**Intention.** Les utilisateurs de l'App Store resteront en 1.3.x pendant la revue Apple, face à un
backend déjà déployé. Les ajouts de contrat sont annotés compatibles ; il faut le prouver.

**Étapes.** Installer la build **v0.43.0 / 1.3.1** sur un simulateur, la pointer sur le backend de
preview (migrations appliquées), et parcourir : liste des objectifs d'épargne, détail d'un objectif
ayant reçu un retrait, création d'une transaction ordinaire, détail d'un budget.

**Critères d'acceptation.**

- Aucun écran ne tombe en erreur de décodage.
- Le détail d'un objectif ayant subi un retrait s'affiche (le solde peut ignorer le retrait sur cette
  ancienne version, mais l'écran ne doit pas casser).
- Une transaction ordinaire se crée normalement.

---

## Section R — Après promotion sur `main`

- **R1 — P0.** Le job `🗄️ Apply Migrations (Production)` passe, précédé de son essai à blanc.
  L'ajout de colonne avec valeur par défaut ne réécrit pas la table en PostgreSQL 17, mais prend un
  verrou exclusif bref.
- **R2 — P0.** Vérifier en production la présence de `transaction.source_savings_goal_id`,
  `savings_goal.balance_revision` et du déclencheur portant sur `initial_amount, start_date`
  (requête de la précondition P1).
- **R3 — P1.** Mettre à jour `LATEST_WEB_VERSION` et `LATEST_IOS_VERSION` sur Railway, dans les deux
  environnements. Ils valent aujourd'hui `0.43.0` / `1.3.0` sur preview ; ce sont eux qui pilotent la
  bannière de mise à jour.
- **R4 — P1.** Rejouer W1, W4 et W6 en production, sur un objectif de test créé pour l'occasion puis
  supprimé.

---

## Récapitulatif de priorisation

| Priorité | Scénarios |
| --- | --- |
| **P0** — bloquants | S1, S2, S3, S5, W2, W5, W6, I1, I2, I4, I6, R1, R2 |
| **P1** — à corriger si possible | S4, S6, W1, W3, W4, W7, W8, W9, W10, I3, I5, R3, R4 |
| **P2** — à consigner | W11 |

Le chemin le plus court vers une décision de release : P1 de préconditions, puis S1 → S2 → S3 →
W5 → W6 → I1 → I6. Si ces huit passent, le reste relève du confort.
