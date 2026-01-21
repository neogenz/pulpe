# Step 01: Analyze

**Task:** Share legal pages between landing and Angular app (prefer Angular originals)
**Started:** 2026-01-21T11:32:00Z

---

## Context Discovery

### Related Files Found

| File | Lines | Contains |
|------|-------|----------|
| `frontend/.../legal/components/terms-of-service.ts` | 1-186 | **Angular CGU** - 10 sections, comprehensive |
| `frontend/.../legal/components/privacy-policy.ts` | 1-274 | **Angular Privacy** - 13 sections, very detailed |
| `frontend/.../legal/legal.routes.ts` | 1-22 | Angular route config |
| `landing/app/legal/cgu/page.tsx` | 1-92 | **Next.js CGU** - 9 sections, simplified |
| `landing/app/legal/confidentialite/page.tsx` | 1-113 | **Next.js Privacy** - 9 sections, simplified |
| `frontend/.../core/routing/routes-constants.ts` | 11-36 | Route path constants |

### Content Comparison

| Aspect | Angular Version | Next.js Version |
|--------|----------------|-----------------|
| CGU sections | 10 | 9 |
| Privacy sections | 13 | 9 |
| Financial disclaimer | ✅ Yes (section 6) | ❌ No |
| Analytics detail | Very detailed (PostHog EU) | Brief mention |
| Infrastructure detail | Comprehensive (Supabase, Railway, Vercel) | Simplified |
| Cookie policy | Detailed (section 10) | Brief |
| Children policy | Yes (section 11) | No |
| RGPD/LPD Swiss law | Yes | RGPD only |
| Last updated | Dynamic (`currentDate`) | Static "janvier 2025" |
| Styling | Material classes | Tailwind prose |

### Patterns Observed

**Angular Legal Structure:**
- Standalone components with `OnPush` change detection
- Content embedded in inline templates (no external files)
- Material Design typography: `text-display-small`, `text-headline-medium`
- Uses `RouterLink` with `ROUTES` constants for internal navigation
- Dynamic date via `toLocaleDateString('fr-CH')`

**Next.js Landing Structure:**
- App Router: `/app/legal/[slug]/page.tsx`
- SEO metadata exported from pages
- Tailwind prose styling: `prose prose-neutral dark:prose-invert`
- Next.js `Link` component for navigation
- Static date string

**Key Finding: No Content Sharing Exists**
- Legal content hardcoded in both apps
- No markdown/JSON content files
- No API endpoints for legal text
- `shared/` package contains only Zod schemas, no content

### External Research Findings

**Recommended Approach: Shared Content Package**
- Create `shared/content/` with markdown or JSON legal content
- Both apps import and render with their respective styling
- Single source of truth maintained in one place

**Gotchas Identified:**
- Angular's `DOMSanitizer` may rewrite element IDs
- React's `react-markdown` disables raw HTML by default
- Different sanitization behaviors require pure Markdown (no raw HTML)

---

## Inferred Acceptance Criteria

Based on task and context:

- [ ] AC1: Legal content maintained in single source (Angular is source of truth)
- [ ] AC2: Both apps display identical legal text content
- [ ] AC3: Each app uses its own styling system (Material vs Tailwind)
- [ ] AC4: Navigation works correctly within each app
- [ ] AC5: SEO preserved for landing pages (metadata)

---

## Step Complete

**Status:** ✓ Complete
**Files found:** 6 primary
**Patterns identified:** 3
**Next:** step-02-plan.md
**Timestamp:** 2026-01-21T11:35:00Z
