---
status: done
---

# Instruction: Aligner la doc sur le comportement réel

## Architecture projection

```txt
.
└── docs/
    └── VERSIONING.md                                      ✏️ décrit la pré-chauffe au bootstrap et l'arrêt du retry
```

## Tasks to do

### `1)` Compléter la section « iOS : la version publiée se résout toute seule »

> Le paragraphe ne décrit que le refresh paresseux ; deux comportements ajoutés depuis y manquent.

1. Dire que le lookup tourne une fois au bootstrap, puis paresseusement passé le TTL de 6 h.
2. Dire qu'une `IOS_STORE_URL` sans identifiant App Store produit un seul `warn` et aucun retry, la valeur env étant servie tant que le conteneur vit.
3. Garder le reste du paragraphe intact : timeout 3 s, retry 15 min sur échec réseau, `max(env, App Store)`.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                     |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | Un lecteur de `VERSIONING.md` sait quand le lookup part sans lire le code, y compris au démarrage du conteneur           |
| 1    | Le cas « URL sans identifiant » est documenté comme définitif, distinct du retry 15 min d'un échec réseau                |
| 1    | Aucune affirmation du paragraphe ne contredit `ios-version-gate.service.ts`                                              |
