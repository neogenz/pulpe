# Analyse détaillée du problème de tests E2E Playwright

## Contexte
Suite au développement sur la branche `error-handling-posthog` pour ajouter PostHog et les analytics, environ 2/3 des tests E2E échouent lors de leur exécution depuis la racine du projet.

**⚠️ IMPORTANT : Le nettoyage du cache a déjà été testé et n'a PAS résolu le problème. Cela indique un problème plus profond dans la configuration ou le timing d'initialisation.**

## Symptômes observés

### 1. Erreurs dans les logs du navigateur
```
Failed to load resource: the server responded with a status of 504 (Outdated Optimize Dep)
```

### 2. URLs affectées (exemples)
- `http://localhost:4200/@fs/Users/maximedesogus/workspace/perso/pulpe-workspace/frontend/.angular/cache/20.2.2/webapp/vite/deps/@angular_material_input.js?v=95114333`
- Plusieurs chunks Vite: `chunk-FXLDLLHR.js`, `chunk-MW42MRKQ.js`, `chunk-EEMWDN6K.js`, `chunk-EU6VNTRM.js`

### 3. Erreurs de compilation Angular
```
TS2307: Cannot find module '@pulpe/shared' or its corresponding type declarations
```
Le module `@pulpe/shared` n'est pas trouvé dans plusieurs fichiers du frontend.

### 4. Logs serveur dev
```
The file does not exist at "/Users/maximedesogus/workspace/perso/pulpe-workspace/frontend/.angular/cache/20.2.2/webapp/vite/deps/chunk-FXLDLLHR.js?v=95114333" which is in the optimize deps directory.
```

## Analyse technique

### Problème principal : Cache Vite obsolète
L'ajout de PostHog a introduit de nouvelles dépendances qui ont perturbé le cache d'optimisation de Vite. Lorsque Vite détecte des changements dans les dépendances mais que le cache n'est pas correctement invalidé, il retourne des erreurs 504 "Outdated Optimize Dep".

### Problèmes secondaires

1. **Module shared non construit** : Le package `@pulpe/shared` doit être compilé avant que le frontend puisse l'utiliser
2. **Configuration PostHog** : La configuration génère correctement (`PUBLIC_POSTHOG_ENABLED=true` en local, `false` pour les tests), mais les dépendances PostHog créent des conflits de cache
3. **Architecture monorepo** : La configuration Turborepo nécessite que les dépendances soient construites dans le bon ordre

## Configuration actuelle

### playwright.config.ts
```typescript
export default defineConfig({
  fullyParallel: true,
  webServer: {
    command: process.env.CI ? 'pnpm run start:ci' : 'pnpm run start',
    port: 4200,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  // Charge les variables depuis .env.e2e
  config({ path: '.env.e2e' });
});
```

### Variables d'environnement (.env.e2e)
```
PUBLIC_POSTHOG_ENABLED=false
PUBLIC_ENVIRONMENT=test
```

### Flux d'exécution
1. Playwright démarre
2. `playwright.config.ts` charge `.env.e2e`
3. Playwright lance `pnpm run start:ci`
4. `start:ci` génère la config et démarre Angular
5. Vite tente de charger les dépendances optimisées depuis le cache
6. **ÉCHEC** : Cache obsolète → Erreur 504

## Solutions identifiées

### Solution 1 : Nettoyage du cache (immédiat)
```bash
# Nettoyer tous les caches
rm -rf frontend/.angular/cache
rm -rf frontend/node_modules/.vite
rm -rf frontend/.turbo

# Reconstruire le package shared
cd shared && pnpm build

# Relancer les tests
cd frontend && pnpm test:e2e
```

### Solution 2 : Script de préparation E2E (durable)
Créer un script qui nettoie automatiquement les caches avant les tests :

**frontend/scripts/prepare-e2e.sh**
```bash
#!/bin/bash
echo "🧹 Nettoyage des caches Vite..."
rm -rf .angular/cache/*/webapp/vite/deps
echo "📦 Reconstruction du package shared..."
cd ../shared && pnpm build
cd ../frontend
echo "✅ Environnement E2E prêt"
```

