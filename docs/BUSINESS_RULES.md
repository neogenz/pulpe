# Règles métier transverses

Ce fichier contient uniquement les invariants qui traversent plusieurs fonctionnalités. Les détails restent dans les calculateurs et les documents spécialisés liés ci-dessous.

## Prévisions, Réels et enveloppes

- Une `budget_line` est une **Prévision** ; une `transaction` est un **Réel**. Un Réel s'ajoute normalement aux Prévisions.
- Un Réel alloué à une Prévision est couvert par son enveloppe : le total effectif vaut `max(montant prévu, somme des Réels de même nature)`. Un Réel libre impacte directement le budget.
- Un Réel alloué porte toujours la nature de sa Prévision. Changer la nature de la Prévision (édition, retour au Mois Type ou propagation) change celle de ses Réels alloués dans la même écriture, via le trigger [`align_allocated_transaction_kind`](../backend-nest/supabase/migrations/20261022140000_align_allocated_transaction_kind.sql).
- Les formules canoniques vivent dans [`shared/src/calculators/budget-formulas.ts`](../shared/src/calculators/budget-formulas.ts) et leur miroir Swift dans [`ios/Pulpe/Domain/Formulas/BudgetFormulas.swift`](../ios/Pulpe/Domain/Formulas/BudgetFormulas.swift).

## Continuité mensuelle

- Un budget mensuel généré depuis le Mois Type reste modifiable indépendamment.
- `monthly_budget.ending_balance` stocke le delta du mois. Le report d'un mois cumule les deltas antérieurs, y compris les déficits ; le disponible ajoute ce report aux revenus du mois.
- Le calcul et ses gardes de non-double-comptage vivent dans [`shared/src/calculators/budget-formulas.ts`](../shared/src/calculators/budget-formulas.ts).

## Propagation du Mois Type

- Une propagation explicite sélectionne les budgets du cycle courant et des cycles futurs dans [`BulkTemplateLineOperationsUseCase.fetchPropagationBudgets`](../backend-nest/src/modules/budget-template/application/bulk-template-line-operations.use-case.ts), avant l'appel SQL.
- Une propagation peut être bornée à une plage de mois ; la plage restreint cette sélection, elle ne l'étend jamais aux cycles passés.
- Une Prévision modifiée manuellement porte `is_manually_adjusted = true` et n'est plus écrasée ni supprimée par la propagation du Mois Type.
- Le repository appelle la RPC courante [`apply_template_line_operations_with_tags`](../backend-nest/src/modules/budget-template/infrastructure/persistence/supabase-budget-template.repository.ts). Les mutations du Mois Type, des Prévisions sélectionnées et de leurs tags sont atomiques dans son [wrapper SQL](../backend-nest/supabase/migrations/20260715150000_atomic_template_line_operations_with_tags.sql) ; le filtre `is_manually_adjusted` vit dans la [définition courante de la RPC de base](../backend-nest/supabase/migrations/20260727122000_bound_updated_template_goal_links.sql). L'invalidation du cache et les recalculs ont lieu après cette transaction.

## Lissage

- Un lissage matérialise des Prévisions `one_off` indépendantes dont la somme conserve le montant demandé.
- Lisser explicitement un Réel libre est l'unique exception au modèle additif : le Réel source est remplacé atomiquement par les Prévisions lissées afin d'éviter le double comptage.
- Le contrat complet vit dans [`docs/SPREAD.md`](./SPREAD.md).

## Suppression d'un mois

- Seul un mois situé après la période courante peut être supprimé. La période courante tient compte du jour de paie et s'appuie sur la date du calendrier `Europe/Zurich`. Le mois courant et les mois passés sont refusés (409 `ERR_BUDGET_NOT_DELETABLE`).
- Les Prévisions et les Mouvements du mois partent avec lui, ainsi que leurs liens de tags. Les tags eux-mêmes restent.
- Les autres mois gardent leur part d'une prévision lissée, d'un objectif d'épargne ou d'un retrait d'épargne.
- Le report n'a pas à être recalculé : il se déduit à la lecture du `ending_balance` de chaque mois.
- Un mois lié à d'autres mois ou à un objectif d'épargne n'est supprimé qu'avec `confirmLinks=true`. Sans cette confirmation, le serveur répond 409 `ERR_BUDGET_DELETION_LINKS_UNCONFIRMED`, détaille les liens et ne supprime rien. `GET /v1/budgets/:id/deletion-impact` liste ce que la suppression emporte, sans rien modifier.
- La règle vit dans [`budget-deletion.ts`](../backend-nest/src/modules/budget/domain/budget-deletion.ts) (garde `assertDeletableMonth`) et [`remove-budget.use-case.ts`](../backend-nest/src/modules/budget/application/remove-budget.use-case.ts).

## Import d'un export bancaire

