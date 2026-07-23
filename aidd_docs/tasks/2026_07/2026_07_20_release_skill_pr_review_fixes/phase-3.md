---
status: done
---

# Instruction: Garder le scénario de divergence indépendant des releases

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
frontend/projects/webapp/src/app/layout/whats-new/
└── whats-new-toast.spec.ts ✏️ dériver une version de build forcément différente
```

## Tasks to do

### `1)` Découpler le mock de la version courante

1. Dans le scénario où les versions de build et de release divergent, dériver le mock depuis `LATEST_RELEASE.version` avec un suffixe explicite.
2. Ne modifier ni le composant, ni les données de release, ni les autres scénarios.

### `2)` Prouver la stabilité du scénario

1. Reproduire le défaut historique en alignant temporairement `LATEST_RELEASE.version` sur l'ancienne valeur codée en dur : l'ancien test doit échouer parce que les versions deviennent égales.
2. Avec le mock dérivé, répéter la mutation : le scénario de divergence doit rester vert.
3. Restaurer les données de release et exécuter le fichier de test Whats New Toast complet.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                       |
| ---- | --------------------------------------------------------------------------------------------------------- |
| 1    | Le scénario de divergence ne contient plus de version produit codée en dur                               |
| 1    | Le mock reste différent de `LATEST_RELEASE.version` pour toute valeur future de cette constante          |
| 2    | La mutation `LATEST_RELEASE.version = '0.37.1'` fait échouer l'ancien test et laisse passer le test corrigé |
| 2    | Après restauration, les 8 tests de `whats-new-toast.spec.ts` passent et le typecheck des specs reste vert |