### Solution 3 : Configuration Vite optimisée
Ajouter une configuration spécifique pour les tests dans Angular :

**angular.json** (configuration de test)
```json
{
  "serve": {
    "options": {
      "optimization": {
        "scripts": false,
        "styles": false,
        "fonts": false
      },
      "clearCache": true
    }
  }
}
```

### Solution 4 : Scripts npm dédiés
**frontend/package.json**
```json
{
  "scripts": {
    "test:e2e:clean": "rm -rf .angular/cache && playwright test",
    "start:ci:force": "npm run generate:config && npm run generate:build-info && ng serve --force",
    "prepare:e2e": "bash scripts/prepare-e2e.sh"
  }
}
```

### Solution 5 : Configuration Playwright améliorée
**playwright.config.ts**
```typescript
export default defineConfig({
  webServer: {
    command: process.env.CI
      ? 'pnpm run prepare:e2e && pnpm run start:ci:force'
      : 'pnpm run start',
    port: 4200,
    reuseExistingServer: false, // Force nouveau serveur pour tests
    timeout: 180000, // Plus de temps pour reconstruction
  },
});
```

## Recommandations

### Court terme (résolution immédiate)
1. Nettoyer manuellement les caches
2. Reconstruire le package shared
3. Utiliser `--force` pour forcer la régénération des dépendances Vite

### Moyen terme (stabilisation)
1. Implémenter les scripts de préparation E2E
2. Ajouter des commandes npm dédiées aux tests avec nettoyage
3. Documenter le processus pour l'équipe

### Long terme (prévention)
1. Configurer Vite pour mieux gérer les dépendances d'analytics
2. Séparer les caches de développement et de test
3. Automatiser la détection et le nettoyage des caches obsolètes
4. Considérer l'exclusion de PostHog des dépendances optimisées en mode test

## Impact de PostHog

L'ajout de PostHog a introduit :
- Nouvelles dépendances JavaScript lourdes
- Modifications dans le bundle principal
- Changements dans l'ordre de chargement des modules
- Cache Vite devenu incohérent avec les nouvelles dépendances

## Nouvelle analyse après information supplémentaire

Puisque le nettoyage du cache n'a PAS résolu le problème, nous devons explorer d'autres causes :

### 1. Problème CONFIRMÉ : Variables d'environnement non transmises
**C'EST LE PROBLÈME PRINCIPAL !**
- Playwright charge `.env.e2e` dans SON process avec `config({ path: '.env.e2e' })`
- MAIS ces variables ne sont PAS transmises au process enfant lancé par `webServer.command`
- Quand Playwright lance `pnpm run start:ci`, c'est un NOUVEAU process qui charge `.env` (pas `.env.e2e`)
- Résultat : PostHog reste activé (`enabled: true`) pendant les tests

### 2. Problème secondaire : Timing Vite/PostHog
- PostHog s'initialise et cause des problèmes de dépendances Vite
- Les erreurs 504 "Outdated Optimize Dep" sont la conséquence de PostHog actif

### 3. Problème de build du package shared
L'erreur `Cannot find module '@pulpe/shared'` persiste, ce qui indique que :
- Le package n'est pas construit avant le démarrage du serveur
- Ou le lien symbolique pnpm workspace n'est pas résolu correctement

### 4. Conflit entre serveurs dev parallèles
Si un serveur dev tourne déjà sur le port 4200 et que Playwright réutilise ce serveur (`reuseExistingServer`), les configurations peuvent être mélangées.

## Hypothèse principale CONFIRMÉE

**INFORMATION CRITIQUE** : Quand l'application est lancée manuellement PUIS que les tests sont exécutés, TOUS les tests passent !

Cela prouve que :
1. **Les tests sont corrects**
2. **L'application fonctionne correctement**
3. **Le problème est UNIQUEMENT dans la façon dont Playwright lance le serveur via Turbo**

Le problème est une combinaison de :
- **Chemins relatifs** : Turbo exécute depuis la racine, Playwright cherche `.env.e2e` au mauvais endroit
- **Variables non transmises** : Les variables d'environnement ne passent pas à travers la chaîne Turbo → pnpm → npm
- **Timing/Initialisation** : Le serveur lancé par Playwright n'a pas le bon contexte d'exécution

