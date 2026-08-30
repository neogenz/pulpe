---
status: pending
---

# Instruction: Soumettre exactement iOS 1.4.3 (12)

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── Aucun fichier du dépôt — opérations vérifiées dans TestFlight, PostHog et App Store Connect.
```

## Tasks to do

### `1)` Valider le binaire à publier

> Le build soumis doit rester celui vu sur TestFlight.

1. Rejouer sur le build 12 le geste horizontal de la Home, les carrousels internes et le scroll vertical.
2. Vérifier App Store Connect `1.4.3 (12) = VALID` et l'absence de soumission active.
3. Exécuter la promotion exacte de la phase 2 et vérifier preuve `release`, release PostHog et annotation.

### `2)` Résoudre les captures sans supposition

> Le dossier fourni et App Store Connect ne sont pas identiques.

1. Présenter le constat : mêmes six noms, ordre et dimensions 1320×2868; seule `06_06_confiance.png` est identique, 01-05 diffèrent.
2. Obtenir un choix explicite entre conserver le set App Store actuel ou remplacer 01-05 par le dossier de captures fourni.
3. Relire le set final et son ordre avant soumission.

### `3)` Soumettre la version corrigée

> Changer seulement le build et, si approuvé, les captures.

1. Garder le « What's New » et les autres métadonnées inchangés.
2. Attacher le build 12 à la version 1.4.3, lancer la validation de readiness et refuser tout blocker.
3. Créer la nouvelle soumission, vérifier son état d'attente de review puis, après approbation, confirmer que l'API publique Apple expose 1.4.3.
4. Conserver `landing/data/releases.json` inchangé : l'approbation Apple résout son décalage temporaire.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Le build TestFlight testé est exactement celui couvert par la preuve `release` et PostHog, sans build 13 ni nouvel upload.                             |
| 2    | Le set de six captures visible dans App Store Connect correspond au choix explicite de l'utilisateur, dans le bon ordre et aux bonnes dimensions.      |
| 3    | La soumission Apple référence 1.4.3 (12), conserve le « What's New » et ne contient aucun blocker; la version publique est vérifiée après approbation. |
