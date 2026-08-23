# Design Audit — Pulpe Android (Expo / React Native)

**Date:** 2026-08-14
**Scope:** `android/src` entier — risque « cheap », conformité Android/Material 3, cohérence design system
**Reference:** PRODUCT.md, DESIGN.md, android/DESIGN.md, Practical UI, Material 3
**Method:** lecture statique (`core/ui/` entier + 7 surfaces denses) + audit live sur émulateur (11 écrans capturés, compte seed demo)

---

## 1. Overall Assessment

**L'app ne fait pas cheap à l'œil — elle fait cheap au doigt.** La base est d'une rigueur rare : 0 couleur hex, 0 `fontSize`, 0 `fontWeight` en dur dans 200+ fichiers, sémantique financière tenue partout, dark mode réellement branché, edge-to-edge testé par un spec dédié. Mais la couche sensorielle Android est absente : **zéro ripple, zéro animation, tab bar restée sur son gabarit UIKit, cibles tactiles à 44dp (plancher iOS) là où Material exige 48**. L'app se comporte en Android et ne se *sent* pas Android. S'y ajoutent trois échecs de contraste AA mesurés, une hiérarchie de gravité inversée (la suppression de compte porte l'ambre, une action réversible porte le vrai rouge), et un bug d'état vécu en live : l'écran d'erreur du mois dont le « Réessayer » ne peut jamais réussir.

---

## 2. Phase 1 — Critical

### C1. Réessayer de l'accueil : bouton qui ne peut pas réussir *(vécu en live, preuve backend)*

**[Home/error state]** : quand la query settings échoue (backend down 30 s au boot), `resolveStatus` la traite comme fatale (`current-month-queries.ts:96`) mais `refresh` = `invalidateBudgetData` n'invalide que `budgetKeys.all` (`budget-queries.ts:42-44`) → les deux queries budget refetchent et réussissent (vérifié : 304 dans le log backend), `settings.isError` reste vrai, l'écran d'erreur est permanent jusqu'au force-kill. → `refresh` doit invalider aussi `userSettingsKeys.all`. → Une panne transitoire de 30 s au boot condamne la session entière ; le message « Vérifie ta connexion, puis réessaie » ment deux fois.

### C2. Aucun ripple sur les surfaces tapées

**[Toutes listes/cartes]** : 11 `Pressable` portent les surfaces principales, une seule (pin pad) donne un retour visuel ; zéro `android_ripple`, zéro `TouchableRipple` dans `src/`. → `android_ripple={{ color: <onSurface à TINT_ALPHA.surface> }}` sur chaque `Pressable` non borderless, ou `TouchableRipple` de Paper. → Le ripple est l'accusé de réception attendu sur Android ; son absence est ce qui fait lire l'app comme du web.

### C3. Tab bar sur le gabarit UIKit

**[(tabs)/_layout.tsx:18-24]** : pas de `tabBarVariant`, or le défaut Expo Router est `'uikit'` (hauteur 49, pas de pilule active — visible sur les captures). → `tabBarVariant: "material"`. → Une ligne fait passer le chrome le plus visible de l'app au gabarit MD3 (80dp, indicateur actif).

### C4. Cibles tactiles sous le plancher Material

**[PointCircle]** : `TAP_TARGET = 44` + `hitSlop={0}` (`point-circle.tsx:8-10,46`), sous un commentaire qui affirme à tort que 44 est « the Android and Apple floor alike » — le plancher Material est 48dp. C'est le contrôle central de l'app. → `TOUCH_TARGET = 48` (token), retirer `hitSlop={0}`, corriger le commentaire.
**[IconButton de ligne]** : `ROW_ACTION_ICON_SIZE = 20` + `margin: 0` = 36dp effectifs sur 6 boutons de suppression (`settings/tags.tsx:139,146`, `template-lines.tsx:126,133`, `onboarding/transaction-list.tsx:47,54`). → garder l'icône 20, rendre la cible 48 (`hitSlop` ou conteneur).
**[home-hero-card.tsx:204]** : `verdict: { minHeight: 44 }` → 48.

### C5. Gravité destructive inversée

