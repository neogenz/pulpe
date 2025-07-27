Voici un fichier Markdown qui décrit toutes les commandes de la CLI GitHub, basé sur le manuel officiel.[1]

Generated markdown

# Manuel de la CLI GitHub

GitHub CLI, ou `gh`, est une interface de ligne de commande pour GitHub à utiliser dans votre terminal ou vos scripts.

## Commandes disponibles

Voici une liste de toutes les commandes disponibles avec leurs sous-commandes.

### `gh`

Commande de base pour la CLI GitHub.

### `alias`

Créez des raccourcis pour les commandes `gh`.

- `delete`: Supprimer un alias.
- `import`: Importer des alias depuis un fichier YAML.
- `list`: Lister les alias.
- `set`: Créer un alias.

### `api`

Faire des appels authentifiés à l'API GitHub.

### `attestation`

Gérer les attestations.

- `download`: Télécharger les attestations pour un artefact.
- `trusted-root`: Gérer la racine de confiance pour la vérification des attestations.
- `verify`: Vérifier les attestations pour un artefact.

### `auth`

Commandes d'authentification.

- `login`: S'authentifier auprès d'un hôte GitHub.
- `logout`: Se déconnecter d'un hôte GitHub.
- `refresh`: Actualiser les informations d'identification stockées.
- `setup-git`: Configurer l'authentification Git.
- `status`: Afficher le statut d'authentification.
- `switch`: Changer le compte GitHub actif.
- `token`: Imprimer le jeton d'authentification que `gh` utilise.

### `browse`

Ouvrir les pages GitHub dans le navigateur.

### `cache`

Gérer le cache de la CLI.

- `delete`: Supprimer des éléments du cache.
- `list`: Lister les éléments du cache.

### `codespace`

Gérer les codespaces.

- `code`: Ouvrir un codespace dans VS Code.
- `cp`: Copier des fichiers entre la machine locale et un codespace.
- `create`: Créer un codespace.
- `delete`: Supprimer un codespace.
- `edit`: Modifier un codespace.
- `jupyter`: Ouvrir un codespace dans JupyterLab.
- `list`: Lister les codespaces.
- `logs`: Accéder aux journaux d'un codespace.
- `ports`: Gérer les ports d'un codespace.
- `rebuild`: Reconstruire un codespace.
- `ssh`: Se connecter à un codespace via SSH.
- `stop`: Arrêter un codespace.
- `view`: Afficher les détails d'un codespace.

### `completion`

Générer des scripts d'autocomplétion pour votre shell.

### `config`

Gérer la configuration.

- `clear-cache`: Effacer le cache de la configuration.
- `get`: Obtenir la valeur d'une clé de configuration.
- `list`: Lister les clés de configuration.
- `set`: Définir une valeur pour une clé de configuration.

### `extension`

Gérer les extensions `gh`.

- `browse`: Parcourir et rechercher des extensions.
- `create`: Créer une nouvelle extension.
- `exec`: Exécuter une commande d'extension installée.
- `install`: Installer une extension.
- `list`: Lister les extensions installées.
- `remove`: Supprimer une extension.
- `search`: Rechercher des extensions.
- `upgrade`: Mettre à jour les extensions.

### `gist`

Gérer les gists.

- `clone`: Cloner un gist localement.
- `create`: Créer un nouveau gist.
- `delete`: Supprimer un gist.
- `edit`: Modifier un gist.
- `list`: Lister vos gists.
- `rename`: Renommer un gist.
- `view`: Afficher un gist.

### `gpg-key`

Gérer les clés GPG.

- `add`: Ajouter une clé GPG à votre compte GitHub.
- `delete`: Supprimer une clé GPG de votre compte GitHub.
- `list`: Lister les clés GPG de votre compte GitHub.

### `help`

Aide sur `gh` et ses commandes.

### `issue`

Gérer les issues.

- `close`: Fermer une issue.
- `comment`: Ajouter un commentaire à une issue.
- `create`: Créer une nouvelle issue.
- `delete`: Supprimer une issue.
- `develop`: Gérer les branches de développement pour une issue.
- `edit`: Modifier une issue.
- `list`: Lister les issues.
- `lock`: Verrouiller une conversation d'issue.
- `pin`: Épingler une issue.
- `reopen`: Rouvrir une issue.
- `status`: Afficher le statut des issues.
- `transfer`: Transférer une issue vers un autre dépôt.
- `unlock`: Déverrouiller une conversation d'issue.
- `unpin`: Désépingler une issue.
- `view`: Afficher une issue.

### `label`

Gérer les étiquettes.

- `clone`: Cloner des étiquettes d'un autre dépôt.
- `create`: Créer une nouvelle étiquette.
- `delete`: Supprimer une étiquette.
- `edit`: Modifier une étiquette.
- `list`: Lister les étiquettes.

### `org`

Gérer les organisations.

- `list`: Lister les organisations auxquelles vous appartenez.

### `pr`

Gérer les pull requests.

