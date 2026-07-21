---
status: done
---

# Instruction: Ajouter l'invariant anti-toast-périmé

> Toute divergence entre la version web et le toast doit être soit annoncée, soit inscrite comme release silencieuse avec une raison. Une simple égalité `major.minor` masque les oublis de patch.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .claude/skills/release/SKILL.md                               ✏️ règle de mise à jour du toast ou du registre silencieux
└── frontend/projects/webapp/src/app/layout/whats-new/
    ├── whats-new-releases.ts                                     ✏️ registre explicite `SKIPPED_RELEASES`
    ├── whats-new-releases.spec.ts                                ✅ invariant strict package/toast/skip
    └── whats-new-toast.spec.ts                                   ✏️ mock pilotable + cas versions différentes
```

## Tasks to do

### `1)` Modéliser les releases silencieuses

1. Dans `whats-new-releases.ts`, ajouter un registre typé d'objets `{ version, reason }`, nommé `SKIPPED_RELEASES`.
2. Y inscrire `0.37.1` comme exception historique avec une raison explicite : omission acceptée après publication, sans rejouer le toast.
3. Garder `LATEST_RELEASE.version` à `0.37.0`.
4. Ne pas importer d'anciennes exceptions théoriques : seules les divergences nécessaires à l'état courant appartiennent au registre.

### `2)` Créer l'invariant de données strict

1. Créer `whats-new-releases.spec.ts` à côté de la donnée, sans `TestBed`.
2. Importer la version depuis `frontend/package.json` grâce à `resolveJsonModule`, plutôt que depuis le fichier de build gitignoré. Documenter l'exemption locale `boundaries/no-unknown` : ce JSON est une métadonnée de test hors des couches applicatives, comme les autres assets JSON du projet.
3. Exiger exactement l'un des deux états :
   - `frontend/package.json.version === LATEST_RELEASE.version` ;
   - la version du package apparaît une seule fois dans `SKIPPED_RELEASES` avec une raison non vide.
4. Tester aussi l'unicité et le format semver des versions silencieuses.
5. Ne pas comparer uniquement `major.minor`.

### `3)` Rendre le choix explicite dans le skill

1. Au Step 5c, si la release possède un toast, mettre `LATEST_RELEASE` à la version courante et ne pas ajouter cette version au registre silencieux.
2. Si `SKIP_WHATS_NEW` est choisi, ajouter la version exacte et sa raison à `SKIPPED_RELEASES`.
3. Interdire un skip sans raison et une version présente simultanément comme toast et comme release silencieuse.

### `4)` Dé-tautologiser le test du toast

1. Dans `whats-new-toast.spec.ts`, utiliser `vi.hoisted` pour exposer un `mockBuildInfo` mutable au mock `@env/build-info`.
2. Réinitialiser sa version dans `beforeEach` au lieu de la dériver dans la factory du mock.
3. Conserver les assertions de contenu sur `LATEST_RELEASE.features`.
4. Ajouter le cas `mockBuildInfo.version !== LATEST_RELEASE.version` → toast absent.
5. Vérifier qu'aucune occurrence de `LATEST_RELEASE` ne subsiste dans la factory `vi.mock`.

### `5)` Exécuter les preuves ciblées

1. Lancer uniquement le dossier concerné avec `pnpm --dir frontend test projects/webapp/src/app/layout/whats-new`.
2. Faire échouer temporairement le nouvel invariant en retirant `0.37.1` du registre, puis restaurer la donnée.
3. Faire échouer temporairement le cas composant en changeant la version du mock, puis restaurer le test.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | L'état actuel passe uniquement parce que `0.37.1` est une exception explicite et motivée ; le toast reste à `0.37.0`                       |
| 2    | Toute divergence de patch ou minor non inscrite échoue ; une release silencieuse exacte, unique et motivée passe                           |
| 3    | Le skill impose, pour chaque version, soit la mise à jour du toast, soit l'ajout d'une exception motivée, jamais les deux                   |
| 4    | Les tests du composant couvrent versions égales et différentes avec un mock indépendant de `LATEST_RELEASE`                                |
| 5    | La commande ciblée n'exécute que les tests Whats New et redevient verte après restauration des mutations de preuve                         |
