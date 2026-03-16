# Pulpe - Roadmap

> Product roadmap organized by release milestones. Updated March 2026.
>
> Source: [Linear — Pulpe](https://linear.app/pulpe)

---

## Context

Pulpe is an open-source passion project, in production with 3 users, no marketing yet. The web responsive was a stepping stone — iOS is the real target platform (Apple Developer license purchased Jan 2026, App Store submission pending).

**Strategic priority:** Ship iOS on the App Store, then make the product worth sharing.

---

## MVP (100%)

> **Goal:** Core features, production-ready webapp + backend.

---

## R1 — App Store Ready

> **Goal:** Submit iOS to the App Store with a solid, bug-free core experience.

### Bugs

| Issue | Description | Platform |
|-------|-------------|----------|
| PUL-89 | Persister la nouvelle clientKey lors d'un REKEY_PARTIAL_FAILURE au changement de PIN | iOS |

### Fonctionnalites

| Issue | Description | Platform |
|-------|-------------|----------|
| PUL-48 | Ajouter un bouton + pour creer des previsions custom dans l'onboarding | Web + iOS |
| PUL-60 | Centraliser l'etat de completion de l'onboarding dans les metadonnees utilisateur Supabase | Backend + iOS |

### Technique

| Issue | Description |
|-------|-------------|
| PUL-61 | Add service protocols to enable API call coalescing tests in iOS stores |

---

## R2 — Worth Sharing

> **Goal:** Make the product polished enough to share — with friends, communities, or on socials.

### UX polish

| Issue | Description |
|-------|-------------|
| PUL-7 | Supprimer le budget d'un mois (backend fait, scope = UI) |
| PUL-46 | Renforcer la validation et l'affichage de la securite des mots de passe |
| PUL-87 | Aligner le rendu "Hors enveloppes" en responsive sur le design desktop |
| PUL-88 | Harmoniser l'etat d'erreur de la page budget-details avec le StateCard reutilisable |

### Epargne (epic PUL-98)

| Issue | Description |
|-------|-------------|
| PUL-98 | **Epic** — Epargne : objectifs et progression |
| PUL-12 | Pouvoir ajouter un objectif d'epargne (CRUD goals) |
| PUL-8 | Progression epargne (vue long-terme par objectif, bloque par PUL-12) |

### Planning & budget enrichment

| Issue | Description |
|-------|-------------|
| PUL-5 | Creer un budget vierge (sans template) |
| PUL-6 | Generer budgets pour l'annee (backend fait, scope = UI trigger) |
| PUL-9 | Vue annuelle (12 mois sur une page) |
| PUL-14 | Archives des anciennes annees |
| PUL-16 | Reordonner les lignes (drag & drop) |
| PUL-22 | Changer de mois une transaction |
| PUL-17 | Lisser une depense sur x mois |
| PUL-18 | Tags par depense |
| PUL-76 | Afficher l'ecart moyen et mensuel entre previsions et transactions reelles |

### Technique & accessibilite

| Issue | Description |
|-------|-------------|
| PUL-47 | Configurer SMTP personnalise pour les emails transactionnels (Resend) |
| PUL-66 | Respecter la preference "Reduire les animations" (reduceMotion) dans toutes les animations iOS |

---

## Ice Box (10 issues)

> Ideas without spec, demand, or explicitly out of V1 scope. Revisit after R2.

| Issue | Description | Reason |
|-------|-------------|--------|
| ~~#248~~ | ~~Convertisseur de devise~~ | → Moved to Closed (implemented) |
| #247 | Import JSON des dépenses | No demand |
| #36 | Mode hors-ligne basique | Enormous complexity, no demand |
| #284 | Explorer le skill Remotion pour générer des vidéos | Exploration |
| #283 | Renommage BudgetLine/Transaction → Prévu/Réalisé | Refactoring scope à définir |
| #310 | Afficher un signe "-" devant les montants de dépenses | Exploration UX |
| #311 | Uniformiser l'accès données via repositories (backend) | Tech debt, pas urgent |
| #312 | Cache in-memory simple (backend) | Pas de problème de perf constaté |
| #299 | Alternative : chiffrement server-side (sans zero-knowledge) | Alternative architecture |
| #301 | Alternative : chiffrement Google OAuth device-bound | Alternative architecture |
| #304 | Préremplir les montants du onboarding en mode localhost | DX uniquement |

---

## Canceled (audit mars 2026)

| Issue | Reason |
|-------|--------|
| #316 | Livré dans v0.19.0 (recherche budget details) |
| #270 | Doublon de #302 |
| #27 | Superseded by #271 |
| #33 | Duplicate of #85 |
| #119 | Already implemented (payday) |
| #274 | Completed — AES-256-GCM encryption for financial amounts |
| #293 | Completed — encryption migration cleanup (68f2157c) |
| #248 | Completed — multi-currency support (CHF/EUR, Frankfurter API, conversion metadata) |
| #98 | Replaced by #274 |

---

*See `projectbrief.md` for project vision and scope.*
*See `productContext.md` for business rules.*
