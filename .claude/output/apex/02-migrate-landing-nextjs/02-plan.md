# Step 02: Plan

**Task:** Migration Landing Page vers Next.js avec SSG pour performance Lighthouse ≥ 95
**Started:** 2026-01-20T20:20:00Z

---

## Implementation Plan

### Overview

Create a new Next.js 15 project (`landing-next/`) with App Router and static export, migrate all 23 components from the existing Vite React landing, update Vercel routing to serve Next.js output while preserving Angular app access.

### Strategy

1. **Parallel development**: Create `landing-next/` alongside `landing/` for safe migration
2. **Static export**: Use `output: 'export'` for pure HTML/CSS/JS output
3. **Minimal changes**: Keep component logic identical, only add `'use client'` where needed
4. **Same output structure**: Configure `distDir` to match current merge script expectations

---

## Prerequisites

- [ ] Node.js 20+ (required for Next.js 15)
- [ ] pnpm workspace entry for `landing-next`

---

## File Changes

### Phase 1: Project Setup

#### `landing-next/package.json` (NEW FILE)
- Create package.json with:
  - `name: "pulpe-landing-next"`
  - Dependencies: `next@15`, `react@19`, `react-dom@19`, `framer-motion`, `react-typed`
  - DevDeps: `typescript`, `@types/react`, `@types/node`, `tailwindcss@4`, `@tailwindcss/postcss`
  - Scripts: `dev`, `build`, `start`

#### `landing-next/next.config.ts` (NEW FILE)
- `output: 'export'` for static generation
- `distDir: 'dist'` to match current build merge
- `images: { unoptimized: true }` (required for static export)
- `basePath: '/landing'` for Vercel routing
- `trailingSlash: false`

#### `landing-next/tsconfig.json` (NEW FILE)
- Standard Next.js TypeScript config
- Strict mode enabled
- Path aliases: `@/*` → `./`

#### `landing-next/postcss.config.mjs` (NEW FILE)
- Plugin: `@tailwindcss/postcss` (Tailwind v4)

---

### Phase 2: Styles & Utilities

#### `landing-next/app/globals.css` (NEW FILE)
- Copy from `landing/src/index.css`
- Keep `@import "tailwindcss"` and `@theme` block
- Keep all custom animations (`shine-border-effect`, `float-bob`)
- Keep responsive `--grid-size` variable
- Remove any Vite-specific imports

#### `landing-next/lib/cn.ts` (NEW FILE)
- Copy from `landing/src/lib/cn.ts` (simple className utility)

---

### Phase 3: UI Components (13 files)

#### Server Components (no changes needed):

#### `landing-next/components/ui/Badge.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/Badge.tsx`
- No `'use client'` needed (pure render)

#### `landing-next/components/ui/Button.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/Button.tsx`
- No `'use client'` needed (pure render)

#### `landing-next/components/ui/Card.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/Card.tsx`
- No `'use client'` needed

#### `landing-next/components/ui/Container.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/Container.tsx`
- No `'use client'` needed

#### `landing-next/components/ui/Section.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/Section.tsx`
- No `'use client'` needed

#### `landing-next/components/ui/GridBackground.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/GridBackground.tsx`
- No `'use client'` needed

#### `landing-next/components/ui/ShineBorder.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/ShineBorder.tsx`
- No `'use client'` needed (CSS animation only)

#### Client Components (need 'use client'):

#### `landing-next/components/ui/FadeIn.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/FadeIn.tsx`
- ADD `'use client'` at top (uses Framer Motion hooks)

#### `landing-next/components/ui/FloatingCard.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/FloatingCard.tsx`
- ADD `'use client'` at top (uses Framer Motion)

#### `landing-next/components/ui/HeroScreenshot.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/HeroScreenshot.tsx`
- ADD `'use client'` at top (uses Framer Motion)

#### `landing-next/components/ui/Screenshot.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/Screenshot.tsx`
- ADD `'use client'` at top (uses useState, onClick)
- Update image paths: keep `/screenshots/...` (works with basePath)

#### `landing-next/components/ui/ImageLightbox.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/ImageLightbox.tsx`
- ADD `'use client'` at top (uses Framer Motion, useEffect, Portal)

#### `landing-next/components/ui/TypeWriter.tsx` (NEW FILE)
- Copy from `landing/src/components/ui/TypeWriter.tsx`
- ADD `'use client'` at top (uses react-typed library)

---

### Phase 4: Context (3 files)

#### `landing-next/contexts/ImageLightboxContext.ts` (NEW FILE)
- Copy from `landing/src/contexts/ImageLightboxContext.ts`
- No changes needed

#### `landing-next/contexts/ImageLightboxProvider.tsx` (NEW FILE)
- Copy from `landing/src/contexts/ImageLightboxProvider.tsx`
- ADD `'use client'` at top (uses useState, Context)

#### `landing-next/contexts/useImageLightbox.ts` (NEW FILE)
- Copy from `landing/src/contexts/useImageLightbox.ts`
- No changes needed (hook file)

---

### Phase 5: Section Components (10 files)

#### `landing-next/components/sections/Header.tsx` (NEW FILE)
- Copy from `landing/src/components/sections/Header.tsx`
- ADD `'use client'` at top (uses useState, useEffect for scroll)
- Keep liquid-glass SVG filter intact

#### `landing-next/components/sections/Hero.tsx` (NEW FILE)
- Copy from `landing/src/components/sections/Hero.tsx`
- ADD `'use client'` at top (uses Framer Motion for floating cards)

#### `landing-next/components/sections/PainPoints.tsx` (NEW FILE)
- Copy from `landing/src/components/sections/PainPoints.tsx`
- No `'use client'` needed (uses FadeIn wrapper which is already client)

