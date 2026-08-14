---
status: pending
---

# Instruction: Lead magnet — calculateur de budget suisse

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
landing/
├── app/calculateur-budget/page.tsx        ✅ page SEO "calculateur budget suisse" (metadata + prose)
├── components/calculator/
│   └── BudgetCalculator.tsx               ✅ client component : miroir exact du calcul onboarding, zéro réseau
└── app/sitemap.ts                         ✏️ entrée /calculateur-budget
```

## Contexte vérifié (recherche + agent codebase, juillet 2026)

**SERP « calculateur budget suisse » — modérément gagnable** :
- #1 = moneyhaxx.ch (Budget-conseil Suisse, **marque jeunes**, backing banques cantonales, FR/DE/IT, calculateur opérationnel + chatbot IA). Battable sur spécificité romande et continuité vers une vraie app, **pas** sur l'angle « jeunes » (ils l'occupent) ni l'autorité court terme.
- Autres slots : Swiss Life (générique), Valiant (vrai calculateur budget, banque moyenne), salairesuisse.ch (micro-site expat qui rank = preuve qu'un petit domaine peut ranker), HelloSafe (calculateur gratuit existant), 2 courtiers crédit (intent mismatch). Caritas s'est retiré (app supprimée 2021, page morte).
- **Ignorer les requêtes génériques FR** (« calculateur budget mensuel », « calcul budget gratuit ») : dominées par des sites France (reste-a-vivre.fr, N26, finary), mauvaise audience.
- Différenciation obligatoire : données romandes pré-remplies (LAMal, impôts, Serafe, 3e pilier), personas (étudiant/apprenti/premier salaire), continuité vers l'app — pas « un calculateur de plus ».

**Logique onboarding réelle (vérifiée dans `complete-profile-store.ts`)** :
- `income = revenus mensuels + revenus custom` ; `committed = 6 charges fixes + dépenses custom + épargnes custom` ; `available = income − committed`. **L'épargne compte dans le committed.** Déficit (`available < 0`) = état non bloquant, teinte erreur + hint rassurant (« Pas d'inquiétude — tu pourras ajuster tout ça après. »).
- **Labels UI réels** (fr.json) : « Revenus mensuels », « Charges mensuelles », rangée résumé « Revenu / Dépenses / Disponible » — PAS « Disponible à dépenser » (réservé au copy marketing autour du widget). Champs charges : « Loyer / Crédit », « Assurance maladie », « Abonnement téléphonique », « Abonnement internet », « Transport », « Leasing ».
- **Chips suggestions exactes** : Courses / alimentation 600 · Restaurants & sorties 150 · Loisirs & sport 100 · Épargne 500 · 3ème pilier 587 (CHF ; « Épargne retraite » en EUR).
- **Formatage** : PAS de dépendance `pulpe-shared` (décision plan) — inline `Intl.NumberFormat('de-CH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })` + suffixe « CHF » (apostrophe suisse `1’234 CHF`), défaut CHF.

## User Journey

```mermaid
flowchart TD
  A[Recherche "calculateur budget suisse" / partage communauté] --> B[/calculateur-budget/]
  B --> C[Saisit revenu + charges fixes + épargne — chips 1-clic]
  C --> D[Voit son "Disponible" instantanément, format CHF suisse]
  D --> E[CTA: la limite du calculateur — statique, 1 mois — est l'argument pour l'app: 12 mois, suivi]
  E --> F[app.pulpe.app onboarding: mêmes champs, mêmes chips = continuité]
```

## Wireframe

```txt
┌────────────────────────────────────────┐
│ (1) Header landing existant            │
├────────────────────────────────────────┤
│ (2) H1: Calcule ton budget suisse      │
├───────────────────┬────────────────────┤
│ (3) Formulaire    │ (4) Résultat live  │
│  Revenus [____]   │   Disponible       │
│  Loyer   [____]   │     2’100 CHF      │
│  Assur.  [____]   │  Revenu · Dépenses │
│  Transp. [____]   │  · Disponible      │
│  Épargne [____]   │  (état déficit ok) │
│  chips: +600 +150 │                    │
├───────────────────┴────────────────────┤
│ (5) CTA: "Projette-le sur 12 mois"     │
├────────────────────────────────────────┤
│ (6) Prose SEO: postes romands (LAMal,  │
│     Serafe, 3e pilier), personas       │
└────────────────────────────────────────┘
```

1. Header réutilisé.
2. H1 = requête cible qualifiée suisse.
3. Champs = mêmes labels que l'onboarding ; chips 1-clic identiques (600/150/100/500/587).
4. Recalcul à chaque frappe ; rangée Revenu/Dépenses/Disponible identique à l'app ; déficit non bloquant avec hint rassurant.
5. Un CTA primaire : la limite du calculateur est l'argument pour l'app.
6. Prose indexable : postes typiques romands + liens personas — la différenciation vs moneyhaxx/HelloSafe.

## Tasks to do

### `1)` Composant calculateur

> Miroir exact du calcul onboarding, client-side pur.

1. `BudgetCalculator.tsx` : état local React, formule vérifiée ci-dessus (épargne dans committed, déficit non bloquant), chips exactes, formateur `de-CH` inline.

### `2)` Page + SEO

> La page porte l'outil et le texte qui rank.

1. `app/calculateur-budget/page.tsx` : metadata, H1, calculateur, prose ~600 mots (postes romands : LAMal ~CHF 326 pour un 19-25 ans, Serafe, impôts, 3e pilier ; renvois personas vers les guides phase 4).
2. Entrée sitemap + lien depuis l'index `/guides` et le footer.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                      |
| ---- | --------------------------------------------------------------------------------------------------------- |
| 1    | 5000 revenu / 2000 loyer / 400 assurance / 500 épargne ⇒ « 2’100 CHF » instantané (apostrophe suisse, 0 décimale sur saisie ronde) |
| 1    | Labels et chips identiques à l'onboarding webapp (Revenu/Dépenses/Disponible, 600/150/100/500/587) ; déficit = teinte + hint, jamais bloquant |
| 2    | Page en build prod, dans le sitemap, zéro appel réseau depuis le calculateur ; la prose mentionne ≥ 3 spécificités romandes |
