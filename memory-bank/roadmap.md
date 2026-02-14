# Pulpe - Roadmap

> Product roadmap organized by release milestones. Updated February 2026.
>
> Sources: [GitHub Issues](https://github.com/neogenz/pulpe/issues) — [Project Board](https://github.com/users/neogenz/projects/1)

---

## Context

Pulpe is an open-source passion project, in production with 3 users, no marketing yet. The web responsive was a stepping stone — iOS is the real target platform (Apple Developer license purchased Jan 2026, App Store submission pending).

**Strategic priority:** Ship iOS on the App Store, then make the product worth sharing.

---

## MVP (100%)

> **Goal:** Core features, production-ready webapp + backend.

---

## R1 — App Store Ready (15 issues)

> **Goal:** Submit iOS to the App Store with a solid, bug-free core experience.

### Bugs

| Issue | Description | Platform |
|-------|-------------|----------|
| #302 | Bug onboarding : le budget initial ne couvre pas la bonne période quand le payDay est dans le futur proche | Web |
| #269 | Comptabiliser les dépenses allouées depuis current-month | Web |
| #268 | Bug d'affichage et de comptabilisation des transactions du mois courant | Web |
| #267 | Support du PayDay dans l'app iOS | iOS |
| #251 | Mauvaise erreur quand réseau lent | Web + iOS |

### Fonctionnalités

| Issue | Description | Platform |
|-------|-------------|----------|
| #309 | Ajouter un bouton + pour créer des prévisions custom dans l'onboarding | Web |
| #303 | Améliorer l'empty state de CurrentMonth quand aucun budget n'existe | Web |
| #290 | Relancer l'authentification biométrique après mise en arrière-plan prolongée | iOS |
| #289 | Intégrer PostHog Analytics sur l'app iOS | iOS |
| #278 | Report du mois précédent en bottom sheet | iOS |
| #242 | Skeletons de chargement | iOS |

### Préparation App Store

| Issue | Description |
|-------|-------------|
| #276 | Définir le scope MVP iOS |
| #277 | Checklist soumission App Store |

### Technique

| Issue | Description |
|-------|-------------|
| #244 | Optimiser les appels réseau iOS |
| #206 | Gérer les releases PostHog |

---

## R2 — Worth Sharing (20 issues)

> **Goal:** Make the product polished enough to share — with friends, communities, or on socials.

### Dashboard

| Issue | Description |
|-------|-------------|
| #271 | Refactorer "Mois courant" en Dashboard actionable |

### UX polish

| Issue | Description |
|-------|-------------|
| #107 | Checkbox via bouton "sélectionner" |
| #22 | Supprimer le budget d'un mois |
| #288 | Masquer les montants pour partager son écran en toute confidentialité |
| #306 | Renforcer la validation et l'affichage de la sécurité des mots de passe |

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
| #307 | Configurer SMTP personnalisé pour les emails transactionnels (Resend) |

---

## Ice Box (11 issues)

> Ideas without spec, demand, or explicitly out of V1 scope. Revisit after R2.

| Issue | Description | Reason |
|-------|-------------|--------|
| #248 | Convertisseur de devise | CHF only in V1 |
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

## Closed (housekeeping)

| Issue | Reason |
|-------|--------|
| #316 | Livré dans v0.19.0 (recherche budget details) |
| #270 | Doublon de #302 |
| #27 | Superseded by #271 |
| #33 | Duplicate of #85 |
| #119 | Already implemented (payday) |
| #274 | Completed — AES-256-GCM encryption for financial amounts |
| #293 | Completed — encryption migration cleanup (68f2157c) |
| #98 | Replaced by #274 |

---

*See `projectbrief.md` for project vision and scope.*
*See `productContext.md` for business rules.*
