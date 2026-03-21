# Design Audit — Pulpe iOS App
**Date:** 2026-03-21
**Scope:** Entire iOS app — coherence, emotional impact, character, pleasure of use
**Reference:** DA.md, Practical UI, iOS 26 HIG, UX Principles

---

## 1. Overall Assessment

**L'app est techniquement solide et bien construite — mais elle manque de punch.**

Le design system est propre : tokens centralisés, typographie double-police (Manrope + SF Pro), couleurs financières DA-compliant, animations spring cohérentes, accessibilité sérieuse, skeletons sur tous les écrans. Le hero card est le meilleur élément — gradient d'état, pace indicator, Liquid Glass, cercles décoratifs. C'est du bon travail d'ingénierie.

Mais Pulpe n'a pas encore trouvé son **caractère**. L'app ressemble trop à une implémentation propre de `systemGroupedBackground` avec des cartes blanches dessus. On est dans le territoire d'une app iOS générique bien faite — pas d'une app qui donne envie de la rouvrir. Le fond gris-bleu système (`#F2F2F7`) trahit la DA qui demande un neutre chaud (`#F7F6F3`). La "zone d'émotion" n'existe pas — le hero card est coloré mais flotte sur un fond froid sans transition. L'onboarding manque de wow. Les listes de budgets et templates sont fonctionnelles mais plates. L'écran Compte pourrait être celui de n'importe quelle app.

**Score émotionnel actuel par pilier :**

| Pilier | Note | Commentaire |
|--------|------|-------------|
| **Soulagement** | 7/10 | Le hero card rassure, le ton est bon, mais l'ensemble manque de chaleur |
| **Clarté** | 8/10 | Hiérarchie claire, information bien organisée, bonne densité |
| **Contrôle** | 8/10 | Actions évidentes, swipe/toggle bien implémentés, FAB contextuel |
| **Légèreté** | 6/10 | Le fond froid et les surfaces système créent une ambiance utilitaire, pas calm |

**L'objectif : passer de "bien fait" à "je l'adore".**

---

## 2. Phase 1 — Critical

### 2.1 Le fond de l'app est froid — trahit l'identité Pulpe

**[Global / `Color.appBackground`]**

`Color(uiColor: .systemGroupedBackground)` = `#F2F2F7` (gris bleuté iOS) → DA demande `#F7F6F3` (neutre chaud)

C'est le problème #1. Tout le reste du design repose sur ce fond. Le warm neutral est ce qui différencie Pulpe des apps bancaires froides. Actuellement, chaque écran a l'ambiance d'une app iOS Settings.

