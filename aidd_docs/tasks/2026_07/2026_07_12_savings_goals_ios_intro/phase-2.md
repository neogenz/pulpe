---
status: done
---

# Instruction: Craft, accessibilité, preuve

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
ios/PulpeTests/Features/SavingsGoals/
└── SavingsGoalsIntroGateTests.swift        ✅ test unitaire de la fonction pure du gate

ios/Pulpe/Features/SavingsGoals/Intro/
├── SavingsGoalsIntroCover.swift            ✏️ #Preview (3 pages) + passe motion/a11y
└── SavingsGoalsIntroPage.swift             ✏️ VoiceOver labels + reduce-motion final
```

Aucune création de fichier de prod (tout est posé en phase 1). Cette phase durcit et prouve.

## Tasks to do

### `1)` Test du gate

> Verrouiller la logique « 1 seule fois ».

1. `SavingsGoalsIntroGateTests.swift` (Swift Testing) : `#expect(SavingsGoalsIntroGate.shouldPresentIntro(hasSeen: false))` et `#expect(!SavingsGoalsIntroGate.shouldPresentIntro(hasSeen: true))`.

### `2)` Accessibilité

> Lisible au clavier / VoiceOver, pas de piège de focus.

1. Chaque page : `accessibilityElement(children: .combine)` sur hero+titre+corps, label parlé = titre + corps.
2. Bouton primaire et « Passer » atteignent `DesignTokens.TapTarget.minimum`.
3. Indicateur de page : `accessibilityLabel("Page \(i) sur 3")`, non focusable individuellement.

### `3)` Motion (revu apple-design + emil-design-eng)

> Surface **rare** (intro vue une fois) = priorité motion basse (framework de fréquence emil / apple-design §16 Purpose) : soigner l'entrée + le paging natif, puis s'arrêter. Pas de matched-geometry / hero-morph / gesture custom — sur-ingénierie pour un écran vu une fois.

1. Entrée échelonnée hero → titre → corps via `entranceSpring` + `staggerStep` (0.05) ; avance de page via `stepTransition`. Aucun `scale(0)`, aucun `ease-in`.
2. Reduce-motion (`accessibilityReduceMotion`) → offset/spring retirés mais **fondu d'opacité court conservé** (`.easeOut(fast)`), jamais d'apparition sèche.
3. Press feedback du CTA = opacity-dim de `.primaryButtonStyle()` (idiome app) — ne pas ajouter de `scale`.
4. Dark mode : hero/titre/corps lisibles sur `pulpeBackground()` clair ET sombre (contraste `textTertiary` OK).
5. Relecture à froid en slow-motion (emil « review the next day ») : swipe interruptible, points d'index synchro, pas de deux états qui se chevauchent.

### `4)` Preuve

> Build vert + captures pour la PR.

1. `#Preview` du cover (les 3 pages) pour revue visuelle.
2. Build ciblé `-configuration Local` (cf. mémoire : projet sans config `Debug`) + suite unitaire verte.
3. Captures light + dark des 3 pages (simulateur) pour la description de PR.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                              |
| ---- | --------------------------------------------------------------------------------------------------------------- |
| 1    | Le test du gate passe (2 assertions).                                                                            |
| 2    | VoiceOver annonce titre+corps par page ; tap targets ≥ minimum ; l'indicateur n'aspire pas le focus.            |
| 3    | Reduce-motion = fondu opacité (pas d'apparition sèche ni de slide) ; entrée/avance via tokens ; pas de `scale(0)`/`ease-in` ; CTA sans scale ajouté ; lisible light+dark. |
| 4    | `#Preview` rend les 3 pages ; build `Local` vert ; suite unitaire verte ; captures light+dark produites.        |
