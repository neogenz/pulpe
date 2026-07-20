---
status: done
---

# Instruction: Aligner Changesets et la documentation de déploiement

> La configuration et la documentation doivent refléter une seule procédure : validation sur `preview`, promotion d'un SHA figé, puis validation de production.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .changeset/config.json    ✏️ `"baseBranch": "main"` → `"preview"`
└── docs/DEPLOYMENT.md        ✏️ deux points d'entrée, promotion du SHA exact et gates post-production
```

## Tasks to do

### `1)` Aligner `baseBranch` sur la branche par défaut

1. Dans `.changeset/config.json`, remplacer `"baseBranch": "main"` par `"baseBranch": "preview"`.
2. Vérifier via GitHub que `preview` est toujours la branche par défaut du dépôt.
3. Vérifier que `references/jsts-release.md` ne réaffirme pas `main` comme `baseBranch`.
4. Comparer le comportement de `pnpm changeset status` avec celui de `pnpm changeset status --since preview`.
5. Accepter l'erreur métier « des packages ont changé sans changeset » si elle est identique dans les deux cas. Refuser une erreur de résolution de branche ou un écart montrant que la comparaison implicite n'utilise pas `preview`. La documentation officielle confirme que `baseBranch` sert de comparaison par défaut et que `--since` la remplace.
6. Ne rien conclure sur les versions déjà publiées : `baseBranch` ne modifie pas les bumps passés.

### `2)` Décrire une seule promotion sûre

1. Dans le résumé et la section de promotion de `docs/DEPLOYMENT.md`, remplacer la contradiction PR/push direct par le flux du skill `/release`.
2. Documenter les deux points d'entrée autorisés, `preview` et `main`, et leur convergence vers la validation sur `preview`.
3. Remplacer tout push fondé sur une branche distante mutable par :
   - mémorisation du SHA validé ;
   - contrôle `origin/preview == $SHA` et ascendance de `origin/main` ;
   - `git push origin "$SHA:refs/heads/main"`.
4. Expliquer que le bypass admin documenté dans `CONTRIBUTING.md` est requis pour la promotion directe.
5. Renvoyer à `docs/VERSIONING.md` pour les étapes détaillées de version.

### `3)` Documenter correctement les gates

1. Écrire que les pushes sur les branches connectées déclenchent les déploiements Vercel et Railway ; ne pas présenter ces webhooks comme gardés par `ci-success`.
2. Écrire que les jobs GitHub `migrate`, `posthog-annotate` et `verify-prod-csp` dépendent de `ci-success`.
3. Après le push `main`, exiger la CI `main`, les deux déploiements associés au SHA exact et les health checks avant tag, GitHub Release et `LATEST_WEB_VERSION`.
4. Rappeler que `LATEST_IOS_VERSION` n'est modifié qu'après disponibilité App Store.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                                            |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | `baseBranch` vaut `preview`, branche par défaut vérifiée ; la comparaison implicite Changesets se comporte comme `--since preview`, même si aucun changeset existe |
| 2    | `docs/DEPLOYMENT.md` ne décrit qu'un flux cohérent avec le skill, accepte les deux départs et ne promeut que le SHA exact validé                                 |
| 3    | Le document distingue les déploiements externes des trois jobs GitHub gardés et place chaque gate client après la disponibilité de sa surface                  |