**[settings/security.tsx:176,267 + ZONE DE DANGER :159,164]** : « Supprimer mon compte » (« action irréversible ») peint `theme.colors.error` = ambre `#D4760A`. Pendant ce temps `FINANCIAL_COLORS.destructive` (`#C62828`) colore « Retirer des mois futurs » (`goal-generation-stop-sheet.tsx:121`), action refaisable. → swap : sécurité → `destructive`, stop-sheet → `error`. → `android/DESIGN.md:41-44` protège le rouge des accès accidentels mais rien n'empêche la suppression de compte de le rater ; aujourd'hui l'ambre fait cinq métiers et ne signale plus rien.

### C6. Trois échecs de contraste AA mesurés

**[budget-line-row / transaction-row]** : `POINTED_OPACITY = 0.55` sur la ligne entière → nom 3.86:1, montant dépense 2.25:1, revenu 2.55:1, métadonnées 2.07:1 (sur `surface`). → retirer l'opacité globale ; le `line-through` existe déjà et dit « fait » ; si un recul reste voulu, `onSurfaceVariant` (8.35:1). → Une ligne pointée est ce qu'on relit en fin de mois, pas du décor.
**[budget-line-row et al.]** : `theme.colors.outline` (4.49:1) utilisé comme couleur de **texte** (`labelSmall` 11px : « Lissé », tags, suffixe, report du hero). → `onSurfaceVariant`. `outline` est un rôle de trait (contrat 3:1).
**[budget-detail-hero.tsx:192]** : pastille dépenses `#B35800` sur tint 12% = 3.85:1. → assombrir comme le précédent `overBudget #905800` (méthode déjà posée dans `theme.ts:108-109`), ou tint 8%.

### C7. Chrome qui se chevauche au scroll *(vu en live)*

**[budget/[id]]** : au scroll, le contrôle segmenté « À pointer/Pointé/Tout » passe sous la rangée sticky de chips de mois sans fond opaque → bande de texte tronqué en permanence (captures 13/14). Même classe que les fix récents « stop drawing over its own chrome » de l'onboarding. → fond opaque (`background`) + élévation sur la rangée sticky, ou rendre le segmenté sticky avec elle.
**[home, fin de liste]** : le FAB « Ajouter » recouvre le bouton « Préparer le mois suivant » (capture 17) et, en haut de page, le ✕ du tooltip Pointage. → `FAB_CLEARANCE` à hauteur réelle du FAB étendu + marge, et re-vérifier chaque écran à FAB.

### C8. Listes non virtualisées

