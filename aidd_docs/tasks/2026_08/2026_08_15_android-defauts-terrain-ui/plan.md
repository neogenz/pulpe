---
objective: "Sur Android, quitter l'onboarding laisse toujours une route vers la création de compte, le hero d'un objectif reste dans sa carte quel que soit le montant, la liste des budgets s'ouvre sur le mois vécu, et un toast se lit en thème sombre sans passer sous le bouton +."
status: in-progress
---

# Plan: Android — quatre défauts remontés du terrain

## Overview

| Field      | Value                                                                                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Goal**   | Quatre défauts constatés sur appareil le 2026-08-15, chacun corrigé là où tous les appelants passent plutôt qu'à l'écran qui l'a révélé                  |
| **Source** | Retours oraux de Maxime pendant la session du 2026-08-15 + photo de l'écran objectif « Maison » (`IMG_5244.DNG`), branche `claude/android-expo-port-5387b2` |

## Phases

| #   | Phase                                                     | File                         |
| --- | --------------------------------------------------------- | ---------------------------- |
| 1   | La sortie d'onboarding repasse par la décision d'atterrissage | [`phase-1.md`](./phase-1.md) |
| 2   | Le hero d'un objectif tient dans sa carte                  | [`phase-2.md`](./phase-2.md) |
| 3   | La liste des budgets s'ouvre sur le mois vécu              | [`phase-3.md`](./phase-3.md) |
| 4   | Un seul toast, lisible en sombre et au-dessus du FAB       | [`phase-4.md`](./phase-4.md) |

## Resources

| Source                                                                             | Verified                                                                                                                                       |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `node_modules/react-native/ReactAndroid/.../text/ReactTextView.java:190,446`        | Android implémente bien `adjustsFontSizeToFit` (il rétrécit jusqu'à `getWidth()`), et il **désactive l'ellipse** quand il est actif — d'où le débordement plutôt qu'un `…` |
| `node_modules/react-native/ReactAndroid/.../text/TextLayoutManager.kt:962`          | Sans `minimumFontScale`, le plancher Android est 4 dp : un hero peut rétrécir jusqu'à l'illisible                                              |
| `node_modules/react-native/Libraries/Lists/SectionList.js:184`                      | « cannot scroll to locations outside the render window without specifying the `getItemLayout` prop » — d'où l'ancrage par `initialNumToRender`  |
| `node_modules/react-native-paper/.../Snackbar.tsx` (rôles MD3)                       | Le fond par défaut d'un `Snackbar` est `inverseSurface` ; en sombre notre palette le pose à `#E5E2DD`, donc blanc — conforme MD3, faux pour Pulpe |

## Decisions

| Decision                                                                                        | Why                                                                                                                                                                          |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La sortie du flow ne nomme aucune route : elle rend la main à `/`                                | `landingRoute` est déjà la seule autorité sur l'écran d'atterrissage, et une chaîne codée en dur à un endroit est exactement ce qui a produit l'impasse et l'écran blanc Google |
| Le débordement se corrige par la **contrainte de largeur**, pas par un raccourcissement du texte | Android sait déjà rétrécir un hero ; il lui manquait une borne. Tronquer ou abréger le montant aurait menti sur la somme épargnée                                              |
| L'ancrage de la liste passe par un sélecteur pur testé, pas par une mesure dans le composant     | `budget-list-selectors.ts` porte déjà l'ordre de la liste ; la position du mois vécu s'en déduit et se teste sans monter d'écran                                              |
| Un composant `Notice` unique remplace les neuf `<Snackbar>` nus                                  | Le fond, la couleur d'encre et la garde au-dessus du FAB sont la même décision répétée neuf fois ; corriger le thème global aurait fait mentir le rôle MD3 `inverseSurface`   |
