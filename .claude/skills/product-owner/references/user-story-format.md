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

**Estimation : [2 | 3 | 5 | 8 | 13 | 20] points**
```

## Règles strictes

1. **Toutes les sections sont obligatoires** — ne jamais en supprimer une
2. **Ordre des sections fixe** — toujours dans cet ordre exact
3. **Personas autorisés** : `Utilisateur` (utilisateur final) ou `Développeur` (Maxime, pour issues techniques)
4. **Critères d'acceptation** : préfixés `CA1:`, `CA2:`, etc. avec checkbox `- [ ]`. Chaque CA doit être vérifiable par oui/non
5. **Regroupement des CA** : si multi-plateforme, regrouper sous des sous-titres en gras (ex: `**Web :**`, `**iOS :**`, `**Commun :**`)
6. **Notes techniques** : toujours commencer par la ligne `Package(s) concerné(s)` en gras
7. **Estimation obligatoire** : en fin de body, séparée par `---`, en gras. Utiliser les story points (voir barème ci-dessous)
8. **Langue** : tout en français
9. **Vocabulaire domaine** : utiliser les termes du glossaire Pulpe (prévisions, récurrent, prévu, etc.)
10. **Si > 20 points** : ne pas créer la story, la découper en stories plus petites et demander validation

## Barème d'estimation (Story Points)

| Points | Critères |
|--------|----------|
| **2** | Trivial — quelques lignes, un seul fichier, zéro doute |
| **3** | Petit dev pas trop compliqué sur une seule couche (ex: uniquement Angular ou uniquement iOS). Petit bug simple à analyser et corriger |
| **5** | Dev "simple" mais multi-couches (ex: Angular + NestJS). OU dev un peu plus complexe sur une seule couche (règles métier, complexité graphique). OU bug un peu complexe |
| **8** | Dev multi-couches nécessitant conception / modélisation / architecture, long mais sans trop de doutes sur la complexité. OU bug complexe, compliqué à analyser et/ou reproduire |
| **13** | Dev très complexe (ou très long) multi-couches, nécessitant conception / architecture, avec des doutes sur la complexité ou la profondeur. OU bug très compliqué impliquant probablement toutes les couches, une refacto, ou de l'analyse de code |
| **20** | Sujet extrêmement compliqué ET/OU extrêmement chronophage, avec du doute et de l'inconnu |

### Règles d'estimation

- **Couches** : `frontend`, `backend-nest`, `ios`, `shared`, `landing` — chaque package touché = une couche
- **Toujours estimer en relatif** : comparer à des stories déjà estimées du même projet
- **En cas de doute, arrondir vers le haut** : mieux vaut surestimer que sous-estimer
- **L'estimation porte sur la complexité**, pas sur le temps — un dev de 2h sur du code crypto vaut plus qu'un dev de 4h sur du copier-coller
- Lors de la création d'une issue, passer le champ `estimate` à Linear avec la valeur en points
