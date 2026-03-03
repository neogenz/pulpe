# Pulpe — Direction Artistique & Brand Guidelines

> Document de référence unique pour l'ensemble de l'écosystème Pulpe : app web, app iOS, landing page, emails, communication. Les sections 1 à 7 sont universelles. La section 8 contient les déclinaisons par plateforme.

---

## 1. Vision de Marque

### L'essence Pulpe

**Pulpe, c'est un grand bol d'air frais après avoir fermé Excel.** C'est l'équivalent UX de poser ses valises après un long voyage : on respire, on voit clair, on sait où on va.

### Ce que Pulpe EST

- Un compagnon bienveillant qui t'aide à voir loin
- Un espace de calme dans le chaos des finances
- Un outil qui donne de l'énergie plutôt qu'il n'en prend
- La fin d'une douleur chronique, pas un énième outil

### Ce que Pulpe N'EST PAS

- Une app bancaire froide et corporative (bleu marine, graphiques agressifs)
- Un outil anxiogène qui rappelle tes erreurs (rouge partout, alertes stressantes)
- Un logiciel de comptable (dense, chiffré, intimidant)

---

## 2. Piliers Émotionnels

Chaque décision de design, de wording ou de fonctionnalité doit servir au moins un de ces piliers.

### Soulagement

L'émotion primaire. Le passage de "subir" à "maîtriser" est un soulagement viscéral.

- **On vend** : la fin d'une douleur chronique
- **Ton** : rassurant, validant, libérateur
- **Visuel** : espaces aérés, validation douce

### Clarté

La dissipation du brouillard mental. Savoir où on en est, voir loin.

- **On vend** : une réduction massive de la charge cognitive
- **Ton** : simple, direct, sans jargon
- **Visuel** : hiérarchie claire, information priorisée

### Contrôle

Le sentiment de reprendre le volant de sa vie financière.

- **On vend** : l'autonomie, le pouvoir de décision
- **Ton** : empowerment, confiance en l'utilisateur
- **Visuel** : actions évidentes, feedback immédiat

### Légèreté

Le "calm technology" appliqué aux finances. Pas de jugement, pas de stress.

- **On vend** : une relation apaisée avec l'argent
- **Ton** : détendu, bienveillant, sans culpabilisation
- **Visuel** : coins arrondis, couleurs douces, animations fluides

---

## 3. Identité Visuelle

### 3.1 Palette de Couleurs

#### Couleurs de marque (seeds)

| Rôle | Couleur | Seed | Usage |
|------|---------|------|-------|
| **Primary** | Vert nature | `#006E25` | Actions principales, épargne, accents positifs |
| **Secondary** | Vert olive | `#406741` | Éléments secondaires, labels discrets |
| **Tertiary** | Bleu info | `#0061A6` | Revenus, liens, information |
| **Error** | Rouge | `#BA1A1A` | Déficit hero, dépassement critique (>100%) |
| **Expense** | Ambre | `#B35800` | Dépenses (catégorie), dépassement modéré |

#### Zones visuelles — le principe structurant

L'écran Pulpe se divise en deux zones distinctes :

| Zone | Rôle | Fond | Caractère |
|------|------|------|-----------|
| **Zone d'émotion** | Hero card, header (~30-35% haut) | Couleur vive selon état financier | Expressif, immersif — l'émotion frappe ici |
| **Zone de contenu** | Listes, cartes, formulaires | Neutre chaud | Calme, lisible — l'information prime |

**Le caractère vient du haut, la clarté vient du bas.**

La transition entre les deux zones est un dégradé doux (40-60 points), pas une coupure nette. Le fond du header s'accorde avec la hero card et se dissout progressivement dans le neutre.

| État financier | Teinte header | Transition vers |
|----------------|--------------|-----------------|
| **Confortable** (<80%) | Vert pâle | Neutre chaud |
| **Serré** (80-100%) | Ambre pâle | Neutre chaud |
| **Déficit** (>100%) | Rosé pâle | Neutre chaud |

**Pourquoi le fond de contenu est neutre (pas vert) :**

- Le vert sur fond vert = pas de contraste = pas de hiérarchie = contraire au pilier Clarté
- Les apps "calm" (YNAB, Goodbudget) posent leur identité dans les accents, pas dans le fond
- Un fond neutre rend les couleurs financières (vert, ambre, bleu) immédiatement lisibles
- Quand le header passe au vert, ça veut dire que les finances vont bien — le vert redevient significatif

