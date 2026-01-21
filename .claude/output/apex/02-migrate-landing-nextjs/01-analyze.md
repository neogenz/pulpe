# Step 01: Analyze

**Task:** Migration Landing Page vers Next.js avec SSG pour performance Lighthouse ≥ 95
**Started:** 2026-01-20T20:16:00Z

---

## Context Discovery

### Codebase Context

#### Current Landing Page (`landing/`)

| Category | Details |
|----------|---------|
| Framework | React 19.2.0 + Vite 7.2.4 |
| Styling | Tailwind CSS v4.1.18 (@tailwindcss/vite plugin) |
| Animations | Framer Motion 12.26.2 |
| TypeScript | 5.9.3 |
| Total Components | 23 (10 sections + 13 UI) |
| Total Lines | ~1,800 |

#### Component Inventory

**Section Components** (`landing/src/components/sections/`):
| File | Lines | Purpose |
|------|-------|---------|
| `Header.tsx` | 224 | Fixed nav with liquid-glass effect, mobile menu |
| `Hero.tsx` | 254 | Typewriter, floating cards, CTA buttons |
| `PainPoints.tsx` | 53 | 3 problem statement cards |
| `Solution.tsx` | 31 | Value prop with screenshot |
| `Features.tsx` | 85 | 4 alternating feature sections |
| `HowItWorks.tsx` | 43 | 3-step onboarding flow |
| `Platforms.tsx` | 87 | Web/iOS/Android download cards |
| `WhyFree.tsx` | 69 | Open source explanation |
| `FinalCTA.tsx` | 27 | Final call-to-action |
| `Footer.tsx` | 44 | Legal links, GitHub, contact |

**UI Components** (`landing/src/components/ui/`):
| File | Lines | Purpose |
|------|-------|---------|
| `Badge.tsx` | 29 | Pill badges (primary/accent) |
| `Button.tsx` | 38 | CTA buttons (3 variants) |
| `Card.tsx` | 31 | Content cards |
| `Container.tsx` | 22 | Max-width wrapper |
| `FadeIn.tsx` | 64 | Scroll-triggered animation |
| `FloatingCard.tsx` | 91 | 7 floating card variants |
| `GridBackground.tsx` | 37 | Grid pattern background |
| `HeroScreenshot.tsx` | 38 | Animated hero screenshot |
| `ImageLightbox.tsx` | 94 | Modal lightbox (Framer Motion) |
| `Screenshot.tsx` | 102 | WebP + lazy loading + lightbox |
| `Section.tsx` | 31 | Section wrapper |
| `ShineBorder.tsx` | 50 | Animated gradient border |
| `TypeWriter.tsx` | 35 | Typing animation (react-typed) |

**Context/Hooks**:
- `ImageLightboxProvider.tsx` (51 lines) - Context for lightbox state
- `useImageLightbox.ts` (13 lines) - Hook to access context

#### Routes & Navigation

**Current (SPA with anchor links):**
- Hash navigation: `#features`, `#how-it-works`, `#platforms`, `#why-free`
- External links to Angular app: `/signup`, `/welcome`
- Legal pages: `/legal/cgu`, `/legal/confidentialite`

#### Assets

**Images** (`landing/public/screenshots/`):
- 10 PNG + 10 WebP files
- Responsive variants: `responsive/*.webp`
- Desktop variants: `webapp/*.webp`
- LCP preloads configured in index.html

#### Styling

**Tailwind v4** (`landing/src/index.css`):
- CSS-first config via `@theme` block (no tailwind.config.js)
- Custom colors: primary (#006E25), accent (#0061A6), etc.
- Custom shadows: card, screenshot, glass, liquid-glass
- CSS animations: `shine-border-effect`, `float-bob`
- Font: Poppins (Google Fonts)

---

### Monorepo Structure

```
seoul-v1/
├── frontend/          # Angular 21 webapp
├── backend-nest/      # NestJS API
├── shared/            # Zod schemas
├── landing/           # Current React landing (to migrate)
├── vercel.json        # Deployment routing
├── turbo.json         # Build orchestration
└── pnpm-workspace.yaml
```

**Build Pipeline** (from `vercel.json`):
```bash
turbo build --filter=pulpe-frontend    # Angular
pnpm build:landing                      # Vite landing
pnpm build:merge                        # Merge to dist/
```

**Merge Script**:
```bash
mkdir -p dist
cp -r landing/dist dist/landing
cp -r frontend/dist/webapp/browser/* dist/
mv dist/index.html dist/_app.html
```

---

### Vercel Routing (`vercel.json`)

**Current Rewrites:**
```json
1. "/" → "/landing/index.html"           (Landing)
2. "/screenshots/:path*" → "/landing/..."  (Assets)
3. "/icon.png" → "/landing/icon.png"      (Icons)
4. "/:path*" → "/_app.html"               (Angular catch-all)
```

**Key insight:** Landing served from `/landing/` subdirectory, Angular from root with `_app.html`

---

### Next.js Requirements (from docs)

| Feature | Implementation |
|---------|----------------|
| App Router | `app/layout.tsx` required with `<html>` + `<body>` |
| Static Export | `output: 'export'` in next.config |
| Metadata | `export const metadata` or `generateMetadata()` |
| Images | `next/image` with dimensions or `fill` + `sizes` |
| Fonts | `next/font/google` with `display: 'swap'` |
| Tailwind v4 | `@tailwindcss/postcss` plugin |
| Monorepo | `outputFileTracingRoot` for dependencies |

---

### Patterns Observed

1. **Component Structure**: Sections import UI components, clear separation
2. **Animation Pattern**: `FadeIn` wrapper with `whileInView` for scroll animations
3. **Image Pattern**: WebP with PNG fallback via `<picture>` element
4. **Responsive**: Mobile-first with Tailwind breakpoints
5. **Accessibility**: Skip links, ARIA labels, reduced motion support
6. **Liquid Glass**: Complex SVG filter in Header (unique effect)

---

### Dependencies to Handle

| Current (Vite) | Next.js Equivalent |
|----------------|-------------------|
| `@tailwindcss/vite` | `@tailwindcss/postcss` |
| `react-typed` | Keep (client component) |
| `framer-motion` | Keep with `'use client'` |
| Vite base path | `basePath` in next.config |
| `index.html` preloads | Metadata API / next/head |

---

## Inferred Acceptance Criteria

Based on task description and analysis:

- [ ] AC1: All 23 components migrated with identical visual output
- [ ] AC2: Framer Motion animations work (with `'use client'`)
- [ ] AC3: TypeWriter effect works (with `'use client'`)
- [ ] AC4: Image lightbox functional
- [ ] AC5: Liquid glass header effect preserved
- [ ] AC6: All routes work: `/`, `/welcome`, `/signup`, `/legal/*`
- [ ] AC7: Angular app accessible on all other routes
- [ ] AC8: `vercel deploy` succeeds without errors
- [ ] AC9: Lighthouse Performance ≥ 95
- [ ] AC10: Lighthouse Accessibility ≥ 95
- [ ] AC11: Lighthouse Best Practices ≥ 95
- [ ] AC12: Lighthouse SEO ≥ 95

---

## Step Complete

**Status:** ✓ Complete
**Files found:** 32 TypeScript files in landing/
**Patterns identified:** 5 major patterns
**Next:** step-02-plan.md
**Timestamp:** 2026-01-20T20:18:00Z