## Solutions qui FONCTIONNENT vraiment

### ❌ Solution A : webServer.env NE FONCTIONNE PAS
**CONFIRMÉ par la documentation officielle** :
- "npm run drops inline UNIX env syntax on Windows shells"
- "avoid npm script layers that drop env"
- Les variables dans `webServer.env` ne sont PAS garanties d'être transmises aux scripts npm chaînés

### ✅ Solution B : Passer les variables DIRECTEMENT dans la commande
**C'est la solution la plus simple et fiable :**
```typescript
// playwright.config.ts
webServer: {
  command: 'PUBLIC_POSTHOG_ENABLED=false PUBLIC_ENVIRONMENT=test pnpm run start:ci',
  // ...
}
```

### ✅ Solution C : Utiliser dotenv-cli
**Installer dotenv-cli et créer un script :**
```bash
pnpm add -D dotenv-cli
```
```json
// package.json
"start:e2e": "dotenv -e .env.e2e -- npm run start:ci"
```
```typescript
// playwright.config.ts
webServer: {
  command: 'pnpm run start:e2e',
  // ...
}
```

### ✅ Solution D : Modifier generate-config.js pour détecter le mode test
```javascript
// generate-config.js
const isTestMode = process.env.PUBLIC_ENVIRONMENT === 'test' ||
                   process.env.PUBLIC_POSTHOG_ENABLED === 'false';
const envFile = isTestMode ? '.env.e2e' : '.env';
require("dotenv").config({ path: envFile });
```

### Solution B : Construire shared AVANT les tests
```typescript
webServer: {
  command: 'cd ../shared && pnpm build && cd ../frontend && pnpm run start:ci',
  // ...
}
```

### Solution C : Désactiver PostHog en dur pour les tests
Modifier le code d'initialisation pour détecter l'environnement de test.

### Solution D : Utiliser cross-env ou dotenv-cli
Installer et utiliser un outil qui transmet correctement les variables.

## Solution temporaire qui FONCTIONNE

**Lancer manuellement le serveur avec les bonnes variables, puis lancer les tests :**

```bash
# Terminal 1
cd frontend
PUBLIC_POSTHOG_ENABLED=false PUBLIC_ENVIRONMENT=test pnpm run start

# Terminal 2 (une fois le serveur prêt)
cd frontend
pnpm test:e2e --headed  # ou depuis la racine : pnpm test:e2e
```

## Solutions permanentes à implémenter

### Solution 1 : Chemins absolus (RECOMMANDÉ)
```typescript
// playwright.config.ts
import * as path from 'path';

config({ path: path.join(__dirname, '.env.e2e') });

webServer: {
  command: 'pnpm run start:ci',
  cwd: __dirname, // Force l'exécution depuis frontend/
  port: 4200,
  reuseExistingServer: false,
}
```

### Solution 2 : cross-env pour la portabilité
```bash
pnpm add -D cross-env
```
```json
// package.json
"start:e2e": "cross-env PUBLIC_POSTHOG_ENABLED=false PUBLIC_ENVIRONMENT=test npm run start:ci"
```

### Solution 3 : Détection automatique dans generate-config.js
```javascript
const path = require('path');
const envFile = process.env.PUBLIC_ENVIRONMENT === 'test'
  ? path.resolve(__dirname, '..', '.env.e2e')
  : path.resolve(__dirname, '..', '.env');
```

## RÉSOLUTION FINALE - PROBLÈME RÉSOLU ✅

### Les deux problèmes identifiés et corrigés

#### 1. Problème de chemin relatif dans un monorepo Turbo
- **Cause** : Turbo exécute depuis la racine, Playwright cherchait `.env.e2e` au mauvais endroit
- **Solution appliquée** :
  ```typescript
  config({ path: path.join(__dirname, '.env.e2e') });
  ```

#### 2. Environnement "test" non accepté par le schema Zod
- **CEause** : Le schema n'acceptait que `['development', 'production', 'local']`
- **Solution appliquée** :
  ```typescript
  environment: z.enum(['development', 'production', 'local', 'test'])
  ```

