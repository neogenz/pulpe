# Template User Story — Pulpe

Ce fichier définit le template **exact** à utiliser pour toute user story. Chaque section est obligatoire sauf indication contraire. Le template doit être copié tel quel et les placeholders remplacés.

## Template (copier-coller exact)

```markdown
## En tant que [PERSONA], je veux [ACTION] afin de [BÉNÉFICE]

### Contexte

[1-3 phrases : pourquoi cette story existe, quel problème elle résout, quel besoin utilisateur]

### Critères d'acceptation

[Regrouper par plateforme/domaine si multi-package, sinon liste simple]

- [ ] CA1: [Critère vérifiable oui/non]
- [ ] CA2: [Critère vérifiable oui/non]
- [ ] CA3: [Critère vérifiable oui/non]

### Règles métier

- [Règle 1]
- [Règle 2]
[Référencer les RG-XXX de productContext.md quand applicable]

### Notes techniques

- **Package(s) concerné(s)** : `frontend` / `backend-nest` / `ios` / `shared` / `landing`
- [Indice d'implémentation 1]
- [Indice d'implémentation 2]

### Hors périmètre

- [Ce qui n'est PAS inclus dans cette story]

---

**Estimation : [XS | S | M | L]**
```

## Règles strictes

1. **Toutes les sections sont obligatoires** — ne jamais en supprimer une
2. **Ordre des sections fixe** — toujours dans cet ordre exact
3. **Personas autorisés** : `Utilisateur` (utilisateur final) ou `Développeur` (Maxime, pour issues techniques)
4. **Critères d'acceptation** : préfixés `CA1:`, `CA2:`, etc. avec checkbox `- [ ]`. Chaque CA doit être vérifiable par oui/non
5. **Regroupement des CA** : si multi-plateforme, regrouper sous des sous-titres en gras (ex: `**Web :**`, `**iOS :**`, `**Commun :**`)
6. **Notes techniques** : toujours commencer par la ligne `Package(s) concerné(s)` en gras
7. **Estimation obligatoire** : en fin de body, séparée par `---`, en gras
8. **Langue** : tout en français
9. **Vocabulaire domaine** : utiliser les termes du glossaire Pulpe (prévisions, récurrent, prévu, etc.)
10. **Si XL** : ne pas créer la story, la découper en stories plus petites et demander validation

## Grille d'estimation

| Taille | Scope |
|--------|-------|
| **XS** | Quelques lignes de code, un seul fichier |
| **S** | Un composant ou endpoint simple |
| **M** | Plusieurs fichiers, logique métier |
| **L** | Feature complète multi-packages |
| **XL** | Trop gros → découper en stories plus petites |