**Écrans sans hero card** (modèles, paramètres, formulaires) : pas de zone d'émotion. Le fond neutre chaud occupe tout l'écran. Le header de navigation reste sobre (titre + actions). L'identité Pulpe passe par les accents (boutons, icônes, couleurs financières) et le ton de voix, pas par un fond teinté.

#### Surfaces et fonds

| Élément | Light mode | Dark mode |
|---------|-----------|-----------|
| **Fond de contenu** | Neutre chaud `#F7F6F3` | Fond système sombre |
| **Cartes** | Blanc `#FFFFFF` ou surface élevée | Surface sombre secondaire |
| **Hero card** | Couleur pleine (vert / ambre / rouge) | Ton sombre de la couleur d'état |

Le neutre chaud `#F7F6F3` est le token de fond le plus important. Il est défini ici une seule fois — les sections plateforme (§8) ne font que préciser son implémentation technique (variable CSS, Color SwiftUI, etc.).

#### Texte

| Rôle | Code | Usage |
|------|------|-------|
| **Texte principal** | `#1A1C19` | Corps de texte — éviter le noir pur `#000` |
| **Texte secondaire** | Opacité réduite du principal | Labels, dates, métadonnées |

#### Principes couleurs

- Le vert = actions, épargne, états positifs. **Il ne colore PAS les surfaces neutres.**
- Les fonds de contenu sont neutres chauds — pas froids (pas de gris bleuté), pas verts.
- L'identité Pulpe se manifeste par les accents et la zone d'émotion, pas par un bain de couleur uniforme.
- L'ambre signale les dépenses (normal), le rouge signale un état critique (exceptionnel).
- Pas de rouge agressif pour les erreurs → utiliser des tons neutres avec du contexte.

### 3.2 Logo & Icône

L'icône actuelle (tranche d'agrume neumorphique) :

