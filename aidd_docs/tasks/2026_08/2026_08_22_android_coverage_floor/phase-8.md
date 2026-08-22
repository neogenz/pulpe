---
status: pending
---

# Instruction: Couvrir la sécurité du compte et poser le plancher de sortie

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
android/
├── jest.config.js                                           ✏️ poser le dernier plancher mesuré
└── src/features/account/security-settings-screen.spec.tsx  ✅ rendre biométrie sortie et suppression de compte
```

## User Journey

```mermaid
flowchart TD
  Security[Ouvrir Sécurité] --> Choice{Action}
  Choice --> Biometrics[Activer ou retirer biométrie]
  Choice --> Password[Changer mot de passe]
  Choice --> SignOut[Se déconnecter]
  Choice --> Delete[Confirmer suppression du compte]
  Delete --> Result[Session purgée ou erreur visible]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Rendre profil coffre biométrie et mutations contrôlés => actions de sécurité disponibles: 5: system
  section Happy path
    Confirmer biométrie sortie ou suppression => action unique et état final observable: 5: system
  section Edge case - authentification
    Échouer vérification mot de passe ou biométrie => aucune action destructive et erreur visible: 1: system
  section Edge case - écriture
    Ralentir ou rejeter la suppression => contrôles bloqués puis réessayables sans sortie locale: 1: system
```

## Tasks to do

### `1)` Rendre les actions sensibles de sécurité

1. Couvrir disponibilité biométrique, activation, désactivation, changement de mot de passe et déconnexion.
2. Couvrir confirmation mot de passe, suppression de compte, succès, rejet et prévention du double-submit.

### `2)` Poser le plancher de sortie

1. Exécuter la suite complète, relever chaque métrique globale à son plancher entier final et conserver tous les seuils ciblés.
2. Vérifier qu’aucune exclusion de production, snapshot ou lecture de source n’a été ajoutée dans les nouvelles specs.
3. Conserver la couverture comme sortie du test CI existant, sans nouveau job ni reporter.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                    |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Une action sensible exige sa confirmation, ne part qu’une fois et laisse une issue récupérable après rejet.                            |
| 2    | Les quatre seuils globaux finaux sont supérieurs à 36/32/30/35, aucun seuil ciblé ne baisse et `pnpm test:unit` les impose dans la CI. |
