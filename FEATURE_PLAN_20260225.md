# Feature Plan — 20260225

## 1. Executive Summary

Les utilisateurs ne comprennent pas le bloc "Depenses realisees / Solde actuel" sur la page de detail du budget. Le probleme est double : les labels sont ambigus, et le bloc ne raconte pas son histoire. Ce plan transforme un composant confus en un outil de verification bancaire clair et aligné avec les piliers emotionnels de Pulpe (Soulagement, Clarte). L'intervention est ciblee : un seul composant (`RealizedBalanceProgressBar`), pas de changement backend, pas de nouveau endpoint.

## 2. Current State

### What's Working
- Le mecanisme de pointage (cocher les elements) fonctionne correctement
- Le calcul `BudgetFormulas.calculateRealizedBalance()` est fiable (revenus coches - depenses cochees)
- La barre de progression segmentee est visuellement agreable et performante
- Le microcopy dynamique ("presque fini", "on avance") est bien aligne avec la DA

### What's Almost There
- Le bloc a la bonne intention (outil de rapprochement bancaire) mais echoue a la communiquer
- Le tooltip sur l'icone info contient l'explication correcte mais personne ne le lit
- La structure hero + pills + progress est bonne, le contenu du progress ne l'est pas

### What's Missing
- Un titre qui annonce l'objectif du bloc
- Un lien explicite entre "pointer des elements" et "verifier ton solde bancaire"
- Une hierarchie visuelle qui met le solde estime en vedette (au lieu de "Depenses realisees")

### What's at Risk
- Si le bloc reste incompris, les utilisateurs ignorent le mecanisme de pointage → ils perdent une fonctionnalite differenciante
- Confusion entre le hero "Ce qu'il te reste ce mois" (128 CHF) et "Solde actuel" (515 CHF) → erosion de confiance

Reference roadmap : Ce travail s'inscrit dans R1 (polish UX) et prepare #271 (Dashboard refactor, R2).

## 3. Phase 1: Ship This Week

> Labels + contexte. Zero changement structurel. Impact immediat sur la comprehension.

### Feature 1.1: Renommer les labels du bloc

- **What it does:** Remplacer les labels ambigus par des termes explicites :
  - "Depenses realisees" → **"Depenses pointees"**
  - "Solde actuel" → **"Solde estime"**
  - "X/Y elements comptabilises" → **"X / Y elements pointes"**
- **Why it matters now:** 100% des retours utilisateurs pointent la confusion sur ces termes. "Realisees" et "comptabilises" sont du jargon comptable. "Solde actuel" laisse croire que c'est le vrai solde bancaire.
- **What it builds on:** Composant existant `RealizedBalanceProgressBar` — changement de strings uniquement
- **What it doesn't touch:** Aucun calcul, aucune logique, aucun style, aucun backend
- **Implementation context:**
  - Fichier : `frontend/projects/webapp/src/app/ui/realized-balance-progress-bar/realized-balance-progress-bar.ts` (lignes 24, 36, 72)
  - Fichier : `frontend/projects/webapp/src/app/ui/realized-balance-tooltip/realized-balance-tooltip.ts` (ligne 10 — adapter le texte du tooltip)
  - Verifier `aria-label` (ligne 56) pour l'accessibilite
