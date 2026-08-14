---
status: done
---

# Instruction: Trim du signal

Rien ici n'est faux. Tout ici est du volume qui dilue l'attention : du tutoriel de framework que le modèle connaît déjà, et des contraintes que la CI applique déjà. **Aucun risque de correctness — cette phase peut être différée sans conséquence.**

Le critère d'arbitrage, ligne par ligne, est celui de la doc officielle : *« Would removing this cause Claude to make mistakes? If not, cut it. »*

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── frontend/projects/webapp/src/app/
│   ├── core/README.md                                      ✏️ 111 → ~5
│   ├── feature/README.md                                   ✏️ 262 → ~5
│   ├── layout/README.md                                    ✏️ 187 → ~5
│   ├── pattern/README.md                                   ✏️ 294 → ~5
│   └── ui/README.md                                        ✏️ 251 → ~5
└── .claude/rules/
    ├── 00-architecture/
    │   ├── layer-core.md                                   ✏️ devient l'owner du graphe de dépendances
    │   ├── layer-feature.md                                ✏️ retirer le graphe restaté
    │   ├── layer-layout.md                                 ✏️ retirer le graphe restaté
    │   ├── layer-pattern.md                                ✏️ retirer le graphe restaté
    │   └── layer-ui.md                                     ✏️ 156 → ~103
    ├── 01-standards/naming-conventions.md                  ✏️ 149 → ~35
    ├── 02-programming-languages/
    │   ├── swift.md                                        ✏️ 283 → ~90
    │   └── typescript.md                                   ✏️ 115 → ~35
    ├── 03-frameworks-and-libraries/
    │   ├── angular-signals.md                              ✏️ 391 → ~90
    │   ├── angular-store-pattern.md                        ✏️ 373 → ~200
    │   └── swiftui.md                                      ✏️ 377 → ~130
    └── 07-quality-assurance/
        ├── testing-vitest.md                               ✏️ 255 → ~50
        └── testing-swift-testing.md                        ✏️ 274 → ~70