**Forces :**
- Lien "Pulpe" / agrume immédiat et mémorable
- Style soft/neumorphique = calme et modernité
- Les quartiers peuvent symboliser la segmentation du budget
- Couleur distinctive sur les stores (peu d'apps finance en vert clair)

**Points d'attention :**
- Le style très "soft" peut manquer de présence (renforcer le contraste si besoin)
- En petit (notification, favicon), les détails risquent de se perdre
- Le lien agrume ↔ finance s'explique par le nom "Pulpe"

**Motif graphique :**
- La forme "quartier d'agrume" peut devenir un motif récurrent pour les sections
- Des courbes douces plutôt que des angles vifs
- Des dégradés subtils verts (pas de flat colors brutales)

### 3.3 Typographie

| Usage | Police | Alternative |
|-------|--------|-------------|
| **Titres (app)** | Manrope | Plus Jakarta Sans |
| **Corps (app web)** | DM Sans | Nunito Sans |
| **Corps (app iOS)** | SF Pro (système) | — |
| **Landing page** | Poppins | — |
| **Chiffres/montants** | Police système (chiffres tabulaires natifs) | — |

**Stratégie iOS :** Manrope pour les titres et éléments de marque, SF Pro (système) pour tout le reste (corps, labels, captions, montants). Deux polices max — pas de DM Sans sur iOS. SF Pro offre des chiffres tabulaires natifs, un Dynamic Type parfait, et une sensation native.

**Principes :**
- Éviter les polices trop géométriques/tech (Roboto, Inter) → trop froid
- Éviter les serif classiques → trop "banque"
- Privilégier des polices modernes, friendly, lisibles
- Maximum 2 familles de polices par plateforme

### 3.4 Iconographie

| Aspect | Recommandation |
|--------|----------------|
| **Style** | Outlined (pas filled) |
| **Trait** | Doux, 1.5-2px |
| **Coins** | Arrondis |
| **Librairies** | Phosphor Icons, Heroicons (outline) |

**Principes :**
- Simple et reconnaissable
- Pas de symboles d'avertissement agressifs
- Privilégier les checkmarks aux croix
- Pas d'illustrations 3D complexes — rester dans le "flat soft"

### 3.5 Boutons

| Variante | Style | Usage |
|----------|-------|-------|
| **Primaire** | Filled vert (primary) | CTA principal — une seule action dominante par écran |
| **Secondaire** | Outlined | Actions alternatives, annuler, retour |
| **Texte** | Text button (pas de fond) | Navigation inline, actions tertiaires |
| **Destructif** | Text rouge ou filled rouge | Suppression, déconnexion — toujours avec confirmation |

**Principes :**
- Un seul bouton primaire par écran ou par dialog
- Les boutons destructifs ne sont jamais la première option visuellement
- Sur mobile, les boutons primaires font au minimum 48pt de hauteur (touch target)

### 3.6 Micro-interactions

- Feedback immédiat sur les actions
- Transitions douces (200-300ms)
- Pas d'animations stressantes ou rapides
- Confirmations visuelles subtiles (pas de confettis excessifs)

### 3.7 Couleurs Financières — Modèle Sémantique

#### Catégories vs états — deux concepts, deux systèmes

| Concept | Couleur | Token | Usage |
|---------|---------|-------|-------|
| **Revenu** (catégorie) | Bleu / Tertiary | `--pulpe-financial-income` | Montants, pills, icônes, lignes budget |
| **Dépense** (catégorie) | Ambre | `--pulpe-financial-expense` | Montants, pills, icônes, lignes budget |
| **Épargne** (catégorie) | Vert / Primary | `--pulpe-financial-savings` | Montants, pills, icônes, barres de progression |
| **Déficit** (état critique) | Rouge / Error | `--pulpe-financial-critical` | Hero en déficit, dépassement >100% |
| **Négatif** (état modéré) | Ambre | `--pulpe-financial-negative` | Rollover négatif, mois serré |

#### Application par élément

| Élément | Principe |
|---------|----------|
| **Montant texte — sans transactions** | Couleur pleine de la catégorie (bleu / ambre / vert) |
| **Montant texte — avec transactions** | Couleur d'état uniquement : neutre (0–79%), warning amber (80–100%), over-budget amber (>100%). L'icône porte déjà la catégorie. |
| **Icône badge** | Fond = version transparente de la couleur ; texte = couleur pleine. Exception : dépense utilise un fond/texte neutre |
| **Pills hero** | Fond et bordure = versions transparentes de la couleur de catégorie |
| **Barre de progression — sans transactions** | Masquée |
| **Barre de progression — avec transactions** | Track = version transparente ; fill = couleur d'état (même logique que montant texte) |
| **Section header badge** | Fond = version transparente de la couleur dominante de la section |

**Asymétrie intentionnelle :** dès qu'une ligne a des transactions liées, la logique bascule de "catégorie" à "état". L'icône colorée suffit à identifier le type — doubler la catégorie sur le montant crée une collision cognitive (principe 26, ux-ui-principles.md).

Les valeurs d'opacité exactes vivent dans les DesignTokens du code, pas ici.

#### Le hero card change de couleur selon l'état financier

| État | Fond hero | Texte hero | Microcopy |
|------|-----------|-----------|-----------|
| **Confortable** (<80%) | Vert (gradient primaire) | Blanc | Encourageant |
| **Serré** (80-100%) | Ambre (gradient warning) | Blanc chaud | Factuel, pas alarmiste |
| **Déficit** (>100%) | Rouge (gradient error) | Blanc rosé | "Tu le sais, et c'est déjà ça" |

#### Principes des couleurs d'état

**Niveau ligne (budget line row) :** couleurs d'état en spectre ambre — jamais rouge.
- Sain (0–79%) → neutre (gris secondaire)
- Near limit (80–100%) → warning amber (`#B8860B`)
- Over-budget (>100%) → deep amber (`#C27A00`)

**Niveau hero card :** le rouge entre en jeu uniquement ici.
- L'ambre signale une catégorie (dépense) ET les états ligne (near-limit / over-budget)
- Le rouge est réservé à l'état de déficit global (hero card uniquement)

**Pourquoi le rouge n'est pas anxiogène ici :**
- Le hero est le seul endroit où l'émotion doit frapper
- Le microcopy désactive l'anxiété ("tu le sais, et c'est déjà ça")
- Le rouge est factuel et contextuel, pas punitif
- Les apps "calm" (YNAB, Goodbudget) font pareil

**La règle "Pas de rouge agressif" s'applique :**
- Aux transactions individuelles → ambre
- Aux messages d'erreur → ton neutre + suggestion
- Aux états d'alerte dans les tables → ambre

**Le rouge est réservé à :**
- Hero section en déficit global (>100% du budget total)

---

## 4. Ton de Voix & Rédaction UX

### 4.1 Principes Généraux

| Principe | Application |
|----------|-------------|
| **Tutoiement** | Systématique — relation proche, pas corporate |
| **Phrases** | Courtes et directes |
| **Vocabulaire** | Du quotidien, pas de jargon financier |
| **Posture** | Encourageant sans être condescendant |

### 4.2 Le Ton Pulpe

- **Bienveillant** mais pas condescendant
- **Simple** mais pas simpliste
- **Confiant** mais pas autoritaire
- **Humain** — toujours chaleureux

### 4.3 Transformations de Wording

| Contexte | Éviter | Préférer |
|----------|--------|----------|
| Action | "Gérer votre budget" | "Voir clair dans tes finances" |
| Action | "Tracking des dépenses" | "Suivre tes projets" |
| Action | "Analyser vos données" | "Comprendre ta situation" |
| Info | "Solde disponible" | "Ce qu'il te reste ce mois" |
| Erreur | "Erreur de saisie" | "Quelque chose ne colle pas — vérifions ensemble" |
| Succès | "Félicitations !" (trop gamifié) | "Bien joué" (humain) |
| Dépassement | "Attention ! Vous avez dépassé votre budget" | "Tu as dépassé ton budget ce mois-ci — ça arrive" |

---

## 5. Vocabulaire Métier

Termes techniques vs termes utilisateur (FR) :

| Terme technique | Terme utilisateur |
|-----------------|-------------------|
| `budget_lines` | Prévisions |
| `fixed` | Récurrent |
| `one_off` | Prévu |
| `transaction` | Transaction / Réel |
| `income` | Revenu |
| `expense` | Dépense |
| `saving` | Épargne |
| `available` | Disponible à dépenser |
| `remaining` | Reste |
| `rollover` | Report |
| `checked` | Pointé |
| `unchecked` | À pointer |

---

## 6. Patterns de Microcopy

### 6.1 Messages d'Erreur

**Format :** `[Ce qui s'est passé] — [suggestion]`

| Avant | Après |
|-------|-------|
| "L'email est requis." | "Ton email est nécessaire pour continuer" |
| "Une adresse email valide est requise." | "Cette adresse email ne semble pas valide" |
| "Le mot de passe doit contenir au moins 8 caractères." | "8 caractères minimum pour sécuriser ton compte" |
| "Email ou mot de passe incorrect." | "Email ou mot de passe incorrect — on réessaie ?" |
| "Une erreur inattendue s'est produite." | "Quelque chose n'a pas fonctionné — réessayons" |
| "Erreur lors de la sauvegarde" | "La sauvegarde n'a pas abouti — on retente ?" |

**Principes :**
- Toujours expliquer ce qui s'est passé
- Proposer une action ou une solution
- Ne jamais culpabiliser l'utilisateur

### 6.2 Empty States

**Opportunité de guider, pas de constater un vide.**

| Avant | Après |
|-------|-------|
| "Aucun budget trouvé" | "Pas encore de budget — on en crée un ?" |
| "Aucune prévision récurrente" | "Aucune prévision récurrente pour l'instant" |
| "Aucune transaction" | "Pas de transaction ce mois-ci" |
| "Aucun modèle de budget" | "Tu n'as pas encore de modèle" |

**Exemple développé :**
> "Rien ici pour l'instant. Ajoute ta première dépense prévue pour commencer à voir clair."

### 6.3 Succès & Confirmations

| Avant | Après |
|-------|-------|
| "Transaction supprimée" | "Transaction supprimée" |
| "Modèle créé avec succès" | "Ton modèle est prêt" |
| "Paramètres enregistrés" | "C'est enregistré" |
| "Transaction modifiée" | "Modification enregistrée" |

**Exemples contextuels :**
- Économies atteintes : "Objectif atteint ce mois. Tu peux souffler."
- Mois déficitaire : "Ce mois sera serré. Mais tu le sais, et c'est déjà ça."

### 6.4 Loading States

**Rassurer sur ce qui se passe, utiliser des verbes d'action positifs.**

| Avant | Après |
|-------|-------|
| "Chargement du tableau de bord..." | "Préparation de ton tableau de bord..." |
| "Chargement des données mensuelles..." | "Récupération de tes données..." |
| "Création en cours..." | "Création en cours..." |
| "Connexion en cours..." | "Connexion..." |

### 6.5 Onboarding

| Avant | Après |
|-------|-------|
| "Finaliser ton profil" | "Encore quelques détails" |
| "Quelques informations pour créer ton premier budget" | "On prépare ton espace — c'est rapide" |

---

## 7. Checklist Rapide

Avant de valider un écran, un email ou une communication :

- [ ] **Soulagement** : Est-ce que ça rassure plutôt qu'inquiète ?
- [ ] **Clarté** : Est-ce que c'est compréhensible en 3 secondes ?
- [ ] **Contrôle** : Est-ce que l'utilisateur sait quoi faire ensuite ?
- [ ] **Légèreté** : Est-ce qu'il y a du jugement ou de la culpabilisation ?
- [ ] **Tutoiement** : Est-ce qu'on utilise "tu" ?
- [ ] **Vocabulaire** : Est-ce qu'on utilise les termes utilisateur (pas techniques) ?
- [ ] **Zones** : Est-ce que la zone d'émotion et la zone de contenu sont distinctes ?
- [ ] **Couleurs** : Vert = accents/actions, fond = neutre chaud, financières = catégorie si pas de transactions / état si transactions liées (principe 26) ?

---

## 8. Déclinaison par Plateforme

Les sections 1 à 7 sont le socle commun. Cette section documente les adaptations spécifiques à chaque plateforme.

### 8.1 App iOS (SwiftUI)

#### Zone d'émotion — Header dynamique

Le header (30-35% de l'écran) reflète l'état financier. Le fond du header est une teinte pâle de la couleur d'état, qui transite en dégradé doux vers le fond neutre chaud du contenu.

| État | Teinte header | Transition vers | Hex indicatifs |
|------|--------------|-----------------|----------------|
| Confortable | Vert pâle | Neutre chaud | `#D4EDDA` → `#F7F6F3` |
| Serré | Ambre pâle | Neutre chaud | `#FEF0D4` → `#F7F6F3` |
| Déficit | Rosé pâle | Neutre chaud | `#FDE2E2` → `#F7F6F3` |

Le fond de contenu reste **toujours** le neutre chaud défini en §3.1, quel que soit l'état.

#### Surfaces

| Élément | Light | Dark |
|---------|-------|------|
| Fond de contenu | Neutre chaud §3.1 (`Color.pulpeNeutralWarm`) | `systemGroupedBackground` |
| Cartes | Blanc (`Color.surfaceCard`) | `secondarySystemGroupedBackground` |
| Hero card | Couleur pleine (vert/ambre/rouge) | Ton sombre de la couleur d'état |

#### Liquid Glass (iOS 26+)

- **Réservé à la navigation et aux contrôles flottants de l'app authentifiée** : tab bar, boutons flottants, toasts, modals
- **Jamais sur le contenu métier** : cartes, listes, sections de texte
- `.glassEffect(.regular.interactive())` pour les contrôles tactiles
- `.glassEffect(.regular.tint(Color.pulpePrimary))` pour la proéminence visuelle
- Fallback iOS 18-25 : `.ultraThinMaterial` + `.clipShape(Capsule())`
- Exception assumée : les flows pré-auth (welcome, login, onboarding) peuvent utiliser glow et shadow pour soutenir l'expressivité de marque, tant qu'ils n'imitent pas des cartes glass dans le contenu.

#### Shell & navigation (état actuel)

- Bottom tabs : **Accueil**, **Budgets**, **Modèles**
- **Mon compte** n'est pas un onglet : accès via action toolbar depuis Accueil, en sheet
- Le détail d'un mois se fait depuis **Budgets** ; la navigation entre mois utilise un menu de mois (`MonthDropdownMenu`), pas un swipe horizontal personnalisé
- `pull-to-refresh` et `swipe actions` suivent les conventions natives iOS

#### Dashboard actuel (mars 2026)

- Ordre : **Hero** → **Projection** → **Aperçu** → **Transactions récentes**
- **Dépenses** et **Cette année** sont en progressive disclosure (repliées par défaut)
- Le hero reste l'élément dominant visuel et cognitif ; les cartes suivantes apportent du contexte court terme, pas une couche d'analyse dense

#### Background premium (iOS 18+)

Mesh gradient subtil et chaud sur fond neutre, avec des accents crème très doux.
En dark mode : fond système avec accents minimaux.

#### Typographie

Polices : Manrope (titres/brand) + SF Pro système (corps, labels, captions, montants). Tailles spécifiques iOS :

| Usage | Poids | Taille |
|-------|-------|--------|
| Titres hero | Bold | 34pt |
| Titres de section | Bold | 22pt |
| Boutons | SemiBold | 17pt |
| Corps | Regular | 17pt |
| Labels | SemiBold | 15pt |
| Tab labels | Medium | 10pt |
| Captions | Regular | 12pt |

#### Tokens de spacing

| Token | Valeur |
|-------|--------|
| xs | 4pt |
| sm | 8pt |
| md | 12pt |
| lg | 16pt |
| xl | 20pt |
| xxl | 24pt |
| xxxl | 32pt |

#### Corner radius

| Token | Valeur | Usage |
|-------|--------|-------|
| xs | 4pt | Progress bars, indicateurs fins |
| sm | 8pt | Badges, chips |
| md | 12pt | Cartes, inputs |
| button | 14pt | Boutons primaires |
| lg | 16pt | Sheets, modals |
| xl | 20pt | Hero cards |

#### Motion

| Type | Paramètres |
|------|-----------|
| Fast | 0.2s |
| Normal | 0.3s |
| Slow | 0.5s |
| Spring | response 0.5s, damping 0.8 |
| Gentle spring | response 0.6s, damping 0.85 |

### 8.2 App Web (Angular + Material 21 + Tailwind v4)

#### Système de tokens (3 couches)

| Couche | Préfixe | Usage |
|--------|---------|-------|
| Pulpe sémantique | `--pulpe-*` | Couleurs financières, surfaces, motion |
| Tailwind | `--color-*`, classes utilitaires | Layout, couleurs, typographie en template |
| Material System | `--mat-sys-*` | Fondation — thème uniquement, pas dans les composants |

#### Fond de contenu

Le body utilise `--mat-sys-surface` du thème Material. La palette neutral doit être générée avec un seed désaturé (pas dérivé du vert primaire) pour que les surfaces soient neutres chaudes.

Commande : `ng generate @angular/material:theme-color --primaryColor=#006E25 --neutralColor=#8A8A82`

#### Zone d'émotion (Hero dashboard)

Le hero utilise un gradient dynamique :
- Confortable : `--pulpe-hero-primary` (vert) + `color-mix(black 25%)`
- Serré : `--pulpe-hero-warning` (ambre)
- Déficit : `--pulpe-hero-error` (rouge)

#### Typographie

| Usage | Police | Variable Material |
|-------|--------|-------------------|
| Titres, hero | Manrope (`brand-family`) | `--mat-sys-display-*-font` |
| Corps, UI | DM Sans (`plain-family`) | `--mat-sys-body-*-font` |
| Montants | DM Sans tabular | Chiffres alignés |

#### Overrides Material

- Utiliser `mat.*-overrides()` — **jamais** `::ng-deep`
- Dialogs : `surface-container-high`
- Tabs : indicateur 3px (M3 spec)

#### Motion

| Token | Valeur | Usage |
|-------|--------|-------|
| `--pulpe-motion-fast` | 150ms | Micro-interactions, hover |
| `--pulpe-motion-base` | 220ms | Transitions standard |
| `--pulpe-motion-slow` | 320ms | Entrées de page, sheets |

#### Dark mode

- Classe `.dark-theme` sur `html`
- Variante Tailwind `dark:` scopée à `.dark-theme`
- Fallback `@media (prefers-color-scheme: dark)`

### 8.3 Landing Page (Next.js + Tailwind v4)

- Typographie : **Poppins** (pas Manrope/DM Sans)
- Fond : blanc ou neutre très clair
- Accents : vert Pulpe pour les CTA, bleu pour les liens
- Wording orienté bénéfices émotionnels (soulagement, clarté)
- Pas de surcharge visuelle — respiration maximale
- Visuels aérés, illustrations "flat soft", pas de 3D complexe

### 8.4 Emails & Communication

- Ton chaleureux et direct, tutoiement systématique
- Objet court et orienté bénéfice
- Un seul CTA par email, clair et évident
- Réseaux sociaux : ton décontracté, montrer l'humain derrière l'app
- Éviter le jargon finance partout
