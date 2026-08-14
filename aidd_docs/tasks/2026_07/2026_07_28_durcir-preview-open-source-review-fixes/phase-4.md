---
status: done
---

# Instruction: Réparer les contrats publics et valider l’ensemble

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .github/scripts/public-surface.test.mjs ✏️
├── docs/CI.md ✏️
└── landing/app/support/page.tsx ✏️
```

## Tasks to do

### `1)` Ne contrôler que la surface suivie par Git

> Un dump local ignoré ne fait pas partie du dépôt public et ne doit pas casser `pnpm quality`.

1. Remplacer le test d’existence de `backend-nest/schema.sql` par une assertion `git ls-files` vide sur ce chemin.
2. Conserver l’assertion `.gitignore` et toutes les autres sentinelles de noms privés, chemins locaux, permissions et claims.
3. Exécuter le test une fois sans dump puis avec un `backend-nest/schema.sql` local ignoré; les deux passages doivent réussir.

### `2)` Borner la promesse de confidentialité de la landing

> Ne pas contredire la télémétrie identifiée assumée.

1. Remplacer « tes données ne sortent jamais de ton compte » par une phrase limitée aux montants et libellés financiers non transmis à des fins publicitaires ni revendus.
2. Conserver la description split-key et AES-256-GCM déjà revue.
3. Ajouter au test de surface publique une assertion contre l’ancienne promesse absolue et une assertion sur la nouvelle formulation bornée.

### `3)` Synchroniser la documentation CI

> Les valeurs copiées du workflow doivent être exactes.

1. Aligner `pull-requests` sur `write`.
2. Aligner `NODE_VERSION` sur `24`.
3. Ne modifier aucune permission, version ou étape du workflow lui-même.

### `4)` Passer les gates ciblés puis globaux

> Fermer les findings sans introduire de régression inter-plateforme.

1. Exécuter les specs backend ciblées du chiffrement, de la suppression et de la redaction.
2. Exécuter les tests Angular ciblés du setup de coffre et du sanitizer PostHog.
3. Exécuter les tests Swift ciblés du setup PIN et du sanitizer analytics.
4. Exécuter `node --test .github/scripts/public-surface.test.mjs`, puis `pnpm quality` et `pnpm test`.
5. Relancer `aidd-dev:05-review` sur l’ensemble du diff de remédiation; aucun finding critique ou warning de la revue source ne doit rester ouvert.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le test de surface réussit avec ou sans dump local ignoré et échoue si `backend-nest/schema.sql` devient suivi. |
| 2 | La landing ne contient plus de promesse générale d’absence de partage et décrit précisément la protection des données financières. |
| 3 | `docs/CI.md` annonce `pull-requests: write` et Node 24, identiques au workflow courant. |
| 4 | Les tests ciblés web, backend et iOS passent, suivis de `pnpm quality`, `pnpm test` et du test public-surface. |
| 4 | La nouvelle review confirme la fermeture des 2 critical et 11 warning sans nouvelle régression critique ou warning. |