```

## Tasks to do

### `1)` Les 5 READMEs de l'arbre applicatif

> 1 105 lignes exactement, référencées par **aucun** `CLAUDE.md` et **aucune** règle. Doctrine parallèle aux 546 lignes de `layer-*.md`, et divergente.

1. Réduire chacun à ~5 lignes pointant vers la règle correspondante.
2. Ils ne sont pas chargés automatiquement, mais Claude les lit en explorant la couche — et y trouve une doctrine qui contredit les règles.

### `2)` Le graphe de dépendances des couches

> Appliqué mécaniquement par `eslint-plugin-boundaries` (`boundaries.configs.strict`, `default: "disallow"`, 18 element types). Un import illégal ne passe pas la CI.

1. Garder **un** bloc, dans `layer-core.md`, qui cite `frontend/eslint.config.js` comme autorité plutôt que de recopier les arêtes.
2. Retirer le bloc restaté de `layer-feature.md`, `layer-layout.md`, `layer-pattern.md`, `layer-ui.md`.
3. Conserver dans chaque `layer-*.md` ce que lint ne peut pas vérifier : « pas de logique métier dans `ui/` », les critères de placement `ui/` vs `pattern/`, l'a11y, les inputs signals. C'est le contenu qui justifie encore ces fichiers.

### `3)` Les 5 gros fichiers de tutoriel

> Couper le tutoriel de framework, garder le piège maison. Le test : si un modèle compétent le fait déjà sans qu'on le lui dise, ça saute.

1. `angular-signals.md` 391 → ~90 : garder NG1053, `linkedSignal`, `resource`. Supprimer l'initiation aux signals.
2. `swiftui.md` 377 → ~130 : garder hit-areas, sheets, `pulpeBackground()`. Supprimer les bases SwiftUI.
3. `swift.md` 283 → ~90 : supprimer ce que `.swiftlint.yml` applique déjà. Vérifier la config avant de couper.
4. `angular-store-pattern.md` 373 → ~200, après la coupe `freshTime`/`gcTime` de la phase 3.
5. `angular-material-22.md` : conserver la taille après les corrections de la phase 3 — le contenu restant est spécifique à la version installée.

### `4)` Les règles couvertes par l'outillage

1. `naming-conventions.md` 149 → ~35 : supprimer ce qu'eslint applique. Lire `frontend/eslint.config.js` et la config backend avant de couper — ne pas supposer.
2. `typescript.md` 115 → ~35 : garder les ~12 lignes non couvertes par eslint/tsc. Le reste est soit appliqué, soit une convention standard que le modèle connaît.
3. `testing-vitest.md` 255 → ~50 : garder les pièges maison (`createMockDataCache`, le discriminant d'injector via `fixture.debugElement.injector.get()`). Supprimer le tutoriel TestBed.
4. `testing-swift-testing.md` 274 → ~70, après la correction XCTest de la phase 3.
5. `layer-ui.md` 156 → ~103. **Ne pas descendre à 40** : la cible basse supprimait des règles vivantes sur l'a11y et les inputs signals.

### `5)` Vérification finale du corpus

1. Rejouer le scan de globs morts et le scan de chemins morts : zéro signalement attendu.
2. Rejouer le contrôle d'intégrité de `MEMORY.md` : zéro orphelin, zéro wikilink mort.
3. Ouvrir une session sur un fichier `.swift`, une sur un `frontend/**/feature/**/*.ts`, une sur un `backend-nest/src/**/*.ts`, et relever le contexte réellement chargé via `/context`.
4. Ne **pas** passer prettier sur `.claude/**` : vérifié, aucun gate ne l'exige, et le diff de reformatage noierait le diff utile.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Chaque README de couche fait moins de 10 lignes et pointe vers sa règle ; aucun n'énonce de doctrine propre                            |
| 2    | Le graphe de dépendances n'apparaît qu'une fois dans `.claude/rules/`, et cite `frontend/eslint.config.js` comme autorité              |
| 3    | Chaque fichier trimé tient sa cible ± 15 % ; toute règle supprimée est soit appliquée par un outil, soit une convention standard        |
| 4    | Pour chaque suppression justifiée par l'outillage, la config qui l'applique a été ouverte et citée                                     |
| 5    | Les trois scans sont verts ; une édition `.swift` charge moins de 800 lignes de règles, contre 1 389 au départ                         |
| —    | `.claude/rules/` sous 4 000 lignes, contre 6 756 ; aucune règle KEEP de l'audit n'a été touchée                                        |

## Résultat

| Mesure                                    | Cible    | Constaté |
| ----------------------------------------- | -------- | -------- |
| Baseline injectée à chaque tour           | < 400    | **144**  |
| Règles chargées sur une édition `.swift`  | < 800    | **697**  |
| Règles chargées sur un `feature/**/*.ts`  | —        | 2 086    |
| Règles chargées sur un `backend-nest/**`  | —        | 917      |
| Globs morts sur 45 règles                 | 0        | **0**    |
| `.claude/rules/` total                    | < 4 000  | 4 928    |

### Deux écarts assumés

**Le graphe de dépendances reste dans les 5 `layer-*.md` (tâche 2 non appliquée).** Les cinq
règles sont scopées sur des chemins mutuellement exclusifs : `layer-core.md` ne se charge
jamais dans une session `feature/`. Consolider aurait supprimé le fait de 4 couches sur 5.
Chaque bloc n'énonçait par ailleurs que ses propres arêtes — il n'y avait pas de duplication
5×. Ajouté à la place : la mention de `frontend/eslint.config.js` comme autorité dans les
quatre fichiers qui ne l'avaient pas.

**La cible de 4 000 lignes était arithmétiquement hors d'atteinte.** Les coupes listées dans
cette phase totalisent ~1 500 lignes de `.claude/rules/` ; les 1 105 lignes des READMEs de
couche vivent sous `frontend/`, hors du décompte. Les gros fichiers restants
(`material-tailwind-integration.md` 279, `angular-material-22.md` 245, `design-system.md`
227, `ios-architecture.md` 222) n'étaient pas au périmètre — la tâche 3 demande même
explicitement de conserver `angular-material-22.md`.

La cible de la tâche 4 sur `layer-ui.md` (~103 lignes) protégeait des règles a11y et inputs
signals qui n'existaient pas dans le fichier : `git show HEAD:…/layer-ui.md | grep -i
"a11y\|accessib\|aria\|focus"` ne renvoie rien. Descendu à 82 lignes, six sections intactes.