- **Encryption impact:** None
- **Platform:** Web uniquement (iOS n'affiche pas ce bloc actuellement)

### Feature 1.2: Ajouter un titre de section au bloc

- **What it does:** Ajouter un titre visible au-dessus du bloc : **"Verifie ton solde"** (ou "Compare avec ta banque"). Ce titre annonce l'objectif avant que l'utilisateur ne lise les chiffres.
- **Why it matters now:** Le bloc n'a aucun titre — l'utilisateur ne sait pas pourquoi il est la. Le tooltip cache l'explication derriere un clic que personne ne fait.
- **What it builds on:** Template existant du `RealizedBalanceProgressBar` — ajout d'une ligne de texte au debut du bloc
- **What it doesn't touch:** Pas de nouveau composant, pas de modification du parent `BudgetFinancialOverview`
- **Implementation context:**
  - Fichier : `frontend/projects/webapp/src/app/ui/realized-balance-progress-bar/realized-balance-progress-bar.ts` — ajouter un `<p>` titre en debut de template (avant la div header)
  - Style : `text-title-medium text-on-surface` pour suivre la hierarchie M3
  - DA : Tutoiement, ton encourageant, pas de jargon
- **Encryption impact:** None
- **Platform:** Web

### Feature 1.3: Reformuler le tooltip

- **What it does:** Remplacer le texte actuel du tooltip :
  - Actuel : *"Ce solde est calcule a partir des elements coches, report compris. Compare-le a ton solde bancaire pour verifier que tout colle."*
  - Propose : **"Au fur et a mesure que tu pointes tes elements, ce montant te dit combien il devrait rester sur ton compte. Compare avec ton app bancaire !"**
- **Why it matters now:** Le tooltip actuel utilise "elements coches" (pas coherent avec "comptabilises") et "report" (jargon). Le nouveau texte utilise "pointes" (coherent avec les nouveaux labels) et un langage quotidien.
- **What it builds on:** Composant `RealizedBalanceTooltip` existant
- **What it doesn't touch:** Pas de changement de composant, juste le texte
- **Implementation context:**
  - Fichier : `frontend/projects/webapp/src/app/ui/realized-balance-tooltip/realized-balance-tooltip.ts` (ligne 10)
- **Encryption impact:** None
- **Platform:** Web

## 4. Phase 2: Ship This Sprint

> Restructuration du bloc pour une lecture narrative. Le solde estime devient le chiffre vedette.

### Feature 2.1: Inverser la hierarchie visuelle — solde estime en vedette

- **What it does:** Reorganiser le bloc pour que le "Solde estime" soit le chiffre principal (grand, centre), et que "Depenses pointees" descende en detail secondaire. Layout propose :
  ```
  ┌──────────────────────────────────────────────┐
  │  Vérifie ton solde                           │
  │                                              │
  │  107 / 120 éléments pointés — presque fini   │
  │  ████████████████████████░░░░                │
  │                                              │
  │  Sur ton compte, il devrait te rester :      │
  │                                              │
  │              515 CHF                         │
  │                                              │
  │  dont 16'400 CHF de dépenses pointées        │
  └──────────────────────────────────────────────┘
  ```
- **Why it matters now:** L'utilisateur vient sur ce bloc pour une seule question : "combien il me reste ?". Mettre ce chiffre en premier repond a cette question immediatement. Les "Depenses realisees" sont un detail justificatif, pas l'information primaire.
- **What it builds on:** Composant `RealizedBalanceProgressBar` existant. Meme inputs, meme calculs, juste une reorganisation du template.
- **What it doesn't touch:**
  - Aucun calcul dans `BudgetFormulas`
  - Aucun changement dans `BudgetDetailsStore`
  - Aucun changement dans `BudgetFinancialOverview` (memes inputs passes)
  - Aucun backend
- **Implementation context:**
  - Fichier principal : `frontend/projects/webapp/src/app/ui/realized-balance-progress-bar/realized-balance-progress-bar.ts`
  - Refonte du template uniquement (HTML + classes Tailwind)
  - Le solde estime passe de `text-headline-small` a `text-headline-medium` ou `text-display-small`
  - Les "Depenses pointees" passent de hero a `text-body-medium text-on-surface-variant`
  - La barre de progression monte au-dessus du solde (progression → resultat, lecture naturelle)
  - Ajouter la phrase narrative "Sur ton compte, il devrait te rester :" en `text-body-large`
  - DA : Fond `bg-surface-container-low` existant est bon. Pas de rouge. Vert pour positif, `text-financial-negative` pour negatif (deja en place).
- **Encryption impact:** None
- **Platform:** Web

### Feature 2.2: Disambiguer les deux "restes" de la page

- **What it does:** Clarifier visuellement que le hero (128 CHF — "Ce qu'il te reste ce mois") et le bloc verification (515 CHF — "Solde estime") repondent a des questions differentes :
  - Hero = **"Ce qu'il te reste a depenser"** (budget previsionnel complet)
  - Bloc = **"Ce que ton compte devrait afficher"** (base sur les elements pointes)
- **Why it matters now:** Deux chiffres differents pour deux questions differentes, mais les utilisateurs croient qu'ils repondent a la meme question. L'ecart (128 vs 515) erode la confiance.
- **What it builds on:** `BudgetFinancialOverview` — le hero et le bloc sont dans le meme parent
- **What it doesn't touch:** Pas de changement de formule, pas de fusion des deux blocs, pas de suppression
- **Implementation context:**
  - Fichier : `frontend/projects/webapp/src/app/feature/budget/budget-details/budget-financial-overview.ts`
  - Option A : Ajouter un sous-titre discret au hero : "selon tes previsions" en `text-body-small text-on-primary-container/70`
  - Option B : Ajouter une separation visuelle plus forte (espacement, divider subtil) entre hero + pills et le bloc verification
  - L'option A est preferee car elle clarifie sans changer le layout
- **Encryption impact:** None
- **Platform:** Web

### Feature 2.3: Renommer le composant et ses references

- **What it does:** Renommer les fichiers et classes pour refleter le nouveau role :
  - `RealizedBalanceProgressBar` → `BudgetVerificationBlock` (ou `BudgetCheckProgress`)
  - `RealizedBalanceTooltip` → `VerificationTooltip`
  - `realizedBalance` input → `estimatedBalance`
  - `realizedExpenses` input → `checkedExpenses`
- **Why it matters now:** Le code doit refleter le concept utilisateur. "Realized balance" est du jargon financier anglais. "Budget verification" ou "estimated balance" est plus clair pour tout developpeur qui lit le code.
- **What it builds on:** Renommage pur — pas de changement de logique
- **What it doesn't touch:** Les formules dans `BudgetFormulas` gardent leurs noms actuels (ce sont des calculs, pas de l'UI)
- **Implementation context:**
  - Fichiers a renommer :
    - `ui/realized-balance-progress-bar/` → `ui/budget-verification-block/`
    - `ui/realized-balance-tooltip/` → `ui/verification-tooltip/`
  - Mettre a jour les imports dans `BudgetFinancialOverview`
  - Mettre a jour les `data-testid` dans `budget-details-page.html`
  - Verifier les references dans les tests existants