**[budgets.tsx, budget/[id].tsx, month-pager]** : zéro `FlatList`/`SectionList` ; tous les `.map()` dans `ScrollView`, y compris les listes qui croissent sans borne (24+ mois, centaines de transactions à deux ans d'usage). → `FlatList` au minimum sur budgets + transactions (RefreshControl se transpose). → Blocage de frame à l'ouverture sur milieu de gamme, invisible aujourd'hui, garanti demain.

---

## 3. Phase 2 — Refinement

### R1. La « sheet » n'est pas une bottom sheet

**[core/ui/sheet.tsx → 17 fichiers `*-sheet.tsx`]** : c'est un `Modal` Paper à marges latérales et 4 coins arrondis — pas de poignée, pas de glisser-pour-fermer, pas de snap points. `@gorhom/bottom-sheet` est installé et **jamais importé** (dep morte), `GestureHandlerRootView` déjà monté. → soit brancher gorhom (vraie bottom sheet MD3), soit renommer `Dialog` et assumer. Décision à trancher, la première est recommandée : un formulaire à 6 champs + footer épinglé est exactement ce que M3 confie à une bottom sheet.

### R2. Zéro motion — Reanimated payé mais muet

**[toute l'app]** : aucun `entering`/`layout`/`withTiming` ; aucun token de durée/courbe dans `theme.ts` ; le pager de mois se recale `animated: false`. → commencer par `Animated.View layout={LinearTransition}` sur les listes qui gagnent/perdent des lignes (pointage, ajout), + tokens `DURATION = { short: 200, medium: 300 }`. Attention au précédent : `entering` a déjà mordu (position absolue — cf. mémoire projet), préférer `layout` aux `entering` sur les écrans à chrome.

### R3. Back prédictif sacrifié pour deux écrans

**[app.json:15]** : `predictiveBackGestureEnabled: false` à cause de deux `BackHandler` legacy (`onboarding/index.tsx:53`, `budget/[id].tsx:131`) — deux usages légitimes, mauvaise API. → migrer vers `onBackInvokedCallback`, repasser le flag à `true`. → L'animation de retour est la signature d'Android 14+.

### R4. Un composant `Amount` manquant — 7 tailles pour le même objet

**[transversal]** : les montants de ligne prennent `titleMedium`/`bodyLarge`/`bodyMedium`/`bodySmall`/`labelLarge`/`labelMedium`/`labelSmall` selon l'écran (inventaire complet en annexe du rapport design system). → `<Amount size="hero"|"row"|"meta">` dans `core/ui/` qui possède taille, graisse, `TABULAR_DIGITS`, accent financier. `titleMedium` = `row` (choix majoritaire).

### R5. Trois grammaires de hero, trois vocabulaires de pastille, deux rayons de carte

- **Heros** : eyebrow `labelMedium` casse normale (home) vs `labelLarge` MAJUSCULES+tracking (détail) vs `bodyMedium` (onboarding) ; symbole devise à trois emplacements. → une grammaire (aligner sur détail/onboarding `displaySmall`).
- **Chips** : `FilterChip` (atome) vs `Chip` Paper brut (`currency-picker.tsx:30`, `suggestion-grid.tsx:41`) vs `Pill` main levée (`budget-detail-hero.tsx:178-202`) — `DESIGN.md:153` interdit littéralement le troisième cas. → tout passe par l'atome ; `Pill` devient un composant nommé de `core/ui/`.
- **Cartes** : `<Card mode="contained">` Paper rend `3 × roundness` = 24 (10+ écrans réglages/objectifs/modèles) vs cartes maison à `RADIUS.card` = 18. → composant carte unique qui impose 18. → L'écart de 6pt est exactement la sensation « deux applications collées ».

### R6. Doctrine émotionnelle non tranchée sur l'onboarding

**[budget-preview-step.tsx:62]** : la carte se teinte vert/ambre/corail selon l'émotion, alors que `home-hero-card.tsx:47-49` documente le choix inverse (mint constant, le verdict est dans l'encre) et `DESIGN.md:84` réserve le corail au dashboard hero. → adopter le mint constant. → Le corail y est la première surface rouge-adjacente qu'un nouvel utilisateur rencontre, au moment où PRODUCT.md promet le soulagement.

### R7. Gutters divergents entre groupes de routes

**[transversal]** : 16 (app) / 24 (onboarding entier, auth) / 8 (header onboarding → flèche 10pt à gauche de son propre titre). `SCREEN_PADDING` n'est importé que par 3 fichiers. → tout sur `SCREEN_PADDING` ; header à `SCREEN_PADDING - ICON_BUTTON_INSET`.

### R8. États vides = états d'erreur

**[core/ui/placeholder-screen.tsx]** : sert **tous** les vides et **toutes** les erreurs — titre + texte + bouton, sans icône ni différenciation (vécu en live : l'erreur du mois ressemble trait pour trait au « pas encore de budget »). → slot `icon` (`calendar-blank-outline` vide, `cloud-off-outline` réseau). → Un état vide indiscernable d'une erreur laisse l'utilisateur sans savoir s'il doit agir ou réessayer.

### R9. Objectifs sans progression visible *(vu en live)*

**[goals.tsx cartes]** : la carte d'objectif montre statut + échéance + **cible** (« 3'000 CHF ») mais ni montant épargné ni barre de progression — l'écran ne répond pas à « où j'en suis ? », la question que pose un objectif. iOS la montre. → barre + « X / Y CHF » sur la carte (la donnée est dans le payload).

### R10. Gestes : ni swipe ni long-press

**[lignes de transaction]** : supprimer impose d'ouvrir le détail (2 navigations). Android n'a pas le swipe iOS mais a le long-press ; contre-exemple qui marche déjà : actions inline de `settings/tags.tsx:137-152`. → `onLongPress` → `Menu` Paper ancré, ou actions inline.

### R11. Divers conformité

- **Haptics** : 41 appels, taxonomie iOS (`Soft`/`Rigid`) et deux idiomes pour la même bascule. → 3 usages : `selectionAsync` (bascule), `impactAsync(Medium)` (engagement), `notificationAsync` (fin d'opération réseau).
- **Capitales sans tracking** : en-têtes réglages (`labelLarge` sans `letterSpacing`) → `UPPERCASE_TRACKING = 2` + bold, ou `titleSmall` casse normale (Practical UI typography).
- **[budget-preview-step.tsx:84-103]** : les 3 flux écrits deux fois (FlowBars + 3 boutons « Modifier… ») → lignes pressables, boutons supprimés.
- **[settings/index.tsx]** : seul écran à données sans `RefreshControl`.
- **Header accueil non sticky** *(vécu)* : l'icône compte disparaît au scroll — l'accès aux réglages exige de remonter. → à trancher (App Bar ou statu quo assumé).

---

## 4. Phase 3 — Polish

- **[home-hero-card.tsx:103,131]** : chevrons typographiques `›` dans le texte → `chevron-right` comme les 4 autres emplacements du même écran.
- **[home.tsx:308]** : `dailyBudget paddingHorizontal: SPACING.xs` → retirer (compteur 4pt hors alignement).
- **[home.tsx:140]** : `IconButton` compte déborde le gutter de 6pt → `margin: 0` + `hitSlop` (piège déjà documenté dans `theme.ts:183-189`).
- **[theme.ts:133-144]** : `HOME_HERO_COLORS.*.surfaceTop`/`.overlay` morts → supprimer ou poser le dégradé prévu.
- **`RECURRENCE_LABELS` copié 6×** (drift déjà commenté dans `budget-line-sheet.tsx:86`) → un export `core/`.
- **[app.json:44-52]** : une seule `image` de splash → `dark.image` si le logo perd du contraste sur `#141210`.
- **Deps mortes** : `@gorhom/bottom-sheet` (selon décision R1) ; `react-native-reanimated` cesse d'être morte dès R2.
- **Doctrine FAB** *(vu en live)* : étendu « + Ajouter » (accueil) vs rond « + » (3 onglets) vs speed-dial (détail) — MD3 tolère, mais fixer l'intention (étendu sur les racines, rond sur les détails, par ex.).
- **LogBox au boot** *(vécu)* : « Can't perform a React state update on a component that hasn't mounted yet » — side-effect en render quelque part au bootstrap (les `useEffect` de `_layout.tsx` sont propres ; stack LogBox à lire au prochain cold start).
- **[détail hero]** : « +0 » sans décimales au-dessus de lignes « 334.00 CHF » — vérifier la règle iOS (2 décimales obligatoires en Budget Detail) et aligner.

---

## 5. Token Updates Required

À ajouter dans `android/src/core/ui/theme.ts` avant d'implémenter (proposés par l'audit design system, valeurs relevées dans le code) :

```ts
export const ICON_SIZE = { xs: 12, sm: 16, md: 20, lg: 24, xl: 32 } as const; // remplace les 15 tailles sauvages
export const EMPHASIS = { dimmed: 0.72, disabled: 0.5 } as const;             // remplace 0.4/0.5/0.55/0.72 épars
export const TINT_ALPHA = { subtle: "14", surface: "1F" } as const;           // remplace "26"/"1F" en dur
export const TOUCH_TARGET = 48;                                               // remplace le 44 venu d'iOS
export const ICON_BUTTON_INSET = 6;                                           // marge Paper à annuler pour tenir le gutter
export const UPPERCASE_TRACKING = 2;                                          // tracking des libellés en capitales
export const DURATION = { short: 200, medium: 300 } as const;                 // durées Material (R2)
```

Plus deux composants et un hook (là où le système fuit) : `<Amount>`, `<Card>` unique (impose `RADIUS.card`), `useFinancialColors()` (supprime 22 répétitions de `useColorScheme() === "dark" ? …`).

## 6. Implementation Notes

Portées par le plan AIDD `aidd_docs/tasks/2026_08/2026_08_14_android-hardening/` : Phase 1 → C1 ; Phase 3 → C2-C8 ; Phase 7 → R1-R11 ; Phase 8 → Polish. Chaque valeur ci-dessus référence un token existant ou de la section 5 — aucune valeur libre.

**Ce qui est déjà juste (à ne pas casser)** : edge-to-edge testé (`screen-insets.spec.ts`), clavier (`keyboardShouldPersistTaps`, `decimal-pad`, choix documenté sans `KeyboardAvoidingView`), plugin `with-brand-colors.js` (date picker natif aux couleurs de la marque), `filter-chip.tsx` (correction d'un vrai défaut Paper), microcopy (vocabulaire produit exact, tutoiement, états qui guident), 0 valeur en dur, dark mode branché de bout en bout.
