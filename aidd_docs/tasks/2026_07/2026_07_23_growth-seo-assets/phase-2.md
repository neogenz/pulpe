---
status: pending
---

# Instruction: Pages comparatives concurrents (gap SEO)

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
landing/
├── app/guides/
│   ├── alternative-ynab-suisse/page.tsx      ✅ flagship : gap de ranking confirmé, doit battre la page BudgetHub FR (~400 mots)
│   ├── meilleure-app-budget-suisse/page.tsx  ✅ notre propre listicle FR (BudgetHub ne le fait qu'en DE, magicheidi = angle freelance)
│   ├── pulpe-vs-budgetch/page.tsx            ✅ le concurrent gratuit que le chercheur romand croise réellement
│   └── pulpe-vs-budgethub/page.tsx           ✅ le concurrent stratégique (même positionnement no-bank-sync/CHF)
└── components/guides/guides.ts               ✏️ 4 entrées registre
```

## Contexte vérifié (recherche adversariale, juillet 2026)

**Requêtes cibles confirmées** (index US — re-vérifier locale CH, tâche 1) :
- « alternative YNAB suisse » / « alternative à YNAB gratuite » / « remplacer YNAB » : servies uniquement par des listicles anglais ; la seule page FR (BudgetHub, ~400 mots, auto-comparaison sans tableau) ne rank pas. **Gap réel, fenêtre qui se ferme** (BudgetHub produit activement du contenu FR).
- « YNAB avis » : **abandonné** — Mustachian Post (suisse, pro-YNAB, MAJ 09.07.2026) + sites France le verrouillent.
- « meilleure app budget suisse » : BudgetHub le tient en DE (« Budget-App Test & Vergleich Schweiz 2026 »), magicheidi en FR avec angle freelance auto-classé #1 — un listicle FR honnête grand public est jouable.

**Faits concurrents sourcés chez les éditeurs (à citer tels quels, quote-safe) :**

| Concurrent   | Faits vérifiés                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| YNAB         | $14.99/mois ou $109/an, **USD uniquement** (« Exchange rates are not reflected in the price »), pas de tier gratuit, essai 34 j. UI anglaise — citer la fiche App Store CH (Languages: English), PAS ynab.com. Devise : « can't use multiple currencies together in a single spending plan », un budget par devise — ne pas écrire « no conversion » |
| BudgetHub    | PWA (pas d'app native), pas de sync bancaire (CSV), gratuit limité (2 comptes, 5 scans IA/mois), CHF 6.90 / 11.90 par mois. Écrire exactement « Datenhaltung in der Schweiz, Compute in der EU » — pas « hébergé à Zurich » |
| BudgetCH     | Gratuit, associatif (Budget-conseil Suisse), FR natif, MAJ juil. 2025. **Ne pas se battre sur le prix** (les deux gratuits) : se différencier sur l'UX et la planification à l'avance ; reconnaître honnêtement le backing associatif |
| MoneyControl | Gratuit plafonné à 20 transactions/mois ; déblocage one-time CHF 8-10 (App Store CH — utiliser les prix CHF, pas les EUR qui circulent)            |
| Goodbudget   | Gratuit = 20 enveloppes, 1 compte, 2 appareils, 1 an d'historique ; $10/mois sinon. Écrire « pas de sync bancaire suisse » (le payant sync des banques US) |

**Différenciateurs défendables de Pulpe** : 100 % gratuit sans plafonds, FR natif, planification « Disponible » à des mois d'avance, app iOS native (vs PWA BudgetHub), pas de connexion bancaire = privacy.

## User Journey

```mermaid
flowchart TD
  A[Recherche: "alternative YNAB suisse" / "meilleure app budget suisse"] --> B[Page comparative]
  B --> C{Le lecteur se reconnaît ?}
  C -->|Budget prévisionnel, gratuit, pas de banque| D[CTA Pulpe gratuit]
  C -->|Besoin sync bancaire / multi-devises| E[Recommandation honnête d'un autre outil]
  E --> F[Confiance = citation/backlink possible]
```

## Tasks to do

### `1)` Re-vérification SERP locale suisse

> La recherche a tourné sur un index US ; les positions google.ch fr-CH peuvent différer.

1. Re-lancer les 4 requêtes cibles avec qualification locale (site:ch, google.ch si accessible, mention Suisse) ; ajuster les briefs si un acteur FR fort apparaît.

### `2)` Rédiger les 4 pages

> Chaque page doit structurellement battre l'existant : tableau comparatif, 5+ alternatives réelles, angle gratuit/CHF en tête.

1. `alternative-ynab-suisse` : angle prix (USD + FX vs gratuit), UI anglaise, un budget par devise ; tableau avec 5+ alternatives réelles (Pulpe, BudgetCH, BudgetHub, Goodbudget, MoneyControl) — c'est ce que la page BudgetHub ne fait pas.
2. `meilleure-app-budget-suisse` : listicle 5-6 apps, critères suisses (CHF, LPD, français, prix réel), Pulpe positionné honnêtement.
3. `pulpe-vs-budgetch` : UX moderne + projection 12 mois vs app associative solide ; ton respectueux (ils sont non-profit).
4. `pulpe-vs-budgethub` : natif iOS + gratuit sans plafond vs PWA freemium ; mentionner leur force (CSV import, BudgetAI).
5. Chaque page : `ArticleLayout`, entrée registre, tutoiement, au moins une vraie faiblesse de Pulpe par page (pas de sync bancaire, pas de multi-devises, produit jeune).

## Test acceptance criteria

| Task | Acceptance criteria                                                                                     |
| ---- | -------------------------------------------------------------------------------------------------------- |
| 1    | Chaque brief cite la SERP re-vérifiée (locale CH) ; tout changement vs la recherche initiale est noté      |
| 2    | Chaque fait concurrent d'une page publiée provient du tableau vérifié ci-dessus ou d'une source éditeur fraîche ; aucune claim non sourcée |
| 2    | Chaque page liste ≥ 1 faiblesse réelle de Pulpe ; build prod OK ; les 4 pages dans le sitemap généré       |