- **Encryption impact:** None
- **Platform:** Web (renommage interne uniquement)

## 5. Phase 3: Ship This Quarter

> Propagation cross-platform et enrichissement contextuel.

### Feature 3.1: Porter le bloc verification sur iOS

- **What it does:** Implementer le bloc "Verifie ton solde" dans l'app iOS SwiftUI, sur l'ecran de detail budget
- **Why it matters now:** iOS est la plateforme cible principale. Si le bloc est utile sur le web, il doit exister sur iOS avec la meme clarte.
- **What it builds on:** Les formules existent deja dans `shared/` (`BudgetFormulas`). Le design est valide par les utilisateurs web.
- **What it doesn't touch:** Pas de nouveau calcul backend, les endpoints existants retournent deja `checkedAt`
- **Implementation context:**
  - Le calcul `calculateRealizedBalance` / `calculateRealizedExpenses` doit etre reimplemente en Swift (ou utilise via un pont si envisage)
  - Suivre le design system iOS existant (SF Symbols pour les icones, swatches M3 adaptees)
  - La barre segmentee peut utiliser un `HStack` de `Capsule()` natifs
- **Encryption impact:** Les montants sont dechiffres cote client — meme pattern que le web
- **Platform:** iOS

### Feature 3.2: Message contextuel adaptatif selon l'avancement

- **What it does:** Enrichir le message sous la barre de progression avec un contexte actionnable :
  - 0% : "Commence par pointer tes revenus recus"
  - 25% : "Continue avec tes charges fixes"
  - 75% : "Plus que quelques elements — pense a verifier tes depenses variables"
  - 100% : "Tout est pointe ! Ton solde estime devrait coller avec ta banque."
- **Why it matters now:** Les messages actuels ("on avance", "presque fini") sont encourageants mais ne guident pas. Des messages actionables transforment le bloc en mini-coach.
- **What it builds on:** Le microcopy dynamique existant (switch sur `progressPercentage`)
- **What it doesn't touch:** Pas de logique de calcul, pas de backend
- **Implementation context:**
  - Fichier : le composant `BudgetVerificationBlock` (renomme en Phase 2)
  - Adapter le switch existant avec des messages plus longs et contextuels
  - DA : Ton encourageant, tutoiement, pas d'injonction