- Un import part d'un fichier choisi par l'utilisateur et ne demande aucun accès au compte. Le premier format lu est camt.053 (ISO 20022). Chaque format est un parseur ajouté à `STATEMENT_PARSERS` dans [`transaction-import.module.ts`](../backend-nest/src/modules/transaction-import/transaction-import.module.ts).
- Le serveur relit le fichier à l'aperçu et à la confirmation. Toute erreur bloque l'import entier. Les opérations en attente, hors de la période du budget ou déjà importées sont affichées puis ignorées.
- Pour chaque opération nouvelle, Pulpe suggère au plus une Prévision du budget visé, avec les critères remplis : type compatible (un Revenu pour une entrée d'argent, une Dépense ou une Épargne pour une sortie), montant identique au centime, ou nom de la Prévision présent dans le libellé bancaire. Le libellé pèse plus que le montant, et deux Prévisions à égalité ne donnent aucune suggestion. Les retraits d'objectif d'épargne ne sont jamais proposés. Les règles vivent dans [`transaction-import.matching.ts`](../backend-nest/src/modules/transaction-import/domain/transaction-import.matching.ts).
- Aucune suggestion n'est appliquée d'office. La confirmation crée en une seule requête les opérations nouvelles dans le budget visé : celles que l'utilisateur a explicitement rattachées à une Prévision prennent son type et sont pointées, les autres restent des Réels libres et non pointés. Un rattachement devenu invalide entre l'aperçu et la confirmation refuse tout l'import. L'insertion est entière ou nulle ; les autres règles vivent dans [`transaction-import.formulas.ts`](../backend-nest/src/modules/transaction-import/domain/transaction-import.formulas.ts).
- Une empreinte stable par opération, inscrite dans le registre `transaction_import_fingerprint`, détecte les doublons avant la confirmation ; son unicité fait échouer en bloc un import concurrent. Voir [`docs/ENCRYPTION.md`](./ENCRYPTION.md#empreinte-dimport-bancaire).
- Une opération importée une fois ne l'est plus jamais, même si son Réel est ensuite lissé, reporté ou supprimé ; seule la suppression du budget mensuel qui la porte la libère.

## Patrimoine

- Un `asset` est un compte, un placement ou une dette. Il porte un sens figé à la création, `own` (ce que j'ai) ou `owe` (ce que je dois), et une devise figée elle aussi. Seuls le nom, le type, le lien avec Pulpe et l'archivage se modifient ensuite.
- Sa valeur est une suite de photos datées (`asset_snapshot`, valeur chiffrée) ; la dernière photo est la valeur courante. Mettre à jour une valeur ajoute une photo, elle n'écrase rien. Pour une dette, la valeur est ce qui reste dû.
- Un `own` peut avoir une valeur négative (compte à découvert) : il est alors compté du côté des dettes, à hauteur de sa valeur absolue, et jamais dans le total de son type. Une dette `owe` ne peut pas être négative (400 `ERR_ASSET_VALUE_INVALID`).
- Fortune brute = somme des `own` positifs actifs ; dettes = somme des `owe` actifs et des `own` à découvert ; fortune nette = brute moins dettes. Une fortune nette négative est un état normal, affichée en ton d'avertissement (ambre), jamais en rouge d'erreur.
- Tous ces chiffres, les sous-totaux par type de ce que j'ai et les valeurs converties viennent de [`asset.formulas.ts`](../backend-nest/src/modules/asset/domain/asset.formulas.ts) via `GET /v1/assets`. Les clients n'additionnent rien, à une exception près : l'API ne donne pas de sous-total par type de dette, donc la page et le Sankey additionnent, en centimes entiers, les valeurs converties déjà arrondies par l'API. La somme de ces sous-totaux est égale au total des dettes de l'API.
- La page range ce que je dois par type, comme ce que j'ai. Les comptes à découvert gardent leur type mais sont réunis sous « Découverts » du côté des dettes, sur la page comme dans le Sankey. Le Sankey part des types, sans dessiner les éléments, et ne s'affiche pas quand il n'y a rien à répartir (un seul type et aucune dette).
- Exception à la règle du taux historique ci-dessous : une valeur en devise étrangère est convertie au taux du jour à chaque lecture. Si le taux manque, l'élément sort des totaux et la réponse porte `incomplete = true` ; la page le dit, plutôt que d'afficher un total silencieusement trop bas.
- Un élément archivé garde son historique et sort des totaux (sa valeur convertie reste lisible). Il se désarchive ou se supprime ; supprimer emporte tout son historique.
- Un élément est rangé dans un type (`asset_category`). Un type naît avec son premier élément, se renomme, et reste masqué tant qu'aucun élément ne l'utilise : le choisir ou saisir son nom le réutilise au lieu d'en créer un second. Les noms de départ ne sont que des suggestions traduites, proposées selon le sens tant qu'aucun type affiché ne porte déjà ce nom : Comptes, Épargne, Placements, Cash, Objets de valeur, Biens pour ce que j'ai ; Crédit, Hypothèque, Leasing, Carte de crédit pour ce que je dois. Un type n'a pas de sens propre : il s'affiche du côté où se trouvent ses éléments. Supprimer un type qui contient encore un élément, archivé compris, est refusé (clé étrangère `RESTRICT`).
- Une seule feuille crée et modifie un élément : son nom, son type et sa valeur du jour. À la création comme ensuite, la valeur se saisit en positif et la case « Solde négatif (découvert) », réservée à un `own`, porte le signe. En modification, seul ce qui a changé part : le nom et le type dans un `PATCH`, la valeur dans une nouvelle photo.
- Le rapprochement des comptes suit les comptes avec lesquels je le termine (`inPulpe`), derrière le flag `net_worth`. Chaque ligne choisit un de mes `own` actifs dans la devise du budget, ou « Autre compte… ». Terminer écrit une photo pour chaque compte choisi qui a un solde et commence à suivre celui qui ne l'était pas ; un compte suivi qui n'a plus de ligne cesse d'être suivi, sans être supprimé ni recevoir de photo. Une ligne libre reste privée, sauf si « Ajouter à Mon patrimoine » est coché : elle crée alors un `own` suivi dans le type « Comptes », avec son solde comme première valeur. Annuler ou fermer n'écrit rien. Les comptes suivis préremplissent le rapprochement suivant.
- La page est derrière le flag `net_worth` : l'entrée du menu disparaît flag éteint, mais la route `/net-worth` reste ouverte par son URL.
- Une Prévision (et la ligne de modèle qui la génère) peut être liée à un élément du patrimoine (`asset_id`), selon son type : une Épargne ne se lie qu'à un `own`, une Dépense qu'à un `owe` (une dette qu'elle rembourse, jamais un compte), un Revenu à un `own` (uniquement par l'origine « Tiré de mon patrimoine »). Le trigger de la base refuse tout autre couple et l'élément d'un autre utilisateur ; les clients ne proposent que les éléments actifs du bon sens, derrière le flag `net_worth`.
- Changer le type d'une Prévision sans lui donner de nouvel élément coupe le lien ; une mise à jour qui ne porte pas `assetId` le garde. Supprimer l'élément garde ses Prévisions et remet leur `asset_id` à `null` ; l'archiver garde le lien.
- Ce lien est indépendant de l'objectif d'épargne : une Épargne peut porter les deux, aucun ne déduit ni ne remplace l'autre.
- Un Revenu peut être tiré d'un `own` (origine « Tiré de mon patrimoine », derrière le flag et s'il existe un élément actif) : une fois pointé, il baisse la valeur proposée de cet élément. L'origine se fixe à la création, la modification la montre en lecture seule, et elle exclut l'origine objectif d'épargne : une requête ne porte jamais les deux.
- Les Prévisions pointées et liées à un élément actif proposent une nouvelle valeur (`suggestion`, `GET /v1/assets`). Seules comptent celles pointées après la dernière photo ou le dernier « Écarter ». Une Épargne sur un `own` ajoute son montant, un Revenu tiré d'un `own` le retire, une Dépense sur une dette baisse ce qu'il reste dû. Une dette ne descend jamais sous zéro. Le delta est converti dans la devise de l'élément au taux du jour ; sans taux, ou pour un élément archivé, il n'y a pas de suggestion.
- « Appliquer » enregistre une photo à la valeur proposée ; « Écarter » oublie les mouvements déjà pointés (`suggestion_dismissed_at`), seuls ceux pointés ensuite comptent. Un mouvement dépointé puis repointé après un « Appliquer » compte de nouveau : plafond accepté, le serveur ne garde pas la liste des mouvements déjà appliqués.

## Montants et devises

- Toute décision financière compare un écart quantifié au centime. La présentation dépend du rôle du montant : jusqu'à deux décimales lorsqu'il justifie un état ou une action, format compact pour un agrégat de lecture rapide. Les pourcentages entiers restent indicatifs et ne décident jamais seuls d'un état monétaire.
- Les arrondis intentionnels restent inchangés : répartition au plus grand reste, lissage à somme conservée, conversion FX à deux décimales, mensualité arrondie au centime supérieur et agrégats visuels compacts.
- Tous les montants financiers persistés, dont `amount`, `target_amount`, `initial_amount`, `original_amount`, `original_target_amount` et `ending_balance`, passent par `ENCRYPTION_PORT` et sont stockés chiffrés en AES-256-GCM. Voir [`docs/ENCRYPTION.md`](./ENCRYPTION.md).
- Une conversion conserve avec l'écriture son montant d'origine, ses devises et son taux. Ce taux est historique : il n'est pas rafraîchi ensuite. Seul le [Patrimoine](#patrimoine) convertit au taux du jour. Les métadonnées FX sont absentes ensemble ou cohérentes ensemble, conformément aux schémas partagés et à la contrainte [`fx_metadata_coherent`](../backend-nest/supabase/migrations/20260420120000_fx_metadata_coherent.sql).
