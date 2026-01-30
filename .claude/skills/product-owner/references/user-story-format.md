# Format User Story — Pulpe

## Structure

```markdown
## En tant que [persona], je veux [action] afin de [bénéfice]

### Contexte
[Pourquoi cette story existe, quel problème elle résout]

### Critères d'acceptation
- [ ] CA1: [Critère vérifiable]
- [ ] CA2: [Critère vérifiable]
- [ ] CA3: [Critère vérifiable]

### Règles métier
- [Règle 1]
- [Règle 2]

### Notes techniques
- [Indice d'implémentation si pertinent]
- [Package(s) concerné(s): frontend / backend-nest / ios / shared]

### Hors périmètre
- [Ce qui n'est PAS inclus dans cette story]
```

## Personas

| Persona | Description |
|---------|-------------|
| Utilisateur | Utilisateur final de l'app Pulpe |
| Développeur | Maxime (pour les issues techniques) |

## Règles

- Écrire en français
- Chaque CA doit être vérifiable (oui/non)
- Inclure les packages concernés dans les notes techniques
- Référencer les règles métier de `memory-bank/productContext.md` quand applicable
- Garder les stories petites et livrables indépendamment
- Si une story est trop grosse, la découper et créer une issue parente avec des sous-issues

## Estimation

Utiliser des tailles de t-shirt pour estimer l'effort :

| Taille | Effort |
|--------|--------|
| XS | Quelques lignes de code, < 1h |
| S | Un composant ou endpoint simple |
| M | Plusieurs fichiers, logique métier |
| L | Feature complète multi-packages |
| XL | À découper en stories plus petites |
