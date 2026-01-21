# APEX Task: 02-migrate-landing-nextjs

**Created:** 2026-01-20T20:15:00Z
**Task:** Migration Landing Page vers Next.js avec SSG pour performance Lighthouse ≥ 95

---

## Configuration

| Flag | Value |
|------|-------|
| Auto mode (`-a`) | true |
| Examine mode (`-x`) | true |
| Save mode (`-s`) | true |
| Test mode (`-t`) | false |
| Economy mode (`-e`) | false |
| Branch mode (`-b`) | false |
| PR mode (`-pr`) | false |
| Interactive mode (`-i`) | false |
| Branch name | N/A |

---

## User Request

```
Migration Landing Page vers Next.js

## Contexte
Je possède un monorepo avec :
- Une application Angular (`frontend/`) déployée sur Vercel
- Une landing page actuelle à migrer vers Next.js (dernière version stable)
- Un déploiement Vercel existant avec routing custom

## Objectifs
1. **Parité visuelle 100%** : Rendu identique pixel-perfect à la landing actuelle
2. **Cohabitation Vercel** : Routing qui préserve l'accès à l'app Angular sur les autres routes
3. **Déploiement CLI** : Commandes `vercel` fonctionnelles sans régression
4. **Performance Lighthouse** : Score ≥ 95 sur les 4 métriques (Performance, Accessibility, Best Practices, SEO)

## Contraintes techniques
- Next.js App Router (pas Pages Router)
- React Server Components par défaut
- Tailwind CSS v4 (cohérence avec le projet existant)
- Images optimisées via `next/image`
- Fonts via `next/font`
- Metadata API pour SEO

## Livrables attendus
1. Structure du projet Next.js dans le monorepo
2. Configuration `vercel.json` mise à jour pour le routing dual (Next.js + Angular)
3. Composants migrés avec même structure HTML/CSS
4. Tests de validation visuelle
5. Rapport Lighthouse avant/après

## Validation
- [ ] Rendu visuel identique (comparaison screenshot)
- [ ] Routes Angular toujours accessibles
- [ ] `vercel deploy` fonctionne sans erreur
- [ ] Lighthouse Performance ≥ 95
- [ ] Lighthouse Accessibility ≥ 95
- [ ] Lighthouse Best Practices ≥ 95
- [ ] Lighthouse SEO ≥ 95
```

---

## Acceptance Criteria

_To be defined in step-01-analyze.md_

---

## Progress

| Step | Status | Timestamp |
|------|--------|-----------|
| 00-init | ✓ Complete | 2026-01-20T20:15:00Z |
| 01-analyze | ⏸ Pending | |
| 02-plan | ⏸ Pending | |
| 03-execute | ⏸ Pending | |
| 04-validate | ⏸ Pending | |
| 05-examine | ⏸ Pending | |
| 06-resolve | ⏸ Pending | |
| 07-tests | ⏭ Skip | |
| 08-run-tests | ⏭ Skip | |
| 09-finish | ⏭ Skip | |
