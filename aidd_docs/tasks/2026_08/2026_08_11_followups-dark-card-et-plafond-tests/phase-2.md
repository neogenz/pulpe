---
status: done
---

# Instruction: découper les deux structs de test hors cap

Deux suites Swift Testing dépassent le plafond `type_body_length` (300 lignes de corps), ce qui
fait échouer `swiftlint --strict` et bloque tout commit qui les stage :

| Fichier                                        | Corps | Fichier |
| ---------------------------------------------- | ----- | ------- |
| `BudgetDetailsScreenStateProjectionTests.swift` | 324   | 432     |
| `BudgetLineSpreadRequestTests.swift`            | 310   | 465     |

Les deux portent déjà des `// MARK:` thématiques : les coutures existent, il n'y a qu'à couper
dessus. **Aucune assertion ne change.** Le découpage est mécanique ; s'il modifie un
comportement, c'est qu'il a dérapé.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── ios/PulpeTests/
    ├── Features/Budgets/BudgetDetails/Projection/
    │   ├── BudgetDetailsScreenStateProjectionTests.swift  ✏️  garde forme, filtres, recherche, index, pager, libres
    │   ├── BudgetDetailsCheckedProjectionTests.swift      ✅  hash de tick + état « Tout est pointé »
    │   └── ProjectionTestStack.swift                      ✅  helpers partagés par les deux suites
    └── Domain/Services/
        ├── BudgetLineSpreadRequestTests.swift             ✏️  ce qui part sur le fil
        ├── BudgetLineSpreadResponseTests.swift            ✅  ce qui revient (décodage)
        └── BudgetLineSpreadTestFixtures.swift             ✅  APIClient de test, JSON, enregistreur
```

## Tasks to do

### `1)` Fixer la référence sur ce qui se recompte depuis git

> Sans référence, un découpage qui perd une suite entière passe pour un succès. Un compte de
> tests exécutés ne se relève plus après coup — l'ensemble des `@Test`, si.

1. Comparer l'ensemble des fonctions annotées `@Test` des quatre fichiers entre le commit de
   découpage et son parent : le découpage est un déplacement, donc les deux ensembles sont
   égaux, nom pour nom.
2. Mesuré sur `06bce3465` et son parent — projection **17 → 10 + 7**, spread **8 → 6 + 2**,
   soit les mêmes 25 `@Test` de part et d'autre.
3. Un `-only-testing:` qui ne matche rien affiche `** TEST SUCCEEDED **` avec zéro test : à
   l'exécution, c'est le compte exécuté qui fait foi, jamais le marqueur. C'est ce qui rend un
   compte relevé sur le moment invérifiable plus tard, et l'égalité des `@Test` vérifiable à
   n'importe quel moment.

### `2)` Extraire les helpers partagés

> Deux suites ne peuvent pas se partager des `private func` restés dans l'une d'elles.

1. Sortir `resetEnvironment()`, `makeStores(...)` et `checkedTickHash(for:)` vers
   `ProjectionTestStack.swift`.
2. Sortir `makeAPIClient()`, `successResponseData()`, `responseDataNoSkips()`, `lineJSON(...)`,
   `budgetJSON(...)` et la classe d'enregistrement des requêtes vers `BudgetLineSpreadTestFixtures.swift`.
3. Ne pas les rendre plus visibles que nécessaire, et ne pas en profiter pour les « améliorer ».

### `3)` Couper sur les MARK

> Une suite par thème, le thème étant celui que le fichier annonçait déjà.

1. Projection — laisser dans le fichier d'origine : forme de base, filtres, recherche,
   lookups indexés, pager, transactions libres. Déplacer vers `BudgetDetailsCheckedProjectionTests.swift`
   les 4 tests de hash de tick et les 3 de l'état « Tout est pointé » : tous parlent du pointage.
2. Spread — laisser dans le fichier d'origine ce qui décrit la requête (corps, `kind`, FX gelé,
   mode total, clé d'idempotence). Déplacer vers `BudgetLineSpreadResponseTests.swift` les 2
   tests de décodage de réponse.
3. Reporter `.serialized` sur chaque nouvelle suite : les suites d'origine le portent, et
   l'omettre les ferait tourner en parallèle contre un environnement partagé.
4. Donner à chaque nouvelle suite un `@Suite` dont le nom dit le thème.

### `4)` Vérification

1. `xcodegen generate --use-cache` — obligatoire, trois fichiers sont créés.
2. Relancer les deux dossiers de tests et comparer le compte exécuté à celui de la tâche 1.
3. `swiftlint lint --strict` et confirmer qu'aucun `type_body_length` ne subsiste dans `ios/PulpeTests/`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | L'ensemble des `@Test` est identique avant et après le découpage, recomptable depuis git seul : 17 → 10 + 7 et 8 → 6 + 2 sur `06bce3465`. |
| 2    | Aucun helper n'est dupliqué entre deux fichiers ; chacun n'existe qu'à un seul endroit.                                                |
| 3    | Chaque nouvelle suite porte `.serialized`, et le diff ne contient aucune modification d'assertion — uniquement des déplacements.        |
| 4    | Le compte de tests exécutés après découpage est **identique** à celui de la tâche 1, et `swiftlint --strict` ne rapporte plus aucun `type_body_length` dans `ios/PulpeTests/`. |
