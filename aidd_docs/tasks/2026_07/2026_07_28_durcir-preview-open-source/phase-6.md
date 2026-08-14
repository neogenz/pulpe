---
status: done
---

# Instruction: Séparer la CI de la production

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .github
│   ├── actions/setup-supabase-cli/action.yml ✏️
│   ├── scripts/ci-security.test.mjs ✅
│   └── workflows/ci.yml ✏️
├── backend-nest/Dockerfile ✏️
├── docs
    ├── CI.md ✏️
    └── DEPLOYMENT.md ✏️
└── package.json ✏️
```

## Tasks to do

### `1)` Vérifier la CLI Supabase avant exécution

> Lier chaque archive à la version et à l’architecture attendues.

1. Versionner les SHA-256 officiels amd64 et arm64 avec la version CLI.
2. Vérifier l’archive avant extraction et inclure le digest dans la clé de cache.
3. Faire échouer l’action sur digest absent, architecture inconnue ou contenu altéré.

### `2)` Ne plus exposer production au code de PR

> Garder le dry-run, mais seulement après intégration d’un commit fiable.

1. Retirer le job PR `migrate-dryrun` de l’environnement production et du gate `ci-success`.
2. Sur push `main`, exécuter le dry-run dans le job migration juste avant l’application réelle.
3. Conserver l’approbation de l’environnement production et les permissions minimales.

### `3)` Retirer l’installeur Bun inutile du Dockerfile

> Le build de l’image utilise déjà pnpm, Nest CLI et Node.

1. Supprimer `curl | bash`, les paquets d’installation et le PATH Bun.
2. Garder le build Nest et le runtime Node existants.
3. Construire puis démarrer l’image et vérifier le healthcheck.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Une archive Supabase modifiée d’un octet est rejetée avant extraction et avant accès aux secrets. |
| 2 | Aucun workflow `pull_request` n’exécute du code checkouté avec des secrets production; le dry-run précède toujours le push sur `main`. |
| 3 | L’image backend se construit sans télécharger ni installer Bun et démarre avec Node comme auparavant. |
