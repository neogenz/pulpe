# Pulpe Landing Page

[![Next.js](https://img.shields.io/badge/Next.js-15.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![pnpm](https://img.shields.io/badge/pnpm-10.12-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](../LICENSE)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://vercel.com)

Modern, high-performance landing page built with Next.js and React 19. Statically exported and deployed alongside the Angular app on Vercel.

## Tech Stack

- **Next.js** 15.3.4 (App Router, Static Export)
- **React** 19.2.0
- **Tailwind CSS** 4.1
- **TypeScript** ~5.9.3
- **Lucide Icons** for iconography
- **Poppins** font (Google Fonts)

## Getting Started

```bash
# Install dependencies
pnpm install

# Start dev server (port 3001)
pnpm dev

# Type check
pnpm type-check

# Lint
pnpm lint
```

Visit [http://localhost:3001](http://localhost:3001)

## Build

```bash
# Build static export
pnpm build

# Output: dist/ directory
```

## Environment Variables

Create `.env.local` for local overrides:

```bash
# Development (default in .env.development)
NEXT_PUBLIC_ANGULAR_APP_URL=http://localhost:4200

# Production (empty = same origin)
NEXT_PUBLIC_ANGULAR_APP_URL=
```

## Project Structure

```
landing/
├── app/
│   ├── layout.tsx          # Root layout, metadata, fonts
│   ├── page.tsx            # Home page with dynamic imports
│   └── globals.css         # Tailwind + custom animations
├── components/
│   ├── sections/           # Page sections (Hero, Features, etc.)
│   ├── ui/                 # Reusable UI components
│   └── contexts/           # React context (ImageLightbox)
├── lib/
│   ├── config.ts           # Environment config
│   └── cn.ts               # Tailwind class utility
└── public/
    ├── screenshots/        # Product screenshots (mobile, webapp)
    └── *.png, *.webp       # Icons and assets
```

## Key Features

### Performance Optimizations

- **Code Splitting**: Dynamic imports for below-the-fold sections
- **Image Optimization**: WebP with PNG fallback, responsive srcsets
- **LCP Optimization**: Preload hero image, `fetchPriority="high"`
- **Font Loading**: `next/font` with `display: 'swap'`
- **Console Removal**: Production builds strip console logs

### Accessibility

- Skip-to-content link
- Proper ARIA labels
- Keyboard navigation support
- `prefers-reduced-motion` respected

### Components

- **Memo'd Components**: Button, Screenshot, TypeWriter, etc.
- **Image Lightbox**: Click to zoom screenshots
- **TypeWriter Effect**: Animated hero text with hydration fix
- **Floating Cards**: Animated UI elements in hero

## Deployment

The landing page is merged with the Angular app at build time via the root `vercel.json`:

```bash
# Root monorepo command
pnpm build:merge

# Results in:
# dist/
# ├── landing/           # Landing page static files
# ├── _next/             # Next.js assets
# ├── index.html         # Landing page entry
# └── _app.html          # Angular app entry
```

Vercel rewrites:
- `/` → `/landing/index.html` (landing page)
- `/:path*` → `/_app.html` (Angular app catch-all)

### Auth Redirect

Authenticated users visiting `/` are automatically redirected to `/dashboard` via Vercel Edge Middleware (see `middleware.ts` at project root). This prevents the landing page from flashing before the Angular app redirects.

The middleware:
1. Checks Supabase auth cookies
2. If authenticated → HTTP 307 redirect to `/dashboard`
3. If not authenticated → serves landing page normally

See [VERCEL_ROUTING.md](../docs/VERCEL_ROUTING.md#middleware-auth-redirect) for details.

## Development Notes

- Port 3001 avoids conflict with Angular (4200) and backend (3000)
- Static export mode (`output: 'export'`) for pure static hosting
- No server-side rendering or API routes
- Images unoptimized (`unoptimized: true`) due to static export

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Build static export |
| `pnpm type-check` | Run TypeScript compiler |
| `pnpm lint` | Run ESLint |

## Links

- [Main Repo README](../README.md)
- [Vercel Config](../vercel.json)
- [Next.js Static Export Docs](https://nextjs.org/docs/app/building-your-application/deploying/static-exports)
