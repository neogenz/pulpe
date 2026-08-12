# Review: Nettoyage final du contexte projet

- **Verdict**: approve
- **Diff**: `25e7b17b1...WORKTREE`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_08_12
- **Findings**: 0 critical, 0 warning, 0 minor

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
- [x] La règle de chiffrement décrit l'accès `service_role` exclusif introduit par la migration de verrouillage. `.claude/rules/05-workflows-and-processes/encryption-backend.md:128`
- [x] Les appels iOS 26 sont gardés et les APIs citées ont des ancres dans les sources installées. `.claude/rules/03-frameworks-and-libraries/swiftui.md:1`
- [x] La liste des colonnes chiffrées inclut `savings_goal_plan_withdrawal.amount`. `.claude/rules/05-workflows-and-processes/encryption-backend.md:42`
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
- [ ] Le seuil indicatif de 4 000 lignes était déclaré hors d'atteinte dans la phase et n'est pas un critère bloquant. `not-applicable`

## Findings

None.

## Verification

| Metric        | Value                                                                                                                                                                                                                                                          |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Verified      | 100% des critères applicables (32/32); 10 critères hors dépôt                                                                                                                                                                                                  |
| Files checked | Périmètre du diff indiqué ci-dessus, corpus de règles et graphe des liens Markdown locaux au moment de la revue                                                                                                                                                |
| Unchecked     | Phases 1, 4, 5 et 6 hors diff ou écarts explicitement acceptés: `not-applicable`; aucun critère `fix` ouvert                                                                                                                                                   |
| Unplanned     | Publication AIDD et Impeccable, durcissement de la surface publique, restauration des badges README, suppression du job performance sans tests, corrections documentaires et nettoyages backend ponctuels; tous rattachés aux demandes ultérieures et vérifiés |
