---
objective: "À la première visite de Mon patrimoine, sur iOS, web et Android, une dialog animée en 3 étapes explique que le patrimoine réunit tous mes comptes et mes biens pour donner l'état réel de mes finances, puis reste rouvrable via un bouton « ? »."
status: implemented
---

# Plan: Dialog d'explication de Mon patrimoine

Source: demande de Maxime du 2026-11-16 (« mes early adopters ne comprennent rien à l'écran Mon patrimoine »), grill du même jour (histoire en 3 étapes, maquette native animée plutôt que Lottie, ouverture automatique une fois puis bouton « ? », CTA selon l'état), et maquettes : https://claude.ai/artifact/66yJBExz6bmf3gdJMDFE1f

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1   | Contrat analytics partagé | [`phase-1.md`](./phase-1.md) | none |
| 2   | iOS : feuille d'explication | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Web : dialog d'explication | [`phase-3.md`](./phase-3.md) | 1 |
| 4   | Android : feuille d'explication et contrôles finaux | [`phase-4.md`](./phase-4.md) | 1 |

## External sources

| URL | What it settled |
| --- | --------------- |
| none | Tout repose sur des patterns déjà présents dans le dépôt (gates de l'intro Objectifs sur iOS et Android, `MatDialog`, `FormModal` ; les événements d'intro n'ont un précédent que sur iOS, `savings_goals_intro_*`). |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| Runtime | Pas de dépendance ajoutée, pas d'appel API nouveau : la dialog lit l'état déjà chargé (`store.netWorth` iOS, `store.isEmpty()` web, `useNetWorth` Android) et hérite du flag `net_worth` (`shared/src/feature-flags.ts:42`). Prérequis de vérification locale, observés : web, flag via `localStorage` `pulpe-dev-feature-flags` (`posthog.ts:275-295`) ; iOS, `POSTHOG_API_KEY` est vide en configuration Local (`ios/Config/Local.xcconfig:7`), PostHog n'est donc pas initialisé et la valeur `UserDefaults` `pulpe.feature_flags.net_worth` n'est jamais réécrite (`FeatureFlagsStore.swift:29-35`) ; Android, aucun client PostHog en dev, donc le flag est toujours faux (`core/observability/feature-flags.ts:10-14`) : la vérification passe par un forçage local jamais commité de `android/src/app/(main)/(tabs)/_layout.tsx:31`. Les trois plateformes ont besoin du backend local, et le seed n'a aucun avoir : l'état rempli se crée pendant le test via le formulaire. | 2, 3, 4 |
| Regression | Faible, observé : seuls l'en-tête (bouton « ? ») et une ouverture au chargement changent, le contenu de la page ne bouge pas. Web : `net-worth-page.spec.ts` couvre la page, mais mocke `dialogs = { openCreate }` sans `StorageService` (ligne 118) et doit être étendu. iOS (`MainTabViewLayoutTests` ne teste que la présence de l'onglet) et Android (`net-worth-tab.spec.ts` ne teste que la visibilité de l'onglet) n'ont aucun test d'écran : la non-régression y repose sur la vérification manuelle de chaque phase. Pas de phase filet : écrire des tests d'écran iOS/Android pour deux lignes d'en-tête coûterait plus que le risque. Le test de parité `ios/PulpeTests/Core/Analytics/AnalyticsServiceTests.swift:35-71` casse si le catalogue iOS change sans lui. | 1, 2, 3, 4 |
| Architecture | Aucun changement de structure : chaque plateforme ajoute un composant dans sa feature `net-worth`, à côté des feuilles existantes, et une clé « déjà vue » sur le modèle des gates Objectifs. | 2, 3, 4 |
| Documentation | `docs/BUSINESS_RULES.md` § Patrimoine : ajouter une ligne sur l'explication montrée une fois par appareil et rouvrable via « ? ». Le JSDoc d'`ANALYTICS_EVENTS` porte le contrat des événements. | 1, 4 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `.claude/rules/05-workflows-and-processes/posthog-events.md` | Trois nouveaux événements multiplateformes : JSDoc dans `ANALYTICS_EVENTS`, miroir `AnalyticsEvent.swift`, test d'émission. Aucun montant dans les propriétés. |
| Vocabulaire CLAUDE.md + `pnpm test:lexicon` | Le mot « transaction » ne s'affiche jamais ; « Pointé » pour le geste. |
| `slopcheck-fr` (github.com/tns-research/slopcheck-fr) sur la copie FR | Copie passée le 2026-11-16 : 0 BLOCK, 0 WARN en mode par défaut ; 1 WARN « staccato » en `--strict`, dû aux libellés concaténés pour l'analyse. Toute retouche de copie repasse dans `uvx --from git+https://github.com/tns-research/slopcheck-fr slopcheck`. |
| Mémoire `feedback_customize_per_country_not_neutralize` | Les montants d'exemple suivent la devise de l'utilisateur ; aucun terme propre à un pays (pas de « 3e pilier », pas de « Livret ») : libellés d'exemple neutres (Compte courant, Épargne, Placements, Voiture, Crédit), traduits dans les 4 langues. |
| Mémoire `feedback_pulpe_solo_voice_je_not_nous` | Pulpe parle en « je » (« je te propose »), jamais en « nous ». |
| `ios/DESIGN.md` : `.sheet` + `.standardSheetPresentation()` | Une aide qu'on rouvre via « ? » est une feuille, pas un `fullScreenCover` (réservé aux parcours immersifs). |
| Glass Restraint Rule (mémoire `project_ios_feature_education_patterns`) | App authentifiée : animations d'entrée et de compteur, pas de lueur de marque. |
| Reduce Motion / `prefers-reduced-motion` | Chaque animation garde un fondu court au lieu d'un mouvement. |
| CLAUDE.md : au-delà de ~300 LOC net, s'arrêter | Une phase par plateforme, chacune sous ce seuil et livrable seule. |

## Decisions

| Decision | Why |
| -------- | --- |
| Sur chaque plateforme, un modèle pur (étapes, échantillon, totaux calculés à partir de l'échantillon, action du bouton principal selon l'étape et l'état vide) et une vue qui ne fait qu'afficher et animer | Toute la logique se teste sans rendu, et les chiffres affichés ne peuvent pas se contredire. Le modèle n'est pas partagé via `shared/` : c'est du contenu d'interface d'une trentaine de lignes, et le précédent de l'intro Objectifs garde aussi son échantillon par plateforme. |
| Android : la feuille garde le cadre de `FormModal` (titre = titre de l'étape, croix de fermeture à toutes les étapes, bouton principal dans `footer`) au lieu d'un « Plus tard » | `FormModal` impose `title` et une croix (`core/ui/sheet.tsx:149-166`) ; la croix joue le rôle de « Plus tard », la fermer avant le bouton principal compte comme `skipped`, comme le glissement sur iOS ou Échap sur le web. |
| Android : animations par `useSharedValue` + `useAnimatedStyle` (opacité, translation, `scaleX`), jamais `entering` ; compteur par un petit hook `requestAnimationFrame` | Une vue avec `entering` sort du flux flex et prend tout le conteneur après une vraie navigation (déjà mesuré dans l'onboarding) ; les transformations ne touchent pas la mise en page. Pas de précédent `withTiming` dans le dépôt : l'API est celle de Reanimated 4.5.1 installé (`lib/typescript/index.d.ts`). |
| Libellés : réutiliser les clés existantes du patrimoine (« Ce que j'ai », « Ce que je dois », et le libellé du héros de chaque plateforme pour la fortune nette) ; tout le reste sous `netWorth.intro.*`, chaînes françaises comme clés sur iOS | Une seule source par libellé à l'écran ; les actions de l'intro restent groupées et supprimables ensemble. |
| Maquette native animée (vraies cartes, chiffres d'exemple), pas de Lottie | Lottie exige un JSON conçu hors du dépôt, ne suit ni la devise ni la langue, et diverge de l'écran réel. Choisi au grill. |
| « Déjà vue » stockée sur l'appareil (`@AppStorage`, `StorageService` scope user, MMKV), pas en base | Même modèle que l'intro Objectifs. Coût accepté : un nouvel appareil, ou une déconnexion sur le web, la remontre une fois ; le bouton « ? » rend ce coût négligeable. |
| Le patrimoine se présente comme une vue d'ensemble : tous mes comptes et mes biens au même endroit, pour connaître l'état réel de mes finances | Retour de Maxime du 2026-11-16 sur la v1 des maquettes : elle expliquait un mécanisme (avoirs − dettes, suggestion du budget) au lieu du pourquoi. Étape 1 = tout au même endroit, étape 2 = un chiffre, étape 3 = le garder à jour ; le lien avec le budget n'est plus qu'une mention, la suggestion se découvre en contexte. |
| Mêmes chiffres d'exemple partout : Compte courant 3'200 + Épargne 12'000 + Placements 8'000 + Voiture 9'000 = 32'200 ; Crédit 6'000 → fortune nette 26'200 ; Épargne mise à jour 12'000 → 12'500 → 26'700 | Les trois plateformes racontent la même histoire, et les captures restent comparables. La voiture montre que le patrimoine dépasse les comptes bancaires. |
