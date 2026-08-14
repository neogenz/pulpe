---
status: pending
---

# Instruction: Socle blog SEO sur la landing (`/guides`)

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
landing/
├── app/
│   ├── sitemap.ts                        ✅ sitemap dynamique (pages statiques + guides)
│   ├── guides/
│   │   ├── page.tsx                      ✅ index des guides (liste de cards)
│   │   └── comment-faire-son-budget-en-suisse/
│   │       └── page.tsx                  ✅ article seed qui prouve le socle
│   └── layout.tsx                        ✏️ rien si possible ; sinon lien "Guides" surfaces communes
├── components/
│   ├── guides/
│   │   ├── ArticleLayout.tsx             ✅ layout partagé : header, sommaire, prose, CTA final, JSON-LD
│   │   └── guides.ts                     ✅ registre typé des guides (slug, title, description, date) — source unique pour index + sitemap
│   └── sections/Footer.tsx               ✏️ lien "Guides" dans le footer
└── public/sitemap.xml                    ❌ remplacé par app/sitemap.ts
```

## User Journey

```mermaid
flowchart TD
  A[Recherche Google: "comment faire son budget suisse"] --> B[/guides/... article/]
  B --> C[Lecture: réponse concrète à la requête]
  C --> D[CTA fin d'article: "Essaie Pulpe, gratuit"]
  D --> E[app.pulpe.app onboarding]
  B --> F[/guides index → autres articles/]
```

## Wireframe

```txt
┌────────────────────────────────────────┐
│ (1) Header landing existant            │
├────────────────────────────────────────┤
│ (2) H1 article + date + tps lecture    │
├────────────────────────────────────────┤
│ (3) Prose: H2/H3, listes, tableaux     │
│     largeur lecture ~65ch              │
│                                        │
├────────────────────────────────────────┤
│ (4) CTA card: "Essaie Pulpe" [Bouton]  │
├────────────────────────────────────────┤
│ (5) Footer existant + lien Guides      │
└────────────────────────────────────────┘
```

1. Header : réutilise `Header` existant, aucune variante.
2. Titre : H1 unique (requête cible), métadonnées discrètes.
3. Prose : styles typographiques Poppins existants, hiérarchie visuelle > copy verbeuse.
4. CTA : un seul CTA primaire par article, vers l'app.
5. Footer : réutilisé, gagne le lien vers `/guides`.

## Contexte vérifié (agent codebase, juillet 2026)

- Next.js 16.2.11, App Router, **`output: 'export'`** (statique pur, `distDir: 'dist'`) — `app/sitemap.ts` fonctionne au build ; routes imbriquées OK.
- Déploiement : Vercel via `landing/vercel.json` (CSP, rewrites PostHog, redirects au niveau Vercel) — **rien à toucher** pour de nouvelles routes.
- `robots.txt` déclare déjà `Sitemap: https://pulpe.app/sitemap.xml` — aucun changement robots.
- `pnpm build` passe aujourd'hui (5 pages statiques) — baseline verte.
- Pattern contenu existant à suivre : `app/changelog/page.tsx` (TSX + data locale + Container/Header/Footer).
- **Aucun style prose n'existe** (`prose` absent de globals.css, pas de @tailwindcss/typography) — la typographie d'article est à créer.
- FR-only (`<html lang="fr">`, fr_CH), title template `%s | Pulpe` + canonical par page déjà en place.

## Tasks to do

### `1)` Registre des guides

> Une source unique de vérité pour index, sitemap et métadonnées.

1. Créer `components/guides/guides.ts` : tableau typé `{ slug, title, description, publishedAt }`.

### `2)` Layout d'article partagé + typographie prose

> Un composant qui rend chaque article cohérent avec la DA landing.

1. Lire `landing/DESIGN.md` + `app/changelog/page.tsx` + 2 composants sections avant d'écrire (règle workflow).
2. Créer `ArticleLayout.tsx` : conteneur prose, H1, méta, CTA final, JSON-LD `Article` inline.
3. Créer les styles prose (bloc CSS dans globals.css — pas de dépendance @tailwindcss/typography pour < 10 articles).

### `3)` Index `/guides` + article seed

> La route vit avec un premier contenu réel.

1. `app/guides/page.tsx` : liste des guides depuis le registre, metadata + canonical.
2. Article seed « Comment faire son budget en Suisse » (~1200 mots, tutoiement, vocabulaire Pulpe).

### `4)` Sitemap dynamique + maillage

> Google découvre les articles sans édition manuelle.

1. Créer `app/sitemap.ts` (pages statiques + boucle sur le registre) ; supprimer `public/sitemap.xml` (via `trash`) **dans la même PR** (collision de chemin sinon).
2. Ajouter le lien "Guides" au footer.

## Test acceptance criteria

| Task | Acceptance criteria                                                                        |
| ---- | ------------------------------------------------------------------------------------------ |
| 1    | Ajouter un guide au registre le fait apparaître dans l'index ET le sitemap sans autre édit  |
| 2    | L'article rend un JSON-LD `Article` valide et un seul H1 ; DA landing respectée (Poppins, fond clair) ; hiérarchie H2/H3 lisible sans classes ad-hoc |
| 3    | `/guides` et l'article seed rendent en build prod (`pnpm build` landing) avec title/description/canonical propres |
| 4    | Le `sitemap.xml` généré dans `dist/` liste `/`, `/changelog`, `/support`, `/guides` et l'article seed ; `public/sitemap.xml` n'existe plus |
