# Pulpe - Roadmap

> Product roadmap organized by release milestones. Updated January 2026.
>
> Sources: [GitHub Issues](https://github.com/neogenz/pulpe/issues) — [Project Board](https://github.com/users/neogenz/projects/1)

---

## Context

Pulpe is an open-source passion project, in production with 3 users, no marketing yet. The web responsive was a stepping stone — iOS is the real target platform (Apple Developer license purchased Jan 2026, App Store submission pending).

**Strategic priority:** Ship iOS on the App Store, then make the product worth sharing.

---

## R1 — App Store Ready

> **Goal:** Submit iOS to the App Store with a solid, bug-free core experience.

### Bugs

| Issue | Description | Platform |
|-------|-------------|----------|
| #270 | Onboarding: 1er budget ignore le payday | Web |
| #267 | Support du PayDay dans l'app iOS | iOS |
| #268 | Bug affichage + comptabilisation transactions mois courant | Web |
| #269 | Comptabiliser les dépenses allouées depuis current-month | Web |
| #266 | Restreindre la date des prévisions dans le mois courant | Web |
| #251 | Réseau lent → affiche page maintenance | Web + iOS |

### iOS polish

| Issue | Description |
|-------|-------------|
| #242 | Skeletons de chargement iOS |
| #244 | Optimiser les appels réseau iOS |

### Dashboard iOS

| Issue | Description |
|-------|-------------|
| #243 | Dashboard iOS "Vue d'ensemble" |

### Préparation App Store

| Issue | Description |
|-------|-------------|
| #276 | Définir le scope MVP iOS |
| #277 | Checklist soumission App Store |

---

## R2 — Worth Sharing

> **Goal:** Make the product polished enough to share — with friends, communities, or on socials.

### Dashboard web

| Issue | Description |
|-------|-------------|
| #271 | Dashboard actionable (hero, prévisions non cochées, chart 6 mois) |

### UX polish

| Issue | Description |
|-------|-------------|
| #107 | Checkbox via bouton "sélectionner" |
| #22 | Supprimer le budget d'un mois |

### Épargne (nouveau pilier de valeur)

| Issue | Description |
|-------|-------------|
| #85 | Objectif d'épargne (needs spec — user story à écrire) |
| #28 | Progression épargne |
| #34 | Mettre à jour épargne réelle |

### Planning & budget enrichment

| Issue | Description |
|-------|-------------|
| #18 | Créer un budget vierge (sans template) |
| #19 | Générer budgets pour l'année (partiellement implémenté) |
| #93 | Smart Default Month Selection |
| #29 | Vue annuelle (12 mois sur une page) |
| #100 | Archives des anciennes années |
| #118 | Réordonner les lignes (drag & drop) |
| #125 | Visualiser le report mensuel différemment |
| #241 | Changer de mois une transaction |
| #123 | Lisser une dépense sur x mois |
| #124 | Tags par dépense |

### Technique

| Issue | Description |
|-------|-------------|
| #193 | Migration tokens Supabase |
| #206 | Gérer les releases PostHog |
| #274 | Chiffrement montants DB (AES-256-GCM) — argument commercial |

---

## Ice Box

> Ideas without spec, demand, or explicitly out of V1 scope. Revisit after R2.

| Issue | Description | Reason |
|-------|-------------|--------|
| #248 | Convertisseur de devise | CHF only in V1 |
| #36 | Mode hors-ligne basique | Enormous complexity, no demand |
| #247 | Import JSON des dépenses | No demand |

---

## Closed (housekeeping Jan 2026)

| Issue | Reason |
|-------|--------|
| #27 | Superseded by #271 |
| #33 | Duplicate of #85 |
| #119 | Already implemented (payday) |
| #98 | Replaced by #274 |

---

*See `projectbrief.md` for project vision and scope.*
*See `productContext.md` for business rules.*
