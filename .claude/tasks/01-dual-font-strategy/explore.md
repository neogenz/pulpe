# Task: Dual Font Strategy - Plus Jakarta Sans + JetBrains Mono

## Résumé

**Faisabilité: OUI, facilement réalisable** avec deux approches possibles:

1. **Approche recommandée** : Garder une seule police (Plus Jakarta Sans) et utiliser `font-variant-numeric: tabular-nums` pour les montants alignés
2. **Approche demandée** : Utiliser deux polices distinctes (Plus Jakarta Sans pour le texte, JetBrains Mono pour les montants)

---

## Codebase Context

### Configuration Actuelle des Fonts

| Fichier | Rôle |
|---------|------|
| `projects/webapp/src/index.html:9-17` | Chargement Google Fonts (Poppins) |
| `projects/webapp/src/_variables.scss:1-2` | Variables SCSS pour Material |
| `projects/webapp/src/styles.scss:21-24` | Configuration Material v20 typography |
| `projects/webapp/src/app/styles/vendors/_tailwind.css:210-213` | Variables CSS Tailwind (`--font-mono`) |

### État Actuel

```scss
// _variables.scss
$heading-font-family: Poppins, sans-serif;
$regular-font-family: Poppins, sans-serif;
```

```css
/* _tailwind.css:209-213 */
--font-sans: var(--mat-sys-body-large-font), sans-serif;
--font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
--font-display: var(--mat-sys-display-large-font), sans-serif;
```

**Note importante**: JetBrains Mono est défini mais **PAS chargé** - il n'y a pas d'import Google Fonts ou @font-face.

### Composants Affichant des Montants

| Composant | Fichier | Format |
|-----------|---------|--------|
| CurrencyInput | `ui/currency-input/currency-input.ts` | Input CHF |
| FinancialSummary | `ui/financial-summary/financial-summary.ts:44` | `CurrencyPipe 'CHF':'symbol':'1.2-2':'de-CH'` |
| FinancialEntry | `feature/current-month/components/financial-entry.ts:100` | `DecimalPipe '1.2-2':'de-CH'` |
| BudgetFinancialOverview | `feature/budget/budget-details/budget-financial-overview.ts:39-98` | `DecimalPipe '1.0-0':'de-CH'` |
| BudgetTable | `feature/budget/budget-details/budget-table/budget-table.ts:169-172` | `CurrencyPipe '1.0-0'` |

---

## Documentation Insights

### Tailwind CSS v4 - Fonts

Configuration dans `@theme` (pas de tailwind.config.js en v4) :

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
@import "tailwindcss";

@theme {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
```

### Angular Material v20 - Typography

```scss
@use '@angular/material' as mat;

html {
  @include mat.theme((
    typography: (
      plain-family: "Plus Jakarta Sans",
      brand-family: "Plus Jakarta Sans",
    ),
  ));
}
```

### Font-Variant-Numeric (Alternative)

```css
/* Chiffres tabulaires sans changer de police */
.amount {
  font-variant-numeric: tabular-nums;
}
```

**Support navigateur**: 97%+ (Chrome 52+, Firefox 34+, Safari 9.1+)

---

## Research Findings

### Plus Jakarta Sans

- **Type**: Géométrique moderne, inspiré Futura/Neuzit Grotesk
- **Poids**: 200-800 (variable font disponible)
- **Source**: Google Fonts gratuit
- **Caractéristiques**: Hauteur x élevée, counters ouverts, excellente lisibilité

### Pairing Plus Jakarta Sans + JetBrains Mono

Ce pairing fonctionne car:
- Plus Jakarta Sans (géométrique, ouvert) complète JetBrains Mono (technique, haute lisibilité)
- Les deux sont gratuits et bien maintenus
- JetBrains Mono a des ligatures code-spécifiques et supporte tabular-nums

### Recommandation Experte

**Ne pas changer de police pour les nombres** - utiliser `font-variant-numeric: tabular-nums` :
- Moins de requêtes HTTP
- Cohérence visuelle
- Meilleures performances
- Pas de décalage baseline

---

## Key Files à Modifier

| Fichier | Action |
|---------|--------|
| `projects/webapp/src/index.html:12-17` | Remplacer Poppins par Plus Jakarta Sans |
| `projects/webapp/src/_variables.scss:1-2` | Changer `$heading-font-family` et `$regular-font-family` |
| `projects/webapp/src/app/styles/vendors/_tailwind.css:209-213` | Mettre à jour `--font-sans` |

### Optionnel (si JetBrains Mono pour montants)

| Fichier | Action |
|---------|--------|
| `projects/webapp/src/index.html` | Ajouter import Google Fonts JetBrains Mono |
| `projects/webapp/src/app/styles/vendors/_tailwind.css` | Créer classe utilitaire `.font-amount` |
| Composants montants | Ajouter classe `font-mono` ou `font-amount` |

---

## Patterns to Follow

### Pattern Existant: Material Typography Tokens

Les fonts passent par les variables CSS Material (`--mat-sys-body-large-font`) puis Tailwind.

### Pattern Existant: Tailwind Typography Utilities

Classes existantes: `text-display-*`, `text-headline-*`, `text-title-*`, `text-body-*`, `text-label-*`

### Pattern Existant: Font Mono

La classe `font-mono` existe déjà et utilise JetBrains Mono (voir `about-dialog.ts:38`).

---

## Deux Stratégies Possibles

### Option A: Font Unique + Tabular Nums (Recommandée)

```css
/* Plus Jakarta Sans partout, chiffres tabulaires pour alignement */
.amount, .currency, .financial-data {
  font-variant-numeric: tabular-nums;
}
```

**Avantages**: Simple, performant, cohérent
**Inconvénients**: Pas d'esthétique "monospace" pour les chiffres

### Option B: Dual Font Strategy (Demandée)

```css
/* Plus Jakarta Sans pour texte, JetBrains Mono pour montants */
--font-body: "Plus Jakarta Sans", sans-serif;
--font-amount: "JetBrains Mono", monospace;
```

**Avantages**: Distinction visuelle forte, esthétique technique
**Inconvénients**: +1 font à charger (~100KB), maintenance des classes

---

## Dependencies

- Google Fonts CDN (déjà utilisé pour Poppins)
- Aucune nouvelle dépendance npm requise

---

## Blockers / Concerns

1. **JetBrains Mono non chargé actuellement** - nécessite ajout d'import
2. **Roboto chargé mais non utilisé** (`index.html:16`) - à nettoyer
3. **Migration ~30 composants** si classe explicite pour montants (Option B)

---

## Next Step

Lancer `/epct:plan 01-dual-font-strategy` pour créer le plan d'implémentation détaillé.
