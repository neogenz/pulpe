---
status: done
---

# Instruction: Suppression des règles mortes

Quatre fichiers dont le contenu est soit inatteignable, soit fictif, soit un sous-ensemble strict d'un autre. **434 lignes, risque nul.** Plus la couche `styles/`, inventée et propagée dans 7 fichiers.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.claude/rules/
├── 00-architecture/
│   ├── angular-architecture.md                      ❌ glob mort (0 match), 126 l
│   ├── layer-styles.md                              ❌ couche inexistante, 62 l
│   ├── layer-core.md                                ✏️ retirer styles/ du graphe
│   ├── layer-feature.md                             ✏️ retirer styles/ du graphe
│   ├── layer-layout.md                              ✏️ retirer styles/ du graphe
│   ├── layer-pattern.md                             ✏️ retirer styles/ du graphe
│   └── layer-ui.md                                  ✏️ retirer styles/ du graphe
├── 05-workflows-and-processes/
│   └── error-handling.md                            ❌ glob mort + module fictif, 211 l
└── 06-templates-and-models/
    └── material-buttons.md                          ❌ sous-ensemble de angular-material-22.md, 35 l

aidd_docs/memory/
├── codebase-map.md                                  ✏️ purger les liens vers les 2 règles supprimées
└── architecture.md                                  ✏️ purger les liens vers les 2 règles supprimées
```

## Tasks to do

### `1)` Supprimer `error-handling.md`

> 211 lignes de fiction. La plus grosse suppression du plan.

1. Vérifier avant de supprimer : le glob `frontend/**/core/error-handling/**/*.ts` matche **0 fichier** ; `frontend/projects/webapp/src/app/core/` ne contient pas de dossier `error-handling`.
2. Vérifier que le module décrit (`FatalError` / `OperationalError` / `BusinessError` + intégration d'observabilité) n'existe nulle part dans le repo. Si un équivalent existe sous un autre nom, s'arrêter et le signaler plutôt que supprimer.
3. Supprimer le fichier avec `trash`, jamais `rm -r`.
4. Purger les 2 références entrantes dans `aidd_docs/memory/`.

### `2)` Supprimer `angular-architecture.md`

1. Vérifier : `paths: "frontend/src/**/*"` alors que la racine réelle est `frontend/projects/webapp/src/`. C'est la seule des règles frontend à ne pas utiliser la forme `frontend/**/`. 0 match.
2. Avant de supprimer, confronter son graphe de dépendances (lignes 39-72) aux six `layer-*.md` : ne supprimer que si chaque arête y figure déjà. Sinon, porter l'arête manquante dans `layer-core.md` d'abord.
3. Supprimer, purger les références entrantes.

### `3)` Supprimer `layer-styles.md` et la couche `styles/`

> Couche inventée, propagée par répétition dans 7 fichiers.

1. Vérifier : `frontend/eslint.config.js` définit 18 element types dans `boundaries/elements` — `shared, main, app, core, ui, layout, pattern, feature-routes, feature, env, lib-api, lib, test-config, e2e-config, e2e, script, test-spec, testing`. Aucun `styles`. Le dossier `app/styles/` ne contient que 11 `.scss` et 1 `.css`, zéro TypeScript : c'est un dossier d'assets, pas une couche de dépendance.
2. Le fichier l'admet déjà à demi-mot ligne 10 (« This is an **optional layer**… Not all projects require a `styles/` dependency layer »).
3. Supprimer le fichier.
4. Retirer `styles/` des graphes de dépendances de `layer-core.md`, `layer-feature.md`, `layer-layout.md`, `layer-pattern.md`, `layer-ui.md`. Exemple à corriger : `layer-core.md:17` « Can ONLY import from `styles/` ».

### `4)` Supprimer `material-buttons.md`

1. Vérifier que ses 35 lignes sont un sous-ensemble strict de `angular-material-22.md`. Toute directive absente de la cible est portée dedans avant suppression.
2. Supprimer.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `error-handling.md` n'existe plus ; aucun fichier du repo n'y renvoie ; aucune règle survivante ne mentionne `FatalError` / `OperationalError`     |
| 2    | `angular-architecture.md` n'existe plus ; chaque arête de son graphe est retrouvable dans un `layer-*.md`                                          |
| 3    | `grep -ril "styles/" .claude/rules/00-architecture/` ne renvoie plus aucun fichier décrivant `styles/` comme couche de dépendance                  |
| 4    | `material-buttons.md` n'existe plus ; les directives qu'il portait sont dans `angular-material-22.md`                                              |
| —    | Le scan de globs morts ne signale plus aucune règle à 0 match                                                                                     |
| —    | `.claude/rules/` compte 44 fichiers pour ~6 322 lignes, contre 48 / 6 756                                                                          |
| —    | Aucune suppression n'a utilisé `rm -r` ni `rm -rf`                                                                                                |
