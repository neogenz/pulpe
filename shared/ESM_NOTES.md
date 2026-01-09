# Notes Techniques ESM - Package pulpe-shared

## Contexte du Problème

### Incident Initial (Railway Deployment)

Le 13 septembre 2025, après le merge de la branche `fix-total-amount` dans `main`, le déploiement Railway a échoué avec l'erreur suivante :

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'/app/node_modules/.pnpm/@pulpe+shared@file+shared/node_modules/pulpe-shared/dist/esm/src/calculators/budget-formulas'
imported from /app/node_modules/.pnpm/@pulpe+shared@file+shared/node_modules/pulpe-shared/dist/esm/src/calculators/index.js
```

### Diagnostic

1. **Première tentative** : Ajout des fichiers manquants dans `tsconfig.json`
   - ❌ Insuffisant - le problème persistait

2. **Analyse approfondie** : Le vrai problème était la stratégie de résolution des modules
   - `moduleResolution: "bundler"` était configuré
   - Fonctionnait en développement (symlinks pnpm)
   - Échouait en production (fichiers copiés)

## La Contrainte ESM

### Règle Fondamentale

**Node.js ESM exige des extensions de fichier explicites dans tous les imports.**

```typescript
// Dans un fichier .ts, on DOIT écrire :
import { something } from './module.js';  // ✅ Extension .js obligatoire

// Et NON :
import { something } from './module';     // ❌ ERR_MODULE_NOT_FOUND
import { something } from './module.ts';  // ❌ Le .ts n'existera pas après compilation
```

### Pourquoi c'est contre-intuitif ?

1. **On écrit du TypeScript** (`.ts`) mais on importe du JavaScript (`.js`)
2. **Le fichier `.js` n'existe pas encore** pendant qu'on code (il sera créé à la compilation)
3. **Les IDEs peuvent signaler une erreur** car ils cherchent le fichier `.js` qui n'existe pas
4. **C'est différent de l'habitude CommonJS** où les extensions étaient optionnelles

## Configuration TypeScript Correcte

### Avant (Problématique)

```json
{
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler"  // ❌ Pour les bundlers, pas Node.js
  }
}
```

### Après (Solution)

```json
{
  "compilerOptions": {
    "module": "NodeNext",           // ✅ Support ESM natif
    "moduleResolution": "NodeNext"  // ✅ Résolution Node.js ESM
  }
}
```

## Différences Clés

### moduleResolution: "bundler"

- **Pour** : Webpack, Vite, Rollup, esbuild, Parcel
- **Caractéristiques** :
  - Extensions optionnelles
  - Résolution flexible des chemins
  - Alias de chemins supportés
- **Problème** : Ne suit pas les règles strictes de Node.js ESM

### moduleResolution: "NodeNext"

- **Pour** : Node.js natif (v12+)
- **Caractéristiques** :
  - Extensions obligatoires
  - Résolution stricte selon les specs ECMAScript
  - Support des exports conditionnels dans package.json
- **Avantage** : Garantit la compatibilité avec Node.js en production

## Impact sur le Développement

### Environnement Local (pnpm workspace)

```
shared/src/calculators/
├── index.ts          # Source TypeScript
└── budget-formulas.ts

↓ pnpm utilise des symlinks

node_modules/pulpe-shared → ../../shared (symlink)
```

**Résultat** : La résolution flexible masque les problèmes d'extensions

### Environnement Production (Railway/Docker)

```
node_modules/pulpe-shared/dist/esm/src/calculators/
├── index.js          # Compilé
├── index.d.ts        # Types
└── budget-formulas.js

Pas de symlinks, fichiers réels copiés
```

**Résultat** : Node.js applique les règles ESM strictes → crash si pas d'extension

## Commande de Test Critique

Pour simuler l'environnement Railway localement :

```bash
# Cette commande copie les fichiers comme en production
pnpm deploy --legacy /tmp/test-directory

# Vérifie que l'app démarre sans erreur
cd /tmp/test-directory
bun start
```

## Leçons Apprises

1. **Toujours tester avec `pnpm deploy --legacy`** avant de déployer
2. **Les symlinks pnpm peuvent masquer des problèmes** de résolution de modules
3. **ESM natif a des règles strictes** différentes de CommonJS
4. **La configuration TypeScript doit matcher** l'environnement d'exécution cible

## Ressources

### Documentation Officielle

- [TypeScript - Modules NodeNext](https://www.typescriptlang.org/docs/handbook/modules/reference.html#node16-nodenext)
- [Node.js - ESM Mandatory file extensions](https://nodejs.org/api/esm.html#mandatory-file-extensions)
- [TypeScript - Module Resolution](https://www.typescriptlang.org/docs/handbook/modules/reference.html#module-resolution)

### Articles Utiles

- [TypeScript NodeNext: A Comprehensive Guide](https://www.totaltypescript.com/tsconfig-module-options)
- [Understanding TypeScript's Module Resolution](https://devblogs.microsoft.com/typescript/announcing-typescript-5-0/#moduleresolution-bundler)

## Checklist de Migration ESM

Si vous devez migrer un autre package vers ESM natif :

- [ ] Changer `"type": "module"` dans package.json
- [ ] Configurer `"module": "NodeNext"` et `"moduleResolution": "NodeNext"`
- [ ] Ajouter `.js` à TOUS les imports relatifs
- [ ] Tester avec `pnpm deploy --legacy` localement
- [ ] Vérifier que les fichiers `.d.ts` sont bien générés
- [ ] Documenter la contrainte des extensions `.js`

## FAQ

### Q: Pourquoi pas juste utiliser un bundler ?

**R:** Le backend NestJS s'exécute directement avec Node.js/Bun sans bundler. Les bundlers ajoutent de la complexité et du temps de build inutiles pour un serveur.

### Q: Est-ce que Bun a le même problème ?

**R:** Bun est plus permissif mais suit les mêmes règles ESM pour la compatibilité. Mieux vaut respecter les standards stricts.

### Q: Peut-on utiliser des path aliases avec NodeNext ?

**R:** Pas directement. Il faut des outils supplémentaires comme `tsx` ou `ts-node` avec des plugins de résolution.

### Q: Cette contrainte s'applique aussi au frontend ?

**R:** Non, Angular utilise Webpack qui gère la résolution des modules différemment. La contrainte ne s'applique qu'aux packages exécutés directement par Node.js.

---

*Document créé suite à l'incident de déploiement Railway du 13/09/2025*
*Dernière mise à jour : 13/09/2025*