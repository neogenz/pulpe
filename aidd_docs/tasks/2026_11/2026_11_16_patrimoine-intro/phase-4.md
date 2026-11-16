---
status: done
---

# Instruction: Android : feuille d'explication et contrôles finaux

## Architecture projection

```txt
.
├── docs/
│   └── BUSINESS_RULES.md ✏️
└── android/
    └── src/
        ├── app/
        │   └── (main)/
        │       └── (tabs)/
        │           └── net-worth.tsx (modifié ; marque omise, le validateur du plan ne lit pas les dossiers Expo Router entre parenthèses)
        ├── core/
        │   └── i18n/
        │       └── catalogs/
        │           ├── fr.json ✏️
        │           ├── en.json ✏️
        │           ├── de.json ✏️
        │           └── it.json ✏️
        └── features/
            └── net-worth/
                ├── net-worth-intro-gate.ts ✅
                ├── net-worth-intro-gate.spec.ts ✅
                ├── net-worth-intro.ts ✅
                ├── net-worth-intro.spec.ts ✅
                └── components/
                    ├── net-worth-intro-sheet.tsx ✅
                    └── net-worth-intro-sheet.spec.tsx ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Supabase local lancé (`cd backend-nest && supabase start`, depuis le dépôt principal si un autre worktree l'utilise déjà) et backend `pnpm dev:backend` sur :3000 ; compte du seed, dont le patrimoine est vide (`seed.sql` ne crée aucun avoir) ; `JAVA_HOME` = JDK 17 et `ANDROID_HOME` posés ; `android/.env` copié de `.env.example` ; émulateur lancé puis `adb reverse tcp:3000 tcp:3000 && adb reverse tcp:54321 tcp:54321` ; `pnpm dev:android` ; MMKV vide ; flag forcé en remplaçant temporairement `useFeatureFlag(FEATURE_FLAGS.NET_WORTH)` par `true` dans `android/src/app/(main)/(tabs)/_layout.tsx:31` (en dev il n'y a pas de client PostHog), jamais commité | Onglet Patrimoine visible | system |
| Happy path | Ouvrir l'onglet | La feuille s'ouvre après chargement, étape 1 animée, `viewed` `source=auto` | system |
| Setup | Patrimoine rempli : à jouer après le scénario « patrimoine vide », qui se termine par l'ajout d'un compte via le formulaire, ce qui donne l'état rempli des scénarios suivants | Une ligne dans le patrimoine | system |
| Happy path | « Suivant » ×2 puis « Compris » | Fermeture, `completed` `action=close` ; revenir sur l'onglet ne la rouvre pas | system |
| Edge case | Patrimoine vide, dernière étape | « Ajouter mon premier compte » ferme la feuille puis ouvre `AssetFormSheet` | system |
| Edge case | Retour système, croix ou tap sur le fond à l'étape 2 | `skipped` `step=1`, clé à vu | system |
| Edge case | « ? » dans la barre | Feuille à l'étape 1, `source=help` | system |
| Edge case | Animations système désactivées | `useReducedMotion` coupe les déplacements | system |
| Edge case | Police système à 200 % | Le texte passe à la ligne, la feuille défile, le bouton principal reste atteignable | system |
| Edge case | TalkBack | La scène est lue comme une phrase par étape | system |
| Teardown | Effacer la clé MMKV, supprimer le compte ajouté, retirer le forçage du flag | État de départ, `git diff` sans le forçage | system |

## Wireframe

```txt
┌─────────────────────────────────────┐
│ (1) Mon patrimoine         [?] [+]* │
├─────────────────────────────────────┤
│        page actuelle inchangée       │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ (2) Titre de l'étape            [×] │
├─────────────────────────────────────┤
│ (3) Scène animée                     │
│  ┌───────────────────────────────┐  │
│  │ Compte courant      3 200     │  │
│  │ Épargne            12 000     │  │
│  │ Placements          8 000     │  │
│  │ Voiture             9 000     │  │
│  │ ─────────────────────────     │  │
│  │ Tout ce que j'ai   32 200     │  │
│  └───────────────────────────────┘  │
│ (4) Texte court, 2 lignes max        │
│ (5)          ● ○ ○                   │
│ (6) [        Suivant          ]      │
└─────────────────────────────────────┘
```

1. En-tête de la page : bouton « ? » ajouté avant « Ajouter », visible sur l'état vide et l'état rempli (pas en chargement ni en erreur). `*` : « Ajouter » reste masqué sur l'état vide, comme aujourd'hui.
2. En-tête de `FormModal` : titre de l'étape et croix de fermeture, présente à toutes les étapes ; elle tient le rôle de « Plus tard ».
3. Scène (carte marquée « Exemple ») : étape 1, quatre éléments éparpillés (Compte courant, Épargne, Placements, Voiture, chacun avec son icône) glissent et se rangent dans une seule carte « Tout ce que j'ai », le total monte jusqu'à 32 200 (défilement sur iOS et Android, fondu sur le web) ; étape 2, « Ce que j'ai 32 200 » et « Ce que je dois · Crédit −6 000 », la dette grignote la barre en ambre, puis un bloc vert foncé « Fortune nette 26 200 » (libellé `netWorth.net`) apparaît en rebond ; étape 3, la ligne « Épargne · Mis à jour il y a 2 mois · 12 000 » reçoit un appui sur le crayon, passe à 12 500 et « Mis à jour aujourd'hui », la fortune nette passe à 26 700, puis une mention en pointillé « 500 mis de côté dans ton budget → je te propose +500 ici. » apparaît.
4. Texte de l'étape (copie ci-dessous), le titre étant dans l'en-tête.
5. Indicateur d'étape, 3 points.
6. Bouton principal, dans le `footer` épinglé de `FormModal` : « Suivant » aux étapes 1 et 2 ; à l'étape 3, « Ajouter mon premier compte » si le patrimoine est vide, sinon « Compris ».

Copie (FR, validée par `slopcheck-fr` : 0 BLOCK, 0 WARN ; à traduire en en, de, it) :
- Étape 1 : « Tout ton argent, au même endroit » / « Comptes, épargne, placements, mais aussi ta voiture ou ton appart : ajoute tout ce que tu possèdes. »
- Étape 2 : « Ta situation en un coup d'œil » / « J'enlève ce que tu dois, crédit ou leasing. Il reste un chiffre : ta fortune nette, l'état réel de tes finances. »
- Étape 3 : « Garde-la à jour en un geste » / « Une valeur change ? Tu la mets à jour. Et quand tu mets de l'argent de côté dans ton budget, je te propose de l'ajouter ici. »

## Tasks to do

### `1)` Gate « déjà vue »

> Copie de `goals-intro-gate.ts`.

1. `hasSeenNetWorthIntro()` / `markNetWorthIntroSeen()` sur MMKV `pulpe-net-worth`, clé `pulpe-net-worth-intro-seen`.
2. Spec avec le mock MMKV existant.

### `2)` Contenu pur

> Toute la logique de l'intro, testable sans rendu.

1. `net-worth-intro.ts` : `INTRO_STEPS`, `INTRO_SAMPLE` (mêmes chiffres que le web et iOS), `introTotals(sample)` (« tout ce que j'ai », fortune nette avant et après), `primaryAction(step, isEmpty)` → `'next' | 'done' | 'add'`, `countAt(from, to, progress)` (interpolation avec easing du compteur).
2. `net-worth-intro.spec.ts` : 32 200 / 26 200 / 26 700, action par étape et par état vide, `countAt` à 0, 0,5 et 1.

### `3)` Feuille à 3 étapes

> `FormModal` (`core/ui/sheet.tsx`), comme `WhatsNewSheet` ; la vue lit le contenu et n'additionne rien.

1. `NetWorthIntroSheet({ source, isEmpty, currency, onFinish })` dans `FormModal` : `title` = titre de l'étape, `onDismiss` = sortie `skipped`, `footer` = points + bouton principal ; scène avec un sous-composant par étape, remonté par une `key` d'étape pour rejouer ses animations. Reanimated sans `entering` : `useSharedValue` + `useAnimatedStyle` + `withDelay(withTiming|withSpring)` sur opacité, translation et `scaleX` (barre de dette) ; compteur via un hook `useCountUp` (`requestAnimationFrame` + `countAt`, une vingtaine de lignes) rendu par `Amount` ; `useReducedMotion` → valeurs finales directes ; `Card` et `Amount` existants ; scène en `accessible` avec un `accessibilityLabel` par étape.
2. Libellés : réutiliser `netWorth.have`, `netWorth.owe`, `netWorth.net`, `common.close` ; ajouter `netWorth.intro.*` (aide, plus tard, suivant, compris, ajouter mon premier compte, exemple, titres et textes des 3 étapes, libellés d'échantillon, mises à jour, mention du budget).
3. Analytics via `captureEvent(ANALYTICS_EVENTS.NET_WORTH_INTRO_*)`, un seul événement de fin.
4. Clés `netWorth.intro.*` dans fr, en, de, it.
5. Spec : étapes, libellé du CTA, événement unique ; mocker `react-native-reanimated` avec le mock officiel installé (`jest.mock("react-native-reanimated", () => ({ ...jest.requireActual("react-native-reanimated/mock"), useReducedMotion: () => true }))`), Reduce Motion forcé pour que les montants finaux s'affichent sans attendre ; si ce mock ne charge pas sous Jest 29, repli sur un mock manuel comme `budget-detail-screen.spec.tsx:60` complété des hooks utilisés.

### `4)` Brancher dans l'onglet

> Ouverture auto une fois, puis via « ? ».

1. État `introSource`, ouvert quand `netWorth` est chargé sans erreur et que la gate le permet ; marquer vu à la fermeture.
2. `Appbar.Action` `help-circle-outline` dans le `trailing` de `TabHeader`, avant « + », visible aussi à l'état vide.
3. Résultat « add » : `FormModal` n'a pas de rappel après fermeture (`core/ui/sheet.tsx:124-133`, un `Modal` RN), donc ne jamais monter les deux feuilles ensemble : fermer l'intro et ouvrir `AssetFormSheet` dans le même gestionnaire, la feuille de création ne se rendant que si l'intro est fermée ; vérifier sur appareil qu'elle apparaît bien, sinon l'ouvrir au tour suivant.

### `5)` Documentation et contrôles finaux

> Le contrat et la règle métier restent vrais.

1. `docs/BUSINESS_RULES.md` § Patrimoine : une ligne, « Une explication en 3 étapes s'ouvre à la première visite de la page, une fois par appareil, et se rouvre via « ? ». »
2. Depuis la racine : `pnpm quality`, `pnpm test:lexicon`, `pnpm test`.
3. `cd frontend && pnpm exec ng build` (seul contrôle des templates stricts).
4. iOS : `xcodebuild test -scheme PulpeLocal -configuration Local` sur le simulateur « Pulpe Tests ».

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `net-worth-intro-gate.spec.ts` passe |
| 2 | `net-worth-intro.spec.ts` passe : 32 200 / 26 200 / 26 700 et la bonne action par étape |
| 3 | `net-worth-intro-sheet.spec.tsx` passe : étapes, CTA vide ou rempli, un seul événement de fin |
| 4 | Sur appareil : première visite → feuille, retour sur l'onglet → rien, « ? » → feuille, CTA vide → formulaire |
| 5 | `pnpm quality`, `pnpm test:lexicon`, `pnpm test`, `ng build` et la suite iOS passent |
