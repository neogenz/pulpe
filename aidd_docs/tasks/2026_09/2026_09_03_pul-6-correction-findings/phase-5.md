---
status: done
---

# Instruction: Tolérer la concurrence avec la création simple

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
└── backend-nest/supabase/
    ├── migrations/20260901120000_generate_budgets_atomically.sql  ✏️ traite le conflit de période comme un skip concurrent
    └── tests/generate_budgets_atomically.sql                       ✏️ verrouille le traitement ciblé de la contrainte unique
```

## User Journey

```mermaid
flowchart TD
  A[Génération par lot vérifie une période absente] --> B[Création simple insère la même période]
  B --> C[La contrainte unique refuse l'insertion du lot]
  C --> D[Le lot classe uniquement ce conflit comme mois ignoré]
  D --> E[Les autres mois continuent et la réponse reste complète]
```

## Test Scope

```mermaid
---
title: Test scope
---
journey
  section Setup
    Charger les fonctions SQL PUL-6 et la contrainte de période => contrats disponibles: 5: api
  section Happy path
    La contrainte de période gagne après le contrôle initial => le mois est ajouté aux skips et le lot continue: 5: api
  section Edge case - autre unicité
    Une autre contrainte unique échoue => l'erreur est propagée et la transaction du lot est annulée: 1: api
  section Regression
    Inspecter la définition déployée => le handler cible explicitement unique_month_year_per_user: 5: api
```

## Tasks to do

### `1)` Cibler le conflit de période

> La contrainte existante décide du gagnant sans élargir le verrouillage.

1. Encadrer l'appel feuille dans un sous-bloc PL/pgSQL qui intercepte `unique_violation`.
2. Lire le nom de contrainte et convertir uniquement `unique_month_year_per_user` en entrée `skipped_months`.
3. Relancer toute autre violation afin de conserver le rollback atomique.

### `2)` Verrouiller la régression

> Le test échoue si le conflit redevient une erreur globale ou si le handler devient trop large.

1. Vérifier dans la définition de fonction déployée la présence du ciblage explicite de `unique_month_year_per_user`.
2. Conserver les preuves existantes de rollback tardif, de verrou utilisateur et d'ordre chronologique.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Une création simple concurrente de la même période ne fait plus échouer le lot; le mois est signalé comme ignoré et les autres périodes continuent. |
| 2 | Seul le conflit `unique_month_year_per_user` devient un skip; toute autre erreur conserve l'annulation complète du lot. |