- **Encryption impact:** None
- **Platform:** Web + iOS

### Feature 3.3: Indicateur d'ecart hero vs solde estime

- **What it does:** Afficher discretement l'ecart entre le hero ("Ce qu'il te reste") et le solde estime, avec une explication simple : "Ecart de 387 CHF — ce sont les elements pas encore pointes."
- **Why it matters now:** Meme apres le Niveau 2, certains utilisateurs verront les deux chiffres et se demanderont pourquoi ils different. Un indicateur proactif repond a cette question avant qu'elle ne se pose.
- **What it builds on:** Les deux computed values existent deja dans `BudgetDetailsStore` (`realizedBalance` et le `remaining` du hero)
- **What it doesn't touch:** Pas de nouveau calcul, pas de backend
- **Implementation context:**
  - Calcul : `ecart = heroRemaining - realizedBalance` (deja disponibles comme inputs du parent)
  - Affichage : Sous le solde estime, en `text-body-small text-on-surface-variant/60`
  - Ne s'affiche que si ecart > 0 et progression < 100%
  - DA : Ton informatif, pas alarmiste
- **Encryption impact:** None
- **Platform:** Web + iOS

## 6. Parking Lot

- **Rapprochement interactif (saisie du solde bancaire)** — Overkill pour 3 utilisateurs. L'ecart affiche serait souvent "faux" (frais bancaires, transactions pending, multi-comptes) et creeraient de l'anxiete. A reconsiderer si les utilisateurs demandent explicitement cette fonctionnalite apres la Phase 2.
- **Historique des rapprochements** — Tracker l'evolution du solde estime au fil du mois. Interessant pour les utilisateurs avances, mais premature. Necessite du stockage supplementaire.
- **Notification "Il te reste X elements a pointer"** — Push notification ou badge. Bon pour la retention mais necessite l'infra push (iOS + web). A envisager post-App Store.

## 7. Rejected Ideas

- **Fusionner le hero et le bloc verification en un seul** — Trop risque. Les deux repondent a des questions differentes. Fusionner brouille les deux concepts au lieu de les clarifier.
- **Supprimer le bloc verification** — L'intention est bonne (outil de rapprochement bancaire simplifie). Le probleme est la communication, pas la fonctionnalite.
- **Ajouter un graphique d'evolution dans le bloc** — Surcharge un bloc dont le probleme premier est la simplicite. Un graphique ajoute de la complexite visuelle sans repondre a la question "combien sur mon compte ?".
- **Remplacer "pointer" par "valider"** — "Valider" implique un jugement (c'est bon/pas bon). "Pointer" est neutre et correspond mieux au geste mental de rapprochement.
- **Couleur differente pour le bloc (bleu, etc.)** — Le fond `surface-container-low` gris clair est neutre et n'entre pas en competition avec le hero colore. Changer la couleur ajouterait du bruit visuel.

## 8. Dependency Map

```
[1.1 Renommer labels] ──┐
[1.2 Titre de section] ──┼──> [2.1 Inverser hierarchie] ──> [2.3 Renommer composant] ──> [3.1 Port iOS]
[1.3 Reformuler tooltip]─┘         │                                                       │
                                   └──> [2.2 Disambiguer les deux restes]                  │
                                                                                            │
                                   [3.2 Messages contextuels] ─────────────────────────────┘
                                   [3.3 Indicateur ecart] ─────────────────────────────────┘
```

**Sequencing :**

1. **Phase 1 (1.1 + 1.2 + 1.3)** : Independants entre eux, peuvent etre livres en un seul commit. Pas de dependance externe.
2. **Phase 2 (2.1)** : Depend de Phase 1 car les nouveaux labels doivent etre en place avant de reorganiser le layout. 2.2 peut etre fait en parallele de 2.1. 2.3 (renommage) se fait en dernier pour ne pas bloquer les autres.
3. **Phase 3** : 3.1 (iOS) depend de 2.3 (nommage final stabilise). 3.2 et 3.3 sont independants et peuvent etre faits dans n'importe quel ordre.
