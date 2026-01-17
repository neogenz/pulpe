# Mission : Implémenter la Landing Page Pulpe

## Contexte

Tu vas créer une landing page commerciale pour Pulpe, une app de gestion budgétaire.
Le cahier des charges complet est dans : `memory-bank/LANDING-PAGE-SPEC.md`

**Lis ce fichier en entier avant de commencer.**

## Stack Technique

- **pnpm** (pas npm/yarn)
- **Vite 7** + **React 19** + **TypeScript**
- **Tailwind CSS v4** (config CSS-first, plugin Vite natif)
- **Framer Motion** (animations)
- Pas de shadcn/ui, pas de Radix — Tailwind pur

## Setup Initial

Crée le projet dans un nouveau dossier `landing/` à la racine du workspace :

```bash
cd /Users/maximedesogus/workspace/perso/_projets/pulpe-workspace
pnpm create vite@latest landing -- --template react-ts
cd landing
pnpm add tailwindcss @tailwindcss/vite framer-motion
```

Configure Tailwind v4 avec le plugin Vite (pas de postcss.config.js, pas de tailwind.config.js).

### Configuration Tailwind v4

Dans `vite.config.ts` :
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```

Dans `src/index.css` :
```css
@import "tailwindcss";

@theme {
  --color-primary: #006E25;
  --color-primary-hover: #2B883B;
  --color-background: #F6FFF0;
  --color-surface: #FFFFFF;
  --color-surface-alt: #EBFFE6;
  --color-text: #1A1C19;
  --color-text-secondary: #5D5F5B;
  --color-accent: #0061A6;
}
```

## Structure du Projet

```
landing/
├── src/
│   ├── components/
│   │   ├── ui/           # Button, Card, Badge, Container, Section
│   │   └── sections/     # Hero, PainPoints, Solution, Features, HowItWorks, WhyFree, CTA, Footer, Header
│   ├── assets/
│   │   └── screenshots/  # Placeholders pour les images
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
│   └── favicon.svg
└── index.html
```

## Instructions

### Phase 1 : Fondations
1. Setup Vite + Tailwind v4 + Framer Motion
2. Configurer les design tokens dans `@theme` (couleurs du spec)
3. Créer les composants UI de base (Button, Card, Container, Section)
4. Implémenter Header (sticky, glassmorphism) + Footer
5. Ajouter Google Fonts (Poppins 400, 600, 700)
6. Vérifier que `pnpm dev` fonctionne

**Montre-moi le résultat avant de passer à la phase 2.**

### Phase 2 : Hero + Pain Points
1. Section Hero avec :
   - Headline + Subheadline (copy du spec)
   - CTA principal (bouton vert) + CTA secondaire (lien scroll)
   - Placeholder screenshot (rectangle arrondi vert pâle avec texte "[Screenshot: Dashboard]")
2. Section Pain Points :
   - Titre "Tu connais cette sensation ?"
   - 3 cards avec icônes et textes du spec
   - Transition "Pulpe a été créée pour en finir avec ça."
3. Animations d'entrée au scroll (Framer Motion, fade-in + slide-up)

**Montre-moi le résultat avant de passer à la phase 3.**

### Phase 3 : Solution + Features
1. Section Solution :
   - Titre "Une app qui pense à l'année pour que tu profites du mois"
   - Texte d'accroche (copy du spec)
   - Grand placeholder screenshot
2. Section Features (4 piliers) :
   - Layout zigzag sur desktop (image gauche/droite alternée)
   - Stack vertical sur mobile
   - Chaque feature : titre, description, badge bénéfice, placeholder screenshot
   - Copy exact du spec

**Montre-moi le résultat avant de passer à la phase 4.**

### Phase 4 : Sections Finales
1. Section "Comment ça marche" :
   - Titre "Prêt en 3 minutes"
   - 3 étapes numérotées avec icônes
   - CTA "Créer mon budget"
2. Section "Pourquoi Pulpe est gratuit" :
   - Fond légèrement différent (vert très pâle)
   - 3 blocs de texte (Un projet né d'un vrai besoin / Gratuit et open source / Tes données sont protégées)
   - Signature "— Maxime, créateur de Pulpe"
   - Badges : "Open Source" | "Hébergé en Europe" | "Données masquées"
   - Liens vers GitHub, CGU, Privacy
3. Section CTA Final :
   - Fond primary ou gradient
   - Titre "Prêt à reprendre le contrôle ?"
   - Gros bouton CTA

**Montre-moi le résultat avant de passer à la phase 5.**

### Phase 5 : Polish
1. Responsive :
   - Vérifier mobile (< 768px) : stack vertical, padding réduit, boutons full-width
   - Vérifier tablet (≥ 768px) : grid 2 colonnes
   - Vérifier desktop (≥ 1024px) : layout complet
2. Animations :
   - Toutes les sections ont un fade-in au scroll
   - Hover sur boutons : scale 1.02 + ombre
   - Hover sur cards : légère élévation
   - Respecter `prefers-reduced-motion`
3. Accessibilité :
   - Skip link "Aller au contenu"
   - Focus visible (outline vert)
   - Alt texts sur les placeholders
   - Hiérarchie H1 > H2 > H3 respectée
4. SEO :
   - Meta title et description dans index.html
   - Open Graph tags
5. Nettoyage :
   - Supprimer le code Vite par défaut (App.css, assets inutiles)
   - Vérifier que le build fonctionne (`pnpm build`)

## Palette de Couleurs (Référence)

| Usage | Tailwind class | Hex |
|-------|----------------|-----|
| Primary (CTA) | `bg-primary` | #006E25 |
| Primary hover | `hover:bg-primary-hover` | #2B883B |
| Background | `bg-background` | #F6FFF0 |
| Surface (cards) | `bg-surface` | #FFFFFF |
| Surface alt | `bg-surface-alt` | #EBFFE6 |
| Texte | `text-text` | #1A1C19 |
| Texte secondaire | `text-text-secondary` | #5D5F5B |
| Accent (bleu) | `text-accent` | #0061A6 |

## Typographie

- **Font** : Poppins (Google Fonts)
- **H1** : 48-56px desktop, 32px mobile, font-bold
- **H2** : 32-40px desktop, 24px mobile, font-semibold
- **H3** : 24-28px, font-semibold
- **Body** : 16-18px, font-normal
- **Boutons** : 16-18px, font-semibold

## Contraintes Importantes

- **Mobile-first** : développe d'abord pour mobile, enrichis pour desktop
- **Placeholders** : rectangles avec `bg-surface-alt` (vert pâle) et texte "[Screenshot: description]"
- **Copy exact** : utilise les textes du spec, ne réécris pas
- **Pas d'over-engineering** : composants simples, pas d'abstractions inutiles
- **Français** : tout le contenu est en français

## Ce qu'il ne faut PAS faire

- ❌ Ajouter shadcn/ui, Radix, ou autres libs de composants
- ❌ Créer une section pricing ou témoignages (hors scope V1)
- ❌ Utiliser npm au lieu de pnpm
- ❌ Créer un tailwind.config.js (Tailwind v4 = CSS-first)
- ❌ Mettre des animations agressives (bounce, elastic)
- ❌ Oublier `prefers-reduced-motion`
- ❌ Inventer du copy — tout est dans le spec

## Livrable Final

Une landing page fonctionnelle :
- `pnpm dev` → http://localhost:5173
- `pnpm build` → build production fonctionnel
- Responsive (mobile, tablet, desktop)
- Accessible (Lighthouse Accessibility > 90)
- Performant (Lighthouse Performance > 90)

## Référence

Le cahier des charges complet avec tous les détails (copy, specs visuelles, accessibilité, performance) est dans :
**`memory-bank/LANDING-PAGE-SPEC.md`**

Consulte-le pour chaque section.
