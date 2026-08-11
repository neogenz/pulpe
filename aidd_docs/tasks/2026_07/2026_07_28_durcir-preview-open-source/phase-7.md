---
status: done
---

# Instruction: Assainir la surface publique du dépôt

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── .gitignore ✏️
├── .claude
│   ├── settings.json ✏️
│   ├── hooks/sync-env-on-worktree-start.sh ❌
│   ├── agents
│   │   ├── backend-developer.md ✏️
│   │   ├── frontend-developer.md ✏️
│   │   ├── ios-developer.md ✏️
│   │   └── tech-lead.md ✏️
│   └── skills
│       ├── feature-intelligence/SKILL.md ✏️
│       ├── product-designer/SKILL.md ✏️
│       └── product-owner/SKILL.md ✏️
├── backend-nest/schema.sql ❌
├── backend-nest/supabase/seed.sql ✏️
├── aidd_docs
│   └── tasks ❌ du dépôt public; conservation locale ignorée
├── docs
│   ├── BUSINESS_WORKFLOW.md ✏️
│   └── CONSENT.md ✏️
├── landing
│   ├── app/support/page.tsx ✏️
│   └── data/releases.json ✏️
└── memory-bank/productContext.md ✏️
```

## Tasks to do

### `1)` Réduire la confiance automatique accordée au dépôt

> Une configuration clonée ne doit pas préautoriser shell, réseau et déploiements.

1. Retirer les permissions larges, `enableAllProjectMcpServers` et le hook de démarrage des réglages versionnés.
2. Retirer `permissionMode: bypassPermissions` des trois agents d’écriture.
3. Ignorer `settings.local.json` afin que les autorisations et automatismes personnels restent locaux.
4. Remplacer le chemin absolu du poste de travail dans l’agent tech lead par un chemin relatif au dépôt.

### `2)` Corriger les claims de sécurité et de rétention

> Décrire exactement le split-key au repos et les suppressions des systèmes actifs.

1. Remplacer « chiffrement de bout en bout » et « zero-knowledge » par le modèle réel: AES-256-GCM au repos, clé partagée, déchiffrement serveur pendant les requêtes.
2. Retirer « rien n’est conservé » et documenter sobrement l’expiration des sauvegardes, sans durée inventée.
3. Transformer `CONSENT.md` en note factuelle actuelle, sans conclusions juridiques non revues ni aveux non résolus.

### `3)` Retirer les informations internes sans utilité publique

> Conserver les contraintes utiles aux contributeurs, pas le journal de travail ni les données personnelles utilisées comme fixtures.

1. Remplacer la persona dépréciative par des comportements observables.
2. Retirer le nombre exact d’utilisateurs, les métriques personnelles de vélocité et le statut App Store dupliqué; pointer vers la source publique courante.
3. Remplacer l’adresse Gmail, le nom complet et le mot de passe de démonstration dans `backend-nest/supabase/seed.sql` par une identité locale manifestement synthétique.
4. Retirer `aidd_docs/tasks/` de l’index Git seulement après exécution des phases, sans supprimer les fichiers du disque; vérifier avant et après que l’inventaire local est intact. Le dossier reste ignoré et `aidd_docs/memory/` demeure la documentation projet publique relue.
5. Retirer des fichiers publics courants les chemins absolus de machine, noms de branches personnelles et captures locales.
6. Passer le même scan hostile sur `.claude/`, `.cursor/`, `.agents/`, `aidd_docs/` et `memory-bank/`; conserver les règles techniques utiles, modifier seulement les occurrences personnelles, périmées ou dangereuses confirmées.

### `4)` Préserver les références publiques volontaires

> Ne pas confondre contenu marketing assumé et fuite interne.

1. Conserver les témoignages et les références à Ismaël, Sylvie et Julie dans la landing et ses tests.
2. Scanner les fichiers suivis hors landing pour `Sylvie`, `Julie`, `Maman`, `Collègue`, `Ismaël` et variantes sans accents; aucune occurrence privée ne doit rester.
3. Conserver l’adresse de contact dans les mentions légales tant qu’aucun alias officiel du projet ne la remplace; ne pas inventer une adresse.

### `5)` Supprimer le schéma obsolète

> Les migrations restent l’unique source de vérité.

1. Supprimer `backend-nest/schema.sql`, qui décrit encore des montants numériques en clair.
2. L’ignorer pour éviter qu’un dump local soit recommité.
3. Vérifier que setup, tests et déploiement n’en dépendent pas.

### `6)` Examiner l’historique en lecture seule

> Classer les résultats utiles sans modifier les commits, refs ou objets existants.

1. Borner le scan de l’historique et des refs aux secrets réels, données personnelles non volontaires, chemins locaux et archives d’outils susceptibles d’avoir un impact concret.
2. Ne pas réécrire l’historique pour les témoignages autorisés, critiques de landing ou textes seulement embarrassants.
3. Ne lancer ni `filter-repo`, ni rebase historique, ni suppression de refs, ni garbage collection, ni force-push dans ce plan.
4. Si un secret exploitable est confirmé, arrêter cette phase et produire seulement le constat et l’action de révocation; toute opération historique relève d’un chantier séparé avec sauvegarde et approbation explicite.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Un clone neuf redemande l’autorisation pour les écritures, commandes réseau, Git et déploiements; aucun hook versionné ne copie des fichiers d’environnement au démarrage. |
| 2 | Aucun texte public courant n’affirme E2EE, zero-knowledge ou zéro rétention; les formulations concordent avec `docs/ENCRYPTION.md` et la politique de sauvegarde. |
| 3 | Le dépôt courant ne publie plus de nombre exact d’utilisateurs, métriques personnelles, statut contradictoire, jugement dépréciatif, identité réelle de seed, chemin de poste ou archive de tâches interne; les fichiers `aidd_docs/tasks/` restent présents et inchangés localement après leur retrait de l’index. |
| 4 | Les noms autorisés restent limités à la landing et à ses tests; aucun des noms privés recherchés n’apparaît dans les autres fichiers suivis. |
| 5 | Aucun fichier suivi ne présente des colonnes financières `numeric` comme schéma actuel; les migrations restent suffisantes pour reconstruire la base. |
| 6 | Le scan borné produit une classification locale; aucun commit, ref ou objet Git n’est réécrit ou supprimé et aucun push n’est effectué. |

## Résultats locaux

- `aidd_docs/tasks/` : 203 fichiers avant et après retrait de l'index, empreinte
  `b7d634a321cd9f97cbde363159d7b9002bc2f469f8e79688378cf41d05ebf97f`.
- Historique : 500 commits de `HEAD` contrôlés depuis 2025-01-01 et 246 pointes de refs
  contrôlées. Aucun préfixe de secret connu ni en-tête de clé privée détecté.
- Les affectations longues de variables sensibles sont limitées à des exemples
  d'environnement, tests, documentation et références GitHub Actions aux secrets.
- Les chemins locaux, checkpoints d'outils et un ancien fichier de test `.bak` restent
  des traces historiques à faible impact. Aucune réécriture d'historique n'est justifiée.
- Empreinte des refs avant et après scan :
  `07c7cfd4fa4d811aee992bdfd59d2e9dce19476c9a49e4e7eb53ab126934d0dd`.
- Le hook de démarrage et le dump de schéma obsolète ont été déplacés vers la Corbeille,
  donc restent récupérables localement.
