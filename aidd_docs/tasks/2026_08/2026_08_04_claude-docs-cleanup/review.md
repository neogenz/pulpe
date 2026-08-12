# Review: Nettoyage final du contexte projet

- **Verdict**: changes-requested
- **Diff**: `25e7b17b1...WORKTREE`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_12
- **Findings**: 0 critical, 4 warning, 2 minor

## Phases

### Phase 1: Baseline toujours injectée

- [ ] La purge de la mémoire utilisateur globale cible un fichier hors du dépôt versionné. `not-applicable`
- [x] Les commandes et faits racine correspondent au dépôt actuel. `CLAUDE.md:7`
- [x] Le scaffolding legacy a disparu et Scope Discipline reste présent. `CLAUDE.md:59`
- [ ] La règle globale de délégation vit hors du diff versionné. `not-applicable`
- [x] La règle de devise web est scopée sur les fichiers frontend. `.claude/rules/03-frameworks-and-libraries/webapp-currency-formatting.md:3`
- [x] Les mémoires projet importées ne recopient plus les commandes et le vocabulaire racine. `aidd_docs/memory/coding-assertions.md:1`
- [x] Le format unique de remontée hors périmètre reste dans Scope Discipline. `CLAUDE.md:63`
- [x] Le gate frontend compile les projets TypeScript et `pnpm quality` passe. `frontend/package.json:12`
- [x] La baseline documentée est sous 400 lignes. `aidd_docs/tasks/2026_08/2026_08_04_claude-docs-cleanup/phase-6.md:100`

### Phase 2: Suppression des règles mortes

- [x] Le modèle d'erreur fictif a disparu. Le nom `error-handling.md` sert maintenant une règle PostHog réelle et scopée. `.claude/rules/05-workflows-and-processes/error-handling.md:1`
- [x] `angular-architecture.md` a disparu et les règles `layer-*` portent les dépendances applicables. `.claude/rules/00-architecture/layer-feature.md:1`
- [x] `styles/` n'est plus présenté comme une couche TypeScript. `.claude/rules/00-architecture/layer-core.md:30`
- [x] `material-buttons.md` a disparu au profit de la règle Material maintenue. `.claude/rules/03-frameworks-and-libraries/angular-material-22.md:1`
- [x] Les 76 globs scopés des 43 règles correspondent tous à au moins un fichier suivi. `.claude/rules/:1`
- [x] Le corpus compte 43 règles après la suppression ultérieure d'`import-organization.md`. `.claude/rules/01-standards/coding-rules.md:71`
- [x] Les suppressions restent réversibles dans l'historique Git et aucun script destructif n'a été ajouté. `.gitignore:1`

### Phase 3: Correction factuelle des règles

- [x] Aucun exemple examiné n'appelle `logger.error`, `freshTime` ou `gcTime`. `.claude/rules/05-workflows-and-processes/logging.md:1`
- [x] Les mentions restantes de `BudgetDetailsViewModel` sont des gardes de non-réintroduction, pas une API recommandée. `.claude/rules/00-architecture/budget-details-feature-architecture.md:35`
- [x] Les seuils conservés renvoient aux gates qui les appliquent. `.claude/rules/01-standards/clean-code.md:1`
- [ ] La règle de chiffrement décrit encore l'ancien accès RLS `authenticated` à `user_encryption_key`. `fix`
- [x] Les appels iOS 26 sont gardés et les APIs citées ont des ancres dans les sources installées. `.claude/rules/03-frameworks-and-libraries/swiftui.md:1`
- [ ] La liste des colonnes chiffrées omet `savings_goal_plan_withdrawal.amount`. `fix`
- [x] Les liens Markdown locaux et les globs de règles ne contiennent aucune cible morte. `.claude/rules/:1`

### Phase 4: CLAUDE.md de package, agents et commandes

- [x] Le scheme `PulpeLocal` et la destination `Pulpe Tests` existent dans Xcode. `ios/CLAUDE.md:12`
- [x] Les symboles et chemins iOS cités existent dans les sources. `ios/CLAUDE.md:33`
- [x] Les liens frontend et les helpers cités ont des cibles réelles. `frontend/CLAUDE.md:25`
- [x] Le contexte backend tient en 25 lignes et renvoie aux types au lieu de recopier les tables. `backend-nest/CLAUDE.md:23`
- [x] Le contexte shared reste compact et nomme sa surface publique. `shared/CLAUDE.md:10`
- [x] Les agents ne recommandent plus de quatrième couche backend. `.claude/agents/backend-developer.md:34`
- [x] Les deux commandes Claude ne contiennent aucun chemin mort. `.claude/commands/:1`
- [ ] Les quatre contextes de package totalisent 131 lignes contre la cible indicative de 120. `not-applicable`

### Phase 5: Mémoires automatiques globales

