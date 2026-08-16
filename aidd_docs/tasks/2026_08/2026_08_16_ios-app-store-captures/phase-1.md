---
status: done
---

# Instruction: Préparer la session locale déterministe

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── aucun fichier du dépôt — services, build, simulateur et session NoQA uniquement
```

## User Journey

```mermaid
flowchart TD
  A[Supabase local et backend disponibles] --> B[PulpeLocal construit pour le simulateur]
  B --> C[Application installée sur iPhone 17 Pro Max]
  C --> D[NoQA connecté au simulateur]
  D --> E[Connexion avec le compte démo]
  E --> F[Accueil chargé avec les données seedées]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Vérifier Supabase local et le simulateur iPhone 17 Pro Max => services et appareil disponibles: 5: cli
    Construire et installer PulpeLocal => app app.pulpe.ios installée sans modifier les sources: 5: cli
  section Happy path
    Connecter NoQA puis saisir le compte démo et le PIN => Accueil authentifié avec données seedées: 5: cli
  section Edge case - seed absent ou obsolète
    Connexion ou contenu attendu absent => réinitialiser uniquement Supabase local via bun run supabase:reset => compte et données restaurés: 1: cli
```

## Tasks to do

### `1)` Stabiliser les services locaux

> Utiliser le seed local existant sans toucher à une base liée.

1. Confirmer que Supabase répond dans `backend-nest/` et que l’API backend écoute sur `127.0.0.1:3000`.
2. Démarrer le backend si nécessaire.
3. Ne lancer `bun run supabase:reset` que si la connexion démo ou les données attendues échouent ; ne jamais utiliser `db reset` ni une commande destructive sur une base liée.

### `2)` Construire et installer PulpeLocal

> Réutiliser le projet Xcode et le schéma existants.

1. Construire `PulpeLocal` en Debug pour `iphonesimulator`, destination `AAF01FC0-2FE7-4357-8CCA-0AC250788542`.
2. Désinstaller uniquement `app.pulpe.ios` du simulateur pour effacer une ancienne session, puis installer le `.app` produit.
3. Lancer en français (`fr_CH`) et en apparence claire.

### `3)` Ouvrir la session démo avec NoQA

> Piloter l’interface par inspection avant chaque action.

1. Ouvrir l’application NoQA, vérifier l’authentification du compte NoQA et connecter l’iPhone 17 Pro Max.
2. Inspecter l’écran avec `noqa screen`, saisir `demo@pulpe.test` et le mot de passe local du seed, puis valider.
3. Saisir le PIN local du seed si le flux le demande et fermer uniquement les écrans d’introduction qui masquent les vues à photographier.
4. Confirmer que l’Accueil, les budgets 2026, les deux modèles et les trois objectifs sont chargés.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Supabase local et l’API répondent ; aucune base liée n’a subi de commande destructive |
| 2 | `app.pulpe.ios` démarre sur l’iPhone 17 Pro Max iOS 26.5 en français et en mode clair |
| 3 | NoQA est connecté et l’Accueil authentifié affiche les données du compte démo, sans onboarding ni verrou bloquant |