### Pourquoi les tests échouaient

1. **Playwright + Turbo** : Chemin relatif `.env.e2e` non trouvé → variables non chargées
2. **Même après fix du chemin** : `PUBLIC_ENVIRONMENT=test` rejeté par Zod → app crash au démarrage
3. **Erreurs invisibles** : Les erreurs JavaScript du navigateur n'apparaissent pas dans le terminal

### Pourquoi ça marchait en manuel

Quand on lançait manuellement le serveur sans passer `PUBLIC_ENVIRONMENT=test`, l'app utilisait `local` de `.env`, qui était valide !

## Leçons apprises

1. **Monorepo + Turbo** : Toujours utiliser des chemins absolus (`path.join(__dirname, ...)`)
2. **Validation Zod** : S'assurer que TOUS les environnements possibles sont dans le schema
3. **Debug Playwright** : Les erreurs du navigateur ne sont visibles que dans les traces/rapports
4. **Variables d'environnement** : La chaîne Turbo → pnpm → npm peut perdre les variables
5. **`webServer.env` ne fonctionne pas** : Les variables ne sont pas transmises aux scripts npm chaînés

## Configuration finale fonctionnelle

```typescript
// playwright.config.ts
import * as path from 'path';

config({ path: path.join(__dirname, '.env.e2e') }); // Chemin absolu

webServer: {
  command: 'PUBLIC_POSTHOG_ENABLED=false PUBLIC_ENVIRONMENT=test pnpm run start',
  cwd: __dirname, // Force exécution depuis frontend/
  reuseExistingServer: false,
}
```

```typescript
// config.schema.ts
environment: z.enum(['development', 'production', 'local', 'test']) // Ajout de 'test'
```

## État final : TOUS LES TESTS PASSENT ✅

## REX de Claude 
  Ce qui s'est passé (chronologie des erreurs de diagnostic)

  1. J'ai d'abord mal compris le comportement de dotenv - je pensais que les variables déjà définies ne seraient pas remplacées
  2. J'ai tourné en rond sur le problème de cache Vite alors que tu avais déjà testé
  3. J'ai finalement identifié le problème de transmission des variables mais sans voir le vrai souci
  4. Le vrai problème était double :
    - Chemin relatif dans un monorepo Turbo
    - Environnement "test" non accepté par Zod

  Points clés de l'investigation

  ✅ Ce qui a aidé :
  - Tu m'as dit que ça marchait en lançant manuellement → indice crucial
  - Les logs du navigateur dans Playwright → ont révélé l'erreur Zod
  - Ta persistence et tes tests → ont éliminé les fausses pistes

  ❌ Ce qui nous a ralentis :
  - Les erreurs JavaScript n'apparaissaient pas dans le terminal
  - J'ai fait des allers-retours sur des solutions déjà testées
  - La complexité de la chaîne Turbo → pnpm → npm → Angular → Vite

  La solution finale (simple !)

  // 1. Chemin absolu
  config({ path: path.join(__dirname, '.env.e2e') });

  // 2. Ajouter 'test' au schema
  environment: z.enum(['development', 'production', 'local', 'test'])

  Apprentissages pour le futur

  1. Toujours vérifier les schemas de validation quand on ajoute de nouveaux environnements
  2. Utiliser des chemins absolus dans les monorepos
  3. Les erreurs du navigateur dans Playwright nécessitent d'aller voir les traces
  4. Tester manuellement donne souvent des indices précieux

   Analyse du problème de chargement multiple

  Les endroits qui chargent des .env

  1. playwright.config.ts : Charge .env.e2e
  config({ path: path.join(__dirname, '.env.e2e') });
  2. generate-config.js : Charge .env (par défaut)
  require("dotenv").config(); // Charge .env
  3. Le problème : Ces deux chargements se font dans des processus différents !
    - Playwright charge .env.e2e dans SON processus
    - Mais quand il lance pnpm run start:ci, c'est un NOUVEAU processus qui ne voit pas ces variables
    - Ce nouveau processus exécute generate-config.js qui charge .env