- [ ] Les neuf suppressions visent `~/.claude/projects/.../memory`, hors dépôt versionné. `not-applicable`
- [ ] Les corrections de contrats visent `~/.claude/projects/.../memory`, hors dépôt versionné. `not-applicable`
- [ ] Les fusions de mémoires visent `~/.claude/projects/.../memory`, hors dépôt versionné. `not-applicable`
- [ ] L'index `MEMORY.md` visé par la phase est hors dépôt versionné. `not-applicable`
- [ ] La conservation des références globales est hors du diff versionné. `not-applicable`

### Phase 6: Réduction du bruit

- [x] Les README de couches renvoient aux règles sans doctrine parallèle. `frontend/projects/webapp/src/app/feature/README.md:1`
- [ ] Le graphe reste volontairement réparti entre des règles aux scopes exclusifs. `not-applicable`
- [x] Les coupes importantes retirent des conventions standard ou des inventaires remplaçables par une source canonique. `.claude/rules/01-standards/clean-code.md:1`
- [x] Les règles gardées citent les configurations qui appliquent les contraintes automatisées. `.claude/rules/00-architecture/layer-feature.md:1`
- [x] Frontmatter, globs et liens locaux passent les trois scans statiques. `.claude/rules/:1`
- [ ] Le seuil de 4 000 lignes était déclaré hors d'atteinte dans la phase; le corpus actuel compte 4 758 lignes. `not-applicable`

## Findings

| Sev | Kind       | Phase | Location                                                                          | Issue                                                                                                                                                                                                                                                                         | Fix                                                                                                                         |
| --- | ---------- | ----- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 🟡  | functional | 3     | `.claude/rules/05-workflows-and-processes/encryption-backend.md:127`              | La règle affirme que `authenticated` peut encore lire et mettre à jour sa ligne de clé. Depuis la migration `20260804130000`, seuls les accès `service_role` sont autorisés. La règle contredit `docs/ENCRYPTION.md:258` et la règle Supabase chargée sur les mêmes fichiers. | Remplacer cette puce par le modèle `service_role` actuel et citer la migration de verrouillage.                             |
| 🟡  | functional | 3     | `.claude/rules/05-workflows-and-processes/encryption-backend.md:35`               | L'inventaire chiffré oublie `savings_goal_plan_withdrawal.amount`, pourtant présent dans `docs/ENCRYPTION.md:49` et les types générés.                                                                                                                                        | Ajouter la table et sa colonne à l'inventaire.                                                                              |
| 🟡  | rot        | 3     | `.claude/rules/00-architecture/nestjs-architecture.md:66`                         | La liste de 14 ports actifs est déjà incomplète face aux 23 symboles exportés. Un agent peut recréer un port existant.                                                                                                                                                        | Supprimer l'inventaire et renvoyer vers `domain/ports`, ou le présenter explicitement comme quelques exemples.              |
| 🟡  | rot        | 3     | `.claude/rules/03-frameworks-and-libraries/supabase.md:118`                       | La section "Database Tables" ressemble à un inventaire mais omet la moitié des 12 tables publiques, dont `budget_line`, `savings_goal` et les tags.                                                                                                                           | Remplacer la table par un lien vers `database.types.ts` et `backend-nest/docs/DATABASE.md`, comme dans le contexte backend. |
| 🟢  | rot        | 5     | `.claude/agent-memory/ios-developer/reference_ios_build_test_env.md (deleted):10` | La suppression retire avec les détails machine une signature de corruption DerivedData observée et son diagnostic, qui ne se déduisent pas du code.                                                                                                                           | Garder uniquement la note générique sur les deux erreurs fantômes et la purge ciblée de DerivedData.                        |
| 🟢  | conform    | 3     | `.claude/rules/02-programming-languages/typescript.md:24`                         | La règle TypeScript s'applique aussi au backend mais renvoie seulement vers la règle d'erreurs PostHog frontend.                                                                                                                                                              | Qualifier le renvoi frontend et ajouter `error-handling-backend.md` pour NestJS.                                            |

## Verification

| Metric        | Value                                                                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 94% des critères applicables (30/32); 10 critères hors dépôt                                                                                                                                                                                                   |
| Files checked | 249 fichiers modifiés, 43 règles, 8 fichiers de travail actuels, 346 fichiers Markdown suivis                                                                                                                                                                  |
| Unchecked     | Phase 3 RLS `user_encryption_key`: `fix`; phase 3 inventaire chiffré: `fix`; phases 1, 4, 5 et 6 hors diff ou écarts explicitement acceptés: `not-applicable`                                                                                                  |
| Unplanned     | Publication AIDD et Impeccable, durcissement de la surface publique, restauration des badges README, suppression du job performance sans tests, corrections documentaires et nettoyages backend ponctuels; tous rattachés aux demandes ultérieures et vérifiés |
