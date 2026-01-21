# Step 02: Plan

**Task:** Share legal pages between landing and Angular app (prefer Angular originals)
**Started:** 2026-01-21T11:38:00Z

---

## Answer to User's Question

**Yes, it's possible to share legal pages.** There are three approaches:

| Approach | Complexity | Pros | Cons |
|----------|-----------|------|------|
| **A: Redirect (Recommended)** | Low | Angular is sole source of truth, no duplication | Users leave landing context |
| B: Content extraction | Medium | True sharing, each app keeps styling | Requires markdown renderers |
| C: Manual sync | Low | Independent apps | Content drift risk |

**Recommendation:** Approach A - redirect landing legal pages to Angular app.
Since user prefers Angular originals, make Angular the **only** place legal pages exist.

---

## Implementation Plan

### Overview
Remove Next.js legal pages and redirect `/legal/*` URLs to the Angular application. The Angular app becomes the single source of truth for all legal content.

### Prerequisites
- None (Angular legal pages already exist and are complete)

---

## File Changes

### 1. `landing/app/legal/cgu/page.tsx` → **DELETE**
- Remove this file entirely
- Angular's `terms-of-service.ts` replaces it

### 2. `landing/app/legal/confidentialite/page.tsx` → **DELETE**
- Remove this file entirely
- Angular's `privacy-policy.ts` replaces it

### 3. `landing/components/sections/Footer.tsx`
- Line 22-26: Update legal links to point to Angular app
- Change from internal `/legal/cgu` to external link (e.g., `https://app.pulpe.app/legal/cgu`)
- OR: Keep as relative links if same domain routing is configured

### 4. `vercel.json`
- Lines 57-63: Update rewrites to redirect to Angular app
- Change from rewriting to static HTML to redirecting to Angular routes
- Option: Configure redirect rules instead of rewrites

### 5. `landing/app/legal/` directory → **DELETE**
- Remove entire directory after deleting pages
- Clean up empty folder structure

---

## Alternative: Same-Domain Configuration

If both apps are served from the same domain (pulpe.app):

### `vercel.json` changes
```json
{
  "rewrites": [
    { "source": "/legal/:path*", "destination": "/app/legal/:path*" }
  ]
}
```

This routes `/legal/*` requests to the Angular app's legal routes.

---

## Testing Strategy

**Manual verification:**
1. Landing footer links navigate to legal pages
2. Legal pages display Angular content (10 sections CGU, 13 sections Privacy)
3. No 404 errors on legal URLs
4. SEO: Proper redirects (301) preserve link equity

---

## Acceptance Criteria Mapping

- [x] **AC1**: Legal content in single source → Angular is only source (Next.js deleted)
- [x] **AC2**: Both apps show identical content → Landing redirects to Angular
- [x] **AC3**: Each app uses own styling → N/A (only Angular renders)
- [x] **AC4**: Navigation works → Footer links updated
- [ ] **AC5**: SEO preserved → Redirect configuration needed

---

## Risks & Considerations

1. **Domain/CORS**: If apps are on different subdomains, ensure redirects work correctly
2. **SEO impact**: Use 301 redirects to preserve search rankings
3. **User experience**: Users clicking legal links from landing will enter Angular app context
4. **Future maintenance**: Any legal updates only need to happen in Angular

---

## Plan Summary

**Overview:** Delete Next.js legal pages, redirect to Angular app

| Action | Files |
|--------|-------|
| Delete | 2 Next.js page files |
| Modify | 1 Footer component |
| Modify | 1 Vercel config |

---

## Step Complete

**Status:** ✓ Complete
**Files planned:** 4 (2 delete, 2 modify)
**Tests planned:** Manual verification
**Next:** step-03-execute.md
**Timestamp:** 2026-01-21T11:40:00Z
