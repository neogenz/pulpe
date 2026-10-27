---
status: done
---

# Instruction: La règle cesse d'enseigner le défaut

## Architecture projection

```txt
.
├── ✏️ .claude/rules/03-frameworks-and-libraries/angular-store-pattern.md   # l'exemple canonique porte le défaut
└── frontend/projects/webapp/src/app/feature/budget/budget-details/store/
    └── ✏️ budget-details-store-integration.spec.ts                          # une garde couvrant toutes les mutations
```

## Tasks to do

### `1)` Corriger l'exemple que la règle donne à copier

> La règle montre le signal d'erreur agrégeant ressource et mutation, le couple d'écriture qui l'alimente, et deux `catch` de mutation qui s'en servent. Elle désigne de plus ce store comme implémentation de référence. Laissée telle quelle, elle recrée le défaut dans le prochain store.

1. Réécrire le signal d'erreur de l'exemple pour qu'il ne remonte que l'erreur de la ressource.
2. Retirer de l'exemple le champ de message de page et son couple d'écriture.
3. Réécrire les deux `catch` de mutation de l'exemple : rollback, puis motif rendu à l'appelant.
4. Énoncer la règle en une ligne : le signal d'erreur d'un store dit qu'une ressource est indisponible ; l'échec d'une mutation se rend par la valeur de retour.
5. Vérifier que la mention de ce store comme référence reste vraie après les phases 1 et 2.

### `2)` Poser la garde qui fait échouer le retour du défaut

> Cinq mutations sur dix-sept étaient couvertes. C'est ce qui a permis au défaut de survivre à sa première correction.

1. Ajouter une spec unique, paramétrée sur toutes les mutations du store, qui provoque un échec serveur sur chacune.
2. Assertion pour chacune : `error()` reste nul et le motif est rendu par l'appel.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------- |
| 1    | La règle ne montre plus nulle part un signal d'erreur agrégeant ressource et mutation.                            |
| 1    | Un lecteur de la règle sait, sans lire ce store, où doit atterrir l'échec d'une mutation.                         |
| 2    | La spec échoue si une seule mutation du store repose une valeur sur `error()` en cas d'échec.                     |
| 2    | La spec échoue si une mutation ajoutée plus tard n'est pas couverte, plutôt que de l'ignorer en silence.          |
