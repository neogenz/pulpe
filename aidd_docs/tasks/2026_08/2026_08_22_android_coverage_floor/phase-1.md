---
status: done
---

# Instruction: Verrouiller immédiatement le baseline réel

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
android/
└── jest.config.js ✏️ aligner les seuils globaux sur la mesure complète actuelle
```

## User Journey

```mermaid
flowchart TD
  Change[Changement Android] --> Jest[Suite Jest complète]
  Jest --> Measure[Mesure des quatre métriques]
  Measure --> Gate[Seuil global aligné]
  Gate --> CI[Régression refusée en CI]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Exécuter les 110 suites avec tout src instrumenté => baseline complète disponible: 5: cli
  section Happy path
    Appliquer les seuils entiers observés => suite complète toujours verte: 5: cli
  section Edge case - régression
    Retirer temporairement une branche couverte => Jest refuse la métrique passée sous le seuil: 1: cli
```

## Tasks to do

### `1)` Fermer l’écart entre mesure et seuil

1. Garder le dénominateur `src/**/*.{ts,tsx}` et ses exclusions actuelles.
2. Mesurer séparément le total brut du rapport et la population effective de `global`, qui exclut les fichiers possédant un seuil ciblé, puis appliquer `floor(mesure effective)`.
3. Ne pas modifier les seuils ciblés de `session-store`, `vault-store` et `api-client`.

### `2)` Définir la règle de ratchet des phases suivantes

1. Après chaque phase, exécuter la suite complète et relever chaque seuil à `floor(mesure effective de global)` seulement si la valeur augmente.
2. Refuser toute baisse de métrique, exclusion de production ou test source ajouté pour atteindre le seuil.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Le total brut 36,33/32,90/30,13/35,99 est reporté séparément et le seuil `global` correspond au plancher entier de sa population effective. |
| 2    | Une couverture sous chaque plancher effectif échoue, tandis que les trois seuils ciblés critiques conservent leurs valeurs plus exigeantes. |