- `checkout`: Extraire une pull request.
- `checks`: Afficher l'état des vérifications pour une pull request.
- `close`: Fermer une pull request.
- `comment`: Ajouter un commentaire à une pull request.
- `create`: Créer une nouvelle pull request.
- `diff`: Afficher les différences d'une pull request.
- `edit`: Modifier une pull request.
- `list`: Lister les pull requests.
- `lock`: Verrouiller une conversation de pull request.
- `merge`: Fusionner une pull request.
- `ready`: Marquer une pull request comme prête pour la revue.
- `reopen`: Rouvrir une pull request.
- `review`: Ajouter une revue à une pull request.
- `status`: Afficher le statut des pull requests.
- `unlock`: Déverrouiller une conversation de pull request.
- `update-branch`: Mettre à jour une branche de pull request.
- `view`: Afficher une pull request.

### `project`

Travailler avec les projets GitHub.

- `close`: Fermer un projet.
- `copy`: Copier un projet.
- `create`: Créer un projet.
- `delete`: Supprimer un projet.
- `edit`: Modifier un projet.
- `field-create`: Créer un champ de projet.
- `field-delete`: Supprimer un champ de projet.
- `field-list`: Lister les champs d'un projet.
- `item-add`: Ajouter un élément à un projet.
- `item-archive`: Archiver un élément d'un projet.
- `item-create`: Créer un brouillon d'issue dans un projet.
- `item-delete`: Supprimer un élément d'un projet.
- `item-edit`: Modifier un élément dans un projet.
- `item-list`: Lister les éléments d'un projet.
- `link`: Lier un projet à un dépôt ou une équipe.
- `list`: Lister les projets.
- `mark-template`: Marquer un projet comme modèle.
- `unlink`: Délier un projet d'un dépôt ou une équipe.
- `view`: Afficher un projet.

### `release`

Gérer les releases.

- `create`: Créer une nouvelle release.
- `delete-asset`: Supprimer un artefact d'une release.
- `delete`: Supprimer une release.
- `download`: Télécharger les artefacts d'une release.
- `edit`: Modifier une release.
- `list`: Lister les releases.
- `upload`: Télécharger un artefact vers une release.
- `view`: Afficher une release.

### `repo`

Gérer les dépôts.

- `archive`: Archiver un dépôt.
- `autolink`: Gérer les liens automatiques.
- `clone`: Cloner un dépôt.
- `create`: Créer un nouveau dépôt.
- `delete`: Supprimer un dépôt.
- `deploy-key`: Gérer les clés de déploiement.
- `edit`: Modifier un dépôt.
- `fork`: Créer un fork d'un dépôt.
- `gitignore`: Gérer les fichiers .gitignore.
- `license`: Gérer les fichiers de licence.
- `list`: Lister les dépôts.
- `rename`: Renommer un dépôt.
- `set-default`: Définir le dépôt par défaut.
- `sync`: Synchroniser un dépôt local avec son amont.
- `unarchive`: Désarchiver un dépôt.
- `view`: Afficher un dépôt.

### `ruleset`

Gérer les ensembles de règles d'un dépôt.

- `check`: Vérifier si une branche est conforme à un ensemble de règles.
- `list`: Lister les ensembles de règles d'un dépôt.
- `view`: Afficher un ensemble de règles.

### `run`

Gérer les exécutions de workflow GitHub Actions.

- `cancel`: Annuler une exécution de workflow.
- `delete`: Supprimer une exécution de workflow.
- `download`: Télécharger les artefacts d'une exécution de workflow.
- `list`: Lister les exécutions de workflow.
- `rerun`: Ré-exécuter une exécution de workflow.
- `view`: Afficher une exécution de workflow.
- `watch`: Surveiller une exécution de workflow en temps réel.

### `search`

Rechercher dans GitHub.

- `code`: Rechercher du code.
- `commits`: Rechercher des commits.
- `issues`: Rechercher des issues.
- `prs`: Rechercher des pull requests.
- `repos`: Rechercher des dépôts.

### `secret`

Gérer les secrets GitHub.

- `delete`: Supprimer un secret.
- `list`: Lister les secrets.
- `set`: Définir un secret.

### `ssh-key`

Gérer les clés SSH.

- `add`: Ajouter une clé SSH à votre compte GitHub.
- `delete`: Supprimer une clé SSH de votre compte GitHub.
- `list`: Lister les clés SSH de votre compte GitHub.

### `status`

Afficher le statut de votre travail sur GitHub.

### `variable`

Gérer les variables de configuration GitHub.

- `delete`: Supprimer une variable.
- `get`: Obtenir la valeur d'une variable.
- `list`: Lister les variables.
- `set`: Définir une variable.

### `workflow`

Gérer les workflows GitHub Actions.

- `disable`: Désactiver un workflow.
- `enable`: Activer un workflow.
- `list`: Lister les workflows.
- `run`: Exécuter un workflow.
- `view`: Afficher un workflow.
