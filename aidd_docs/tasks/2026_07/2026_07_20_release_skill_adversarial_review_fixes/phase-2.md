---
status: done
---

# Instruction: Enregistrer explicitement les releases iOS silencieuses

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.claude/skills/release/
├── SKILL.md ✏️ maintenir et stage le registre du mode silent
├── references/
│   └── ios-release.md ✏️ documenter le contrat persistant du mode silent
└── scripts/
    └── validate-ios-release.ts ✏️ valider le registre selon le mode choisi
backend-nest/src/modules/whats-new/domain/
├── releases-data.ts ✏️ exposer les silences iOS motivés
└── releases-data.parity.spec.ts ✏️ imposer projection XOR silence explicite
```

## Tasks to do

### `1)` Persister le choix silencieux

1. Ajouter à côté de `RELEASES` un registre iOS silencieux typé avec `version` et `reason`.
2. Garder le registre vide tant qu'aucune release existante n'est silencieuse.
3. Pour une release landing avec version marketing iOS, exiger exactement une projection ou une entrée silencieuse.
4. Refuser doublon, raison vide, version invalide, chevauchement projection/silence et silence orphelin.

### `2)` Aligner le workflow et son validateur

1. En mode `silent`, faire écrire une raison concrète dans le registre par le Step 5b-bis.
2. En modes `projection`, `build` et `skip`, garantir l'absence d'entrée silencieuse pour la version courante.
3. Faire valider ce contrat par `validate-ios-release.ts`.
4. Stage `releases-data.ts` lorsqu'une projection ou un silence explicite y est enregistré.

### `3)` Prouver les deux branches du contrat

1. Reproduire l'oubli actuel en retirant temporairement une projection existante.
2. Vérifier que le nouveau test échoue sans silence déclaré.
3. Déclarer temporairement un silence motivé et vérifier que le même scénario passe.
4. Restaurer les données publiées avant la validation finale.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 1    | Toute release landing avec version marketing iOS choisit exactement une projection ou un silence explicite et motivé     |
| 2    | Le validateur de release accepte uniquement le registre correspondant au mode approuvé                                    |
| 3    | La suppression temporaire de `0.37.0` échoue sans registre, passe avec un silence valide, puis les données sont restaurées |
