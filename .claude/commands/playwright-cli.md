# Commandes de la CLI Playwright

Playwright fournit une interface de ligne de commande (CLI) pour exécuter des tests, générer du code, déboguer, et plus encore. [1]

---

## `npx playwright test`

Exécute vos tests Playwright. [1]

### Syntaxe

```bash
npx playwright test [options] [filtre-de-test...]
```

### Exemples

```bash
# Exécuter tous les tests
npx playwright test

# Exécuter un seul fichier de test
npx playwright test tests/mon-spec.ts

# Exécuter des tests par titre
npx playwright test -g "ajouter un item todo"

# Exécuter les tests en mode headed (avec interface graphique)
npx playwright test --headed

# Exécuter les tests pour un projet spécifique
npx playwright test --project=chromium

# Exécuter les tests en mode debug avec l'inspecteur Playwright
npx playwright test --debug

# Exécuter les tests en mode UI interactif
npx playwright test --ui
```

### Options courantes

| Option                       | Description                                                                              |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `--debug`                    | Exécute les tests avec l'inspecteur Playwright.                                          |
| `--headed`                   | Exécute les tests dans des navigateurs avec interface graphique (par défaut : headless). |
| `-g <grep>`                  | N'exécute que les tests correspondant à cette expression régulière.                      |
| `--project <nom-projet>`     | N'exécute que les tests des projets spécifiés.                                           |
| `--ui`                       | Exécute les tests en mode UI interactif.                                                 |
| `-j <workers>`               | Nombre de workers concurrents (par défaut : 50% des cœurs CPU).                          |
| `-u` ou `--update-snapshots` | Met à jour les snapshots avec les résultats réels.                                       |

---

## `npx playwright show-report`

Affiche le rapport HTML d'une exécution de test précédente. [1]

### Syntaxe

```bash
npx playwright show-report [rapport] [options]
```

### Exemples

```bash
# Afficher le dernier rapport de test
npx playwright show-report

# Afficher un rapport spécifique sur un port personnalisé
npx playwright show-report playwright-report/ --port 8080
```

---

## `npx playwright install`

Installe les navigateurs requis par Playwright. [1]

### Syntaxe

```bash
npx playwright install [options] [navigateur...]
```

### Exemples

```bash
# Installer tous les navigateurs
npx playwright install

# Installer uniquement Chromium
npx playwright install chromium

# Installer les navigateurs avec leurs dépendances système
npx playwright install --with-deps
```

---

## `npx playwright codegen`

Enregistre les actions de l'utilisateur et génère des scripts de test. [1]

### Syntaxe

```bash
npx playwright codegen [options] [url]
```

### Exemples

```bash
# Démarrer l'enregistrement sur un site spécifique
npx playwright codegen https://playwright.dev

# Générer du code Python
npx playwright codegen --target=python
```

### Options

| Option                   | Description                                        |
| ------------------------ | -------------------------------------------------- |
| `-o, --output <fichier>` | Fichier de sortie pour le script généré.           |
| `--target <langage>`     | Langage à utiliser (javascript, python, etc.).     |
| `-b, --browser <nom>`    | Navigateur à utiliser (chromium, firefox, webkit). |

---

## `npx playwright show-trace`

Analyse et visualise les traces de test pour le débogage. [1]

### Syntaxe

```bash
npx playwright show-trace [options] <trace>
```

### Exemple

```bash
# Visualiser un fichier de trace
npx playwright show-trace trace.zip
```

---

## `npx playwright merge-reports`

Lit plusieurs rapports blob et les combine en un seul. [1]

### Syntaxe

```bash
npx playwright merge-reports [options] <répertoire-blob>
```

### Exemple

```bash
# Combiner les rapports de test du répertoire ./reports
npx playwright merge-reports ./reports
```

---

## `npx playwright clear-cache`

Efface tous les caches de Playwright. [1]

### Syntaxe

```bash
npx playwright clear-cache
``` 