#### `landing-next/components/sections/Solution.tsx` (NEW FILE)
- Copy from `landing/src/components/sections/Solution.tsx`
- No `'use client'` needed

#### `landing-next/components/sections/Features.tsx` (NEW FILE)
- Copy from `landing/src/components/sections/Features.tsx`
- No `'use client'` needed

#### `landing-next/components/sections/HowItWorks.tsx` (NEW FILE)
- Copy from `landing/src/components/sections/HowItWorks.tsx`
- No `'use client'` needed

#### `landing-next/components/sections/Platforms.tsx` (NEW FILE)
- Copy from `landing/src/components/sections/Platforms.tsx`
- No `'use client'` needed

#### `landing-next/components/sections/WhyFree.tsx` (NEW FILE)
- Copy from `landing/src/components/sections/WhyFree.tsx`
- No `'use client'` needed

#### `landing-next/components/sections/FinalCTA.tsx` (NEW FILE)
- Copy from `landing/src/components/sections/FinalCTA.tsx`
- No `'use client'` needed

#### `landing-next/components/sections/Footer.tsx` (NEW FILE)
- Copy from `landing/src/components/sections/Footer.tsx`
- No `'use client'` needed

---

### Phase 6: Pages

#### `landing-next/app/page.tsx` (NEW FILE)
- Create main landing page
- Import and render all sections in order:
  - Header, Hero, PainPoints, Solution, Features, HowItWorks, Platforms, WhyFree, FinalCTA, Footer
- Wrap with ImageLightboxProvider
- Keep skip-to-content link for accessibility
- Include `<div id="lightbox-root" />` for portal

#### `landing-next/app/legal/cgu/page.tsx` (NEW FILE)
- Create Terms of Service page
- Static content (can be placeholder or actual content)
- Follow existing route `/legal/cgu`

#### `landing-next/app/legal/confidentialite/page.tsx` (NEW FILE)
- Create Privacy Policy page
- Static content
- Follow existing route `/legal/confidentialite`

---

### Phase 7: Layout & Metadata

#### `landing-next/app/layout.tsx` (NEW FILE)
- Root layout with `<html lang="fr">` and `<body>`
- Import Poppins font via `next/font/google`
- Import `globals.css`
- Include ImageLightboxProvider wrapper
- Define comprehensive metadata:
  - Title: "Pulpe — L'app budget simple pour planifier ton année"
  - Description (from current index.html)
  - Open Graph (locale: fr_FR, type: website)
  - Twitter Card (summary_large_image)
  - Canonical URL: https://pulpe.app/
  - Robots: index, follow

---

### Phase 8: Assets

#### `landing-next/public/` (COPY)
- Copy entire `landing/public/` folder:
  - `screenshots/responsive/*.webp` (5 files)
  - `screenshots/webapp/*.webp` (5 files)
  - `screenshots/responsive/*.png` (5 files)
  - `screenshots/webapp/*.png` (5 files)
  - `icon.png`
  - `icon-original.png`

---

### Phase 9: Build Configuration Updates

#### `pnpm-workspace.yaml` (MODIFY)
- Add `landing-next` to packages list
- Keep `landing` temporarily for comparison

#### `package.json` (root) (MODIFY)
- Update `build:landing` script: `pnpm --filter=pulpe-landing-next build`
- Update `build:merge` script to use `landing-next/dist` instead of `landing/dist`

#### `vercel.json` (MODIFY)
- No routing changes needed (same output structure)
- Rewrites still point to `/landing/index.html`

#### `turbo.json` (MODIFY)
- Add `pulpe-landing-next` to build pipeline if needed

---

## Summary

| Category | Count |
|----------|-------|
| New files | 35 |
| Modified files | 4 |
| Client components | 10 (`'use client'`) |
| Server components | 17 |
| Lines to migrate | ~1,800 |

---

## Acceptance Criteria Mapping

| AC | Implementation |
|----|----------------|
| AC1: 23 components migrated | All files in Phase 3-5 |
| AC2: Framer Motion works | `'use client'` on FadeIn, FloatingCard, Hero, etc. |
| AC3: TypeWriter works | `'use client'` on TypeWriter.tsx |
| AC4: Lightbox functional | ImageLightbox + Provider with `'use client'` |
| AC5: Liquid glass preserved | Header.tsx copied with SVG filter intact |
| AC6: All routes work | page.tsx + legal/*/page.tsx |
| AC7: Angular accessible | vercel.json catch-all unchanged |
| AC8: vercel deploy works | Same dist structure, minimal config changes |
| AC9-12: Lighthouse ≥ 95 | SSG + next/font + optimized images |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Static export limitations | Use `images: { unoptimized: true }`, avoid dynamic features |
| Framer Motion SSR issues | `'use client'` on all animated components |
| react-typed SSR issues | `'use client'` + possible dynamic import |
| basePath conflicts | Test all internal links with `/landing` prefix |
| Font loading regression | next/font auto-optimizes, verify with Lighthouse |

---

## Execution Order

1. Create project structure and configs
2. Copy styles and utilities
3. Migrate UI components (server first, then client)
4. Migrate contexts
5. Migrate section components
6. Create pages and layout
7. Copy assets
8. Update build configs
9. Test locally with `pnpm dev`
10. Build and verify output structure
11. Test with Vercel preview deployment
12. Run Lighthouse audit

---

## Step Complete

**Status:** ✓ Complete
**Files planned:** 39 (35 new + 4 modified)
**Tests planned:** 0 (no test mode)
**Next:** step-03-execute.md
**Timestamp:** 2026-01-20T20:25:00Z