→ **Créer un `Color.pulpeNeutralWarm`** avec `#F7F6F3` (light) / `#141210` (dark mode — warm near-black, pas pure #000000)
→ **Remplacer `Color.appBackground`** par ce nouveau token
→ **Remplacer `Color.sheetBackground`** light par un ton légèrement plus chaud que le fond principal

**Impact :** Transforme l'ambiance de toute l'app en un changement. Chaque écran passe de "utilitaire" à "calm tech".

**DA.md §3.1 :** *"Le fond de contenu est neutre chaud — pas froid (pas de gris bleuté), pas vert."*

---

### 2.2 La "zone d'émotion" n'existe pas sur le dashboard

**[CurrentMonthView / DashboardGreeting + HeroBalanceCard]**

DA.md §3.1 décrit deux zones visuelles :
- **Zone d'émotion** (haut ~30-35%) : fond teinté selon l'état financier, gradient doux vers le neutre
- **Zone de contenu** (bas) : neutre chaud, information prime

Actuellement : le dashboard est un `ScrollView` plat avec un greeting texte + hero card. Le hero est coloré mais le fond derrière reste `systemGroupedBackground`. Il n'y a pas de transition gradient entre les zones.

→ **Ajouter un gradient dynamique derrière la zone haute du dashboard** :
  - Comfortable : vert pâle `#D4EDDA` → neutral warm `#F7F6F3` (transition sur ~60pt)
  - Serré : ambre pâle `#FEF0D4` → neutral warm
  - Déficit : rosé pâle `#FDE2E2` → neutral warm
→ Le gradient se place sous le greeting + hero card (via `ZStack` background)
→ Transition animée entre les états (cross-fade du gradient)
→ Écrans sans hero card (templates, paramètres) : pas de zone d'émotion, fond neutre chaud direct

**Impact :** Le dashboard passe de "grille de cartes" à "expérience émotionnelle". L'utilisateur sent immédiatement l'état de ses finances — le vert pâle rassure, l'ambre alerte doucement.

**DA.md §3.1 :** *"Le caractère vient du haut, la clarté vient du bas."*

---

### 2.3 L'onboarding manque de coup de cœur

**[OnboardingFlow / WelcomeStep]**

L'onboarding utilise `Color.loginGradientBackground` — un gradient très subtil, presque invisible. C'est le premier contact de l'utilisateur avec Pulpe. C'est ici qu'on vend le soulagement, la promesse.

Actuellement : le WelcomeStep est propre mais timide. Un logo, un titre, un sous-titre, un CTA. C'est correct. Ça ne fait pas "holy shit, cette app est différente."

→ **Renforcer le gradient de bienvenue** : le gradient actuel `#D6F2DE → white` (30% transition) est trop timide. Étendre la couverture à 55% de l'écran comme `welcomeGradientBackground` mais l'utiliser aussi sur les étapes suivantes.
→ **Ajouter un mesh gradient subtil** sur le WelcomeStep (iOS 18+) — accents crème très doux, mouvement lent
→ **Les étapes du form** : actuellement sur `loginGradientBackground` très pale. Ajouter un accent de couleur plus marqué sur les headers de step — une bande colorée ou un dégradé plus affirmé sur le `OnboardingStepHeader`
→ **Motion d'entrée** : les entrées `blurSlide` existent mais sont timides. Ajouter un scale légèrement plus marqué sur le hero icon (0.7 → 1.0 au lieu de 0.8 → 1.0)

**Impact :** L'utilisateur se dit "ah, c'est pas comme les autres" dès la première seconde.

**DA.md §8.1 :** *"Exception assumée : les flows pré-auth (welcome, login, onboarding) peuvent utiliser glow et shadow pour soutenir l'expressivité de marque."*

---

### 2.4 Les surfaces de cartes sont system-gray, pas warm

**[Global / `pulpeCardBackground()`]**

`CardBackgroundModifier` utilise `Color.surfaceContainerLowest` = `Color(uiColor: .secondarySystemGroupedBackground)` — c'est du gris froid système.

Sur un fond neutre chaud, ces cartes créeront un contraste de température (warm bg, cold cards) qui casse la cohérence.

→ **Créer un `Color.pulpeCardSurface`** : `#FFFFFF` (light) / `#1C1A18` (dark — warm dark, pas system gray)
→ **Mettre à jour `CardBackgroundModifier`** pour utiliser ce nouveau token

**Impact :** Les cartes respirent dans la même température que le fond. L'ensemble devient cohérent et chaud.

---

## 3. Phase 2 — Refinement

### 3.1 Dark mode manque de personnalité

**[Global / Color+Pulpe.swift dark variants]**

Le dark mode utilise `systemGroupedBackground` (#000000) et `secondarySystemGroupedBackground` (gris système). C'est le minimum viable.

Références : Copilot Money utilise near-black navy (`#000814`) avec texte à 90% white opacity pour un effet "holographique premium". YNAB utilise des surfaces sombres teintées.

→ **Dark mode background** : near-black warm (`#141210` ou `#151311`) au lieu de pure black
→ **Dark card surfaces** : warm dark gray (`#1E1C1A`) au lieu de system gray
→ **Text opacity** : 90% white pour le texte principal (pas 100% system label)
→ **Hero gradients dark** : déjà bien implémentés, c'est un point fort

**Impact :** Le dark mode devient premium et cohérent avec l'identité warm de Pulpe au lieu de ressembler à iOS Settings en mode sombre.

---

### 3.2 Le dashboard greeting manque de poids visuel

**[DashboardGreeting]**

Le greeting est petit texte ("Bonjour" en `labelLarge` + "Tu gères bien ce mois-ci" en `stepTitle`). C'est fonctionnel mais ne crée pas de moment émotionnel.

→ **Augmenter la taille du greeting** : "Bonjour" reste discret (`labelLarge`), mais le headline passe à `brandTitle` (Manrope Bold 34pt) — c'est le titre du mois, il mérite d'être l'élément qui ancre l'écran
→ **Ou inversement** : si le hero card doit rester le point focal, réduire le greeting à un seul line contextuel et laisser le hero parler

Le problème actuel : le greeting et le hero se disputent l'attention sans qu'aucun des deux ne domine clairement.

→ **Choisir : soit un greeting qui frappe (grande typo Manrope), soit un greeting discret qui laisse le hero parler.** La solution intermédiaire actuelle ne sert aucun des deux.

---

### 3.3 Les sections du dashboard manquent de rythme visuel

**[CurrentMonthView sections]**

Toutes les sections (À pointer, Transactions récentes, Épargne) ont la même présentation : texte header `pulpeSectionHeader()` + card blanche. C'est propre mais monotone.

→ **Section header avec badge count** : "À pointer" + badge `(3)` avec fond teinté vert, "Transactions récentes" + badge `(5)` — donne un signal d'urgence/activité
→ **Subtle left accent** : ajouter une barre verticale colorée (2pt, `financialSavings`) sur le côté gauche de la card Épargne pour la distinguer visuellement des cards neutres — crée du rythme sans surcharger
→ **Espacement progressif** : les sections sont espacées de `xxl` (24pt) uniformément. Considérer un espacement légèrement plus grand avant "Épargne" pour créer des groupes visuels (hero group vs. action group vs. overview group)

---

### 3.4 Budget list manque de caractère

**[BudgetListView / YearSection]**

La liste de budgets est fonctionnelle (sections par année, collapsible, hero card pour le mois courant, skeleton). Mais visuellement c'est une grille de lignes blanches.

→ **Month rows** : ajouter un indicateur visuel d'état sur chaque ligne (petit point vert/ambre/rouge avant le nom du mois, ou une barre de progression condensée). Actuellement on doit entrer dans le budget pour voir si ça va.
→ **Current month hero card dans la liste** : déjà implémenté via `CurrentMonthHeroCard` — vérifier que c'est visuellement distinct des rows normales (il semble l'être via le corner radius xl et le gradient, c'est bien)
→ **"En cours" badge** : bien fait avec capsule verte. C'est un bon pattern à étendre (badge "Déficit" en ambre sur les mois problématiques ?)

---

### 3.5 Template list est trop spartan

**[TemplateListView / TemplateRow]**

C'est une List iOS standard avec des rows nom + description + chevron. Pas de caractère visuel.

→ **Template card layout** : au lieu de rows standards, montrer un mini-résumé visuel : nombre de lignes income/expense/saving avec des badges colorés, total prévu
→ **Default template** : le badge "Par défaut" est bien. Le rendre plus proéminent (plus grand, plus de contraste)
→ **Footer "X/3 modèles"** : passer de `.foregroundStyle(.secondary)` à un compteur plus visible avec barre de progression si on approche la limite

---

### 3.6 Account view est générique

**[AccountView]**

C'est un `List { Section { } }` standard iOS. Pas de personnalité Pulpe. Pas de header avec initiale/avatar. Pas d'indication visuelle de l'état du compte.

→ **Header section** : ajouter un bloc d'identité en haut — initiale de l'email dans un cercle vert Pulpe, email en dessous, peut-être un "Membre depuis [date]"
→ **Sections styling** : les icônes sont toutes en `.secondary` — utiliser des couleurs sémantiques (lock = vert, gear = secondary, sparkles = pulpePrimary) pour créer de la hiérarchie
→ **Déconnexion** : actuellement en `Color.errorPrimary` inline. Bien placé en fin de liste mais pourrait être visuellement séparé (plus d'espace avant, style légèrement différent)

---

### 3.7 Les empty states sont fonctionnels mais sans âme

**[Tous les écrans — CurrentMonthView, BudgetListView, TemplateListView]**

Pattern actuel : SF Symbol gris + titre + sous-titre + bouton CTA. C'est correct et DA-compliant dans le ton. Mais c'est générique.

→ **Illustrations custom** : remplacer les SF Symbols par des illustrations "flat soft" — même un simple SVG/SF Symbol composé (ex: un calendrier avec un petit coeur pour "Pas encore de budget"). C'est ici que l'identité "agrume/Pulpe" pourrait apparaître.
→ **Ton** : les textes sont bons ("Crée-en un pour commencer à suivre tes dépenses"). Considérer des variations saisonnières ou contextuelles pour la surprise ("C'est le printemps — parfait pour un nouveau départ financier")
→ **Animation** : le SF Symbol est statique. Un `.symbolEffect(.pulse)` doux sur l'icône ajouterait de la vie.

---

### 3.8 Cards shadows trop subtiles en light mode

**[DesignTokens.Shadow]**

Les shadows actuelles sont très douces (card: 0.06 opacity, 4pt radius, 2pt y-offset). Sur un fond neutre chaud, elles seront quasi invisibles.

→ **Augmenter légèrement** `Shadow.card` : opacity 0.08 → 0.10, radius 4 → 6 pour light mode
→ **Ou adopter l'approche "flat surface"** à 100% (pas de shadow du tout, différenciation par couleur uniquement) — c'est ce que fait `pulpeCardBackground` actuellement. Mais alors supprimer le `.shadow(DesignTokens.Shadow.card)` explicite dans `BudgetListView` pour être cohérent.
→ **Choisir une stratégie** : soit shadows partout, soit flat partout. Le mélange actuel (cards dashboard = flat via `pulpeCard()`, budget list month cards = shadow via `.shadow(DesignTokens.Shadow.card)`) crée une incohérence.

**Recommandation :** flat partout sauf hero card (qui utilise ses propres circles décoratifs et gradient). C'est plus cohérent avec l'ère Liquid Glass d'iOS 26.

---

## 4. Phase 3 — Polish

### 4.1 Compteur animé sur le hero amount

**[HeroBalanceCard / formattedBalance]**

L'amount a déjà `.contentTransition(.numericText())` — c'est bon. Mais au premier chargement, le montant apparaît d'un coup. Un compteur qui "roule" de 0 au montant réel sur 0.6s créerait un moment de révélation.

→ Implémenter via `TimelineView` + `Text(interpolatedValue)` avec `.monospacedDigit()` pour un effet "compteur de casino" doux
→ Se déclenche uniquement au premier affichage (pas à chaque refresh)

---

### 4.2 Celebration quand objectif épargne atteint

**[SavingsSummaryCard / completeView]**

Quand `summary.isComplete`, la card montre un checkmark vert statique. C'est factuel mais pas émotionnel.

→ **`.symbolEffect(.bounce, value: summary.isComplete)`** sur le checkmark
→ **Un `.sensoryFeedback(.success)`** au moment où l'état passe de progress à complete
→ **Microcopy bonus** : varier entre "Objectif atteint ce mois", "Bien joué ce mois", "Tu as tenu parole" (random parmi 3)

---

### 4.3 Transition hero card dashboard → budget details

**[CurrentMonthView → BudgetDetailsView]**

Les deux écrans affichent un `HeroBalanceCard`. Actuellement : navigation push standard. Le hero disparaît et réapparaît — aucune continuité visuelle.

→ **Matched geometry** : identifier le hero card avec `.matchedTransitionSource(id:in:)` / `.navigationTransition(.zoom(sourceID:in:))` (iOS 18+) pour que le hero "zoome" du dashboard vers le détail
→ C'est le genre de détail qui transforme une app "bien faite" en "premium"

---

### 4.4 Pull-to-refresh n'a pas de personnalité

**[Tous les écrans avec `.refreshable`]**

Le pull-to-refresh utilise le spinner système par défaut. C'est correct.

→ **Bonus** : un message contextuel post-refresh ("À jour !" pendant 1.5s via toast) confirmerait que l'action a eu un effet
→ Le message existe probablement déjà via le cache invalidation — vérifier qu'il y a un feedback visuel quand le refresh est terminé (au-delà du spinner qui disparaît)

---

### 4.5 Tab bar "+" button pourrait avoir plus d'impact

**[MainTabView / tabBarActionButton]**

Le "+" apparaît en Liquid Glass teinté vert sur le dashboard. C'est bien. Mais la transition d'apparition (`.transition(.scale.combined(with: .opacity))`) est la transition standard.

→ **Spring bounce** sur l'apparition : la capsule "+" qui rebondit en apparaissant donnerait un signal visuel plus clair "hé, tu peux ajouter une transaction"
→ **Pulsation subtile** la première fois qu'un budget existe et qu'aucune transaction n'est créée (onboarding hint)

---

### 4.6 Loading states pourraient être plus warm

**[CurrentMonthSkeletonView, BudgetDetailsSkeletonView, etc.]**

Les skeletons utilisent `Color.skeletonPlaceholder` (systemGray5) avec shimmer. C'est le pattern standard iOS.

→ **Teinter les skeletons** vers le warm : au lieu de systemGray5, utiliser un gris très légèrement chaud. Subtil mais cohérent avec le fond warm.
→ L'accessibilityLabel "Préparation de ton tableau de bord" est DA-compliant — bon travail.

---

### 4.7 Checked toggle animation — exploiter le moment

**[UncheckedForecastsCard / UncheckedItemRow]**

L'animation de pointage est déjà bien faite : spring animation, symbolEffect(.replace), haptic feedback, opacity reduction. C'est un des meilleurs patterns de l'app.

→ **Bonus :** quand le dernier item est pointé et que `UncheckedForecastsEmptyState` apparaît, une micro-animation (scale bounce de 0.95 → 1.0 sur le checkmark + "Tout est pointé") rendrait le moment plus gratifiant
→ C'est un "micro-win" — exactement le type de moment où Duolingo crée de l'addiction

---

## 5. Token Updates Required

### Nouveaux tokens couleur

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `Color.pulpeNeutralWarm` | `#F7F6F3` | `#141210` | Fond principal de toute l'app |
| `Color.pulpeCardSurface` | `#FFFFFF` | `#1E1C1A` | Surface des cartes |
| `Color.pulpeSheetSurface` | `#F5F3F0` | `#111111` | Fond des sheets (existant à adapter) |
| `Color.dashboardGradientComfortable` | `#D4EDDA` | `#0A1F0E` | Fond zone d'émotion état confortable |
| `Color.dashboardGradientTight` | `#FEF0D4` | `#1A1508` | Fond zone d'émotion état serré |
| `Color.dashboardGradientDeficit` | `#FDE2E2` | `#1A0A0A` | Fond zone d'émotion état déficit |
| `Color.skeletonWarm` | warm gray5 | warm dark gray | Skeletons |

### Tokens à mettre à jour

| Token existant | Ancien | Nouveau |
|----------------|--------|---------|
| `Color.appBackground` | `systemGroupedBackground` | `pulpeNeutralWarm` |
| `Color.sheetBackground` (light) | `systemGroupedBackground` | `pulpeSheetSurface` |
| `Color.surfaceContainerLowest` | `secondarySystemGroupedBackground` | `pulpeCardSurface` |

---

## 6. Implementation Notes

### Phase 1 — Changements exacts

| # | Fichier | Ancien | Nouveau | Raison |
|---|---------|--------|---------|--------|
| 1.1 | `Color+Pulpe.swift:70-71` | `Color(uiColor: .systemGroupedBackground)` | `Color(light: Color(hex: 0xF7F6F3), dark: Color(hex: 0x141210))` | DA.md §3.1 neutral warm |
| 1.2 | `Color+Pulpe.swift:75` | `Color(light: Color(uiColor: .systemGroupedBackground), dark: ...)` | `Color(light: Color(hex: 0xF5F3F0), dark: Color(hex: 0x111111))` | Sheet warm variant |
| 1.3 | `Color+Pulpe.swift:82` | `Color(uiColor: .secondarySystemGroupedBackground)` | `Color(light: .white, dark: Color(hex: 0x1E1C1A))` | Card surface warm |
| 1.4 | `Color+Pulpe.swift` | — | Ajouter 3 nouveaux tokens `dashboardGradient*` | Zone d'émotion |
| 1.5 | `CurrentMonthView.swift` `dashboardContent` | `ScrollView { VStack { ... } }` | Ajouter `ZStack { dashboardEmotionGradient; ScrollView { ... } }` | Zone d'émotion header |
| 1.6 | `Color+Pulpe.swift:345` | `Color(uiColor: .systemGray5)` | Warm gray tint | Skeleton warm |

### Phase 2 — Changements exacts

| # | Fichier | Changement | Raison |
|---|---------|------------|--------|
| 2.1 | `DashboardGreeting.swift:41` | headline font `stepTitle` → `brandTitle` ou rester `stepTitle` mais rendre le greeting plus discret (une seule ligne) | Résoudre la compétition visuelle greeting/hero |
| 2.2 | `AccountView.swift` | Ajouter un header de profil (initiale + email + badge membre) avant les sections | Personnalité Pulpe dans les settings |
| 2.3 | `BudgetListView+Subviews.swift` | Ajouter un point de couleur d'état sur chaque `BudgetMonthRow` | Visibilité de l'état sans entrer dans le détail |
| 2.4 | `DesignTokens.Shadow.card` | Supprimer ou appliquer uniformément. Recommandation : flat partout | Cohérence depth strategy |
| 2.5 | `CurrentMonthView.swift` section headers | Ajouter badge count aux headers (`À pointer (3)`) | Rythme visuel |

### Phase 3 — Changements exacts

| # | Fichier | Changement | Raison |
|---|---------|------------|--------|
| 3.1 | `HeroBalanceCard.swift` amount | Compteur animé au premier chargement | Moment de révélation |
| 3.2 | `SavingsSummaryCard.swift` completeView | `.symbolEffect(.bounce)` + haptic | Célébration micro-win |
| 3.3 | `MainTabView.swift` tabBarActionButton | Spring bounce + onboarding pulse | Signal visuel du CTA |
| 3.4 | `UncheckedForecastsEmptyState` | Scale bounce à l'apparition | Gratification de complétion |

---

## 7. Ce qui est déjà excellent (ne pas toucher)

- **Hero card gradient system** — les 3 états + decorative circles + specular highlight + pace indicator. C'est le meilleur élément de l'app.
- **Liquid Glass tab bar** — iOS 26 natif, bien implémenté avec GlassEffectContainer.
- **Hero glass modifier** — tint matching sur les pills/buttons du hero. Technique et beau.
- **Financial color system** — pas de rouge anxiogène, ambre pour les dépenses, bleu pour les revenus. DA-parfait.
- **Typography system** — Manrope pour brand, SF Pro pour corps. Exactement ce que DA demande.
- **Accessibility** — VoiceOver labels sur tout, reduceMotion checks, sensitiveAmount blur, shake-to-hide.
- **Staggered entrance** animations sur le dashboard.
- **Sensory feedback** cohérent (haptics sur toggle, warning sur delete, selection sur navigation).
- **Skeleton loading** sur tous les écrans avec minimum display time.
- **Microcopy** — DA-compliant, tutoiement, ton bienveillant, pas de jargon.
- **CheckedToggle animation** — spring + symbolEffect + opacity + strikethrough + haptic. Chef.

---

## 8. Priorisation Résumé

| Phase | Effort | Impact | Quand |
|-------|--------|--------|-------|
| **1.1 Fond warm** | 1h | Transforme l'ambiance de toute l'app | Immédiat |
| **1.2 Zone d'émotion** | 2-3h | Le dashboard passe de grille à expérience | Immédiat |
| **1.3 Onboarding wow** | 2h | Première impression transformée | Immédiat |
| **1.4 Card surfaces warm** | 30min | Cohérence de température | Immédiat |
| **2.x Refinements** | 1-2h chacun | Élévation progressive | Sprint suivant |
| **3.x Polish** | 30min-1h chacun | Différenciation premium | Quand le reste est stable |

---

**L'app est à un changement de couleur de fond d'être radicalement différente.** Phase 1.1 seule transforme l'ambiance. Les 4 items de Phase 1 ensemble créent une app qui a du caractère. Le reste est de l'affinage qui élève progressivement vers le premium.

*Chaque phase nécessite approbation explicite avant implémentation.*
