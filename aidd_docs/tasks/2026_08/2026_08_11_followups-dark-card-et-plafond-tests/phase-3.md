---
status: done
---

# Instruction: solder les ombres mortes en dark restantes

La phase 1 traite la carte de ligne. Le même défaut peut exister ailleurs : une ombre noire à
faible opacité ne rend rien sur un fond quasi-noir. Recensement complet des 12 usages :

| Site                                          | Token          | Statut                                     |
| --------------------------------------------- | -------------- | ------------------------------------------ |
| `View+Extensions.swift:330` (`pulpeRowCard`)   | `subtle`       | traité en phase 1                          |
| `BudgetLineMixedRow:149`                       | `subtle`       | supprimé en phase 1 (dédup)                |
| `BudgetDetailsFreeTransactionsList:194`        | `subtle`       | supprimé en phase 1 (dédup)                |
| `CurrentMonthView:361`                         | `zoneBoundary` | déjà bimodal, ne pas toucher               |
| `BudgetListView+Subviews:61,120,219`           | `subtle`       | **à juger**                                |
| `OnboardingRunningTotal:27`                    | `card`         | **à juger**                                |
| `WelcomeStep:28`                               | `elevated`     | **à juger**                                |
| `OnboardingStepView:228`                       | `elevated`     | **à juger**                                |
| `AuthTextField:65`, `CurrencyField:233`        | `input`        | **à juger**                                |

**Le piège de cette phase est de tout traiter en bloc.** Ces sites ne partagent pas de fond :
la liste des budgets est sur `appBackground`, l'onboarding sur un dégradé, les champs de
saisie sur leur propre surface. Une ombre parfaitement vivante sur un dégradé clair n'a pas
besoin d'être « corrigée » — lui coller un contour abîmerait un écran sain.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete
> Seuls les fichiers dont la tâche 1 prouve l'ombre morte sont modifiés. Un site jugé sain
> reste intact : la projection ci-dessous est un plafond, pas une liste de courses.

```txt
.
└── ios/Pulpe/
    ├── Features/Budgets/BudgetList/
    │   └── BudgetListView+Subviews.swift    ✏️  si les 3 cartes sont sur appBackground
    ├── Features/Onboarding/
    │   ├── Components/OnboardingRunningTotal.swift  ✏️  seulement si fond quasi-noir
    │   ├── Steps/WelcomeStep.swift                  ✏️  idem
    │   └── OnboardingStepView.swift                 ✏️  idem
    └── Shared/Components/
        ├── AuthTextField.swift              ✏️  idem
        └── CurrencyField.swift              ✏️  idem
```

## Tasks to do

### `1)` Établir le fond réel de chaque site

> Sans le fond, « l'ombre est morte » est une supposition, pas un constat.

1. Pour chacun des 7 sites à juger, remonter la hiérarchie de vues jusqu'au premier fond
   opaque et noter sa couleur en dark (`appBackground`, un dégradé d'onboarding, une surface
   de champ…).
2. Calculer le contraste de l'ombre composée sur ce fond, comme en phase 1.
3. Produire un tableau site → fond → verdict. **Ce tableau est le livrable de la tâche**,
   avant toute modification.
4. Trois verdicts, pas deux : `morte` (ombre noire sur fond quasi-noir), `vivante` (fond assez
   clair pour la porter), `déjà bimodale` (le site branche lui-même son rendu sur
   `colorScheme`). Sans le troisième, un site délibérément neutralisé se lit comme vivant et
   égare le prochain qui cherche les ombres mortes.

#### Le tableau

Contraste composé = l'ombre à son opacité nominale sur le fond opaque le plus proche, mesuré
sur les couleurs dark déclarées dans `Color+Pulpe.swift`. Repère : la même ombre `subtle` en
clair, sur `appBackground` `#EFF3EE`, donne **1,12:1** — c'est la magnitude d'une ombre qui
travaille.

| Site                                     | Ombre                | Fond réel en dark                                             | Composé | Verdict           |
| ---------------------------------------- | -------------------- | ------------------------------------------------------------- | ------- | ----------------- |
| `BudgetListView+Subviews:60` (hero)      | `subtle` — noir 5 %  | `appBackground` `#121611` (`BudgetListView:285` `pulpeBackground()`) | 1,01:1  | morte             |
| `BudgetListView+Subviews:121` (mois)     | `subtle` — noir 5 %  | idem `#121611`                                                | 1,01:1  | morte             |
| `BudgetListView+Subviews:220` (créer)    | `subtle` — noir 5 %  | idem `#121611`                                                | 1,01:1  | morte             |
| `OnboardingRunningTotal:27`              | `card` — noir 6 %    | `loginGradientBackground` `#141A16` (`OnboardingFlow:46`)     | 1,02:1  | morte, hors carte |
| `WelcomeStep:28` (logo)                  | `elevated` — noir 8 %| dégradé welcome, `#1A2A1E` → `#1C1C1E`                        | 1,04:1  | morte, hors carte |
| `OnboardingStepView:228` (FAB replié)    | `elevated` — noir 8 %| `loginGradientBackground` `#141A16`                           | 1,02:1  | morte, hors carte |
| `AuthTextField:65` + `CurrencyField:233` | noir **1 %** en dark | `authInputBackground` `#1C2420` sur `authBase` `#111614`      | 1,00:1  | déjà bimodale     |

Pourquoi chaque site non corrigé ne l'a pas été — un site sain doit pouvoir être reconnu
comme tel sans être re-mesuré :

- `BudgetListView+Subviews:220` porte déjà un contour, tireté et teinté par `adjustmentColor`.
  L'ombre y est morte comme chez ses deux voisines, mais la carte n'est pas pour autant sans
  frontière : lui ajouter `pulpeRowCardBorder` doublerait le trait.
- `OnboardingRunningTotal:27` n'est pas une carte de ligne. Sa surface
  `onboardingCardBackground` `#1E2822` se détache de son fond de **1,16:1** par le ton seul —
  davantage que ce qu'une ombre vivante apporte en clair (1,12:1). Le contour de la phase 1
  y ajouterait un trait sans manque à combler.
- `WelcomeStep:28` porte un logo, pas une carte : la profondeur y vient de la seconde ombre du
  même appel, une lueur `pulpePrimary` à 18–28pt qui, elle, se voit en dark.
- `OnboardingStepView:228` porte un FAB, et l'ombre ne s'applique qu'à l'état replié. Le
  bouton porte `onboardingGradient` (`#409B43` → `#56C45A`), à **5,04:1** de son fond : il ne
  compte pas sur son ombre pour exister.
- `AuthTextField:65` et `CurrencyField:233` neutralisent eux-mêmes l'ombre en dark, à 1 % de
  noir. C'est une décision déjà prise dans le code, pas un oubli — et le champ se détache de
  son fond de 1,15:1 par le ton.

### `2)` Corriger les seuls sites morts

> La correction reprend la forme de la phase 1, elle n'en invente pas une autre.

1. Pour un site mort qui est une carte de ligne sur `appBackground` : le brancher sur
   `pulpeRowCard()` si sa géométrie le permet, ce qui lui donne le contour de la phase 1
   gratuitement. Vérifier le rayon avant de substituer.
2. Pour un site mort qui n'est pas une carte de ligne : réutiliser `Color.rowCardBorder`
   uniquement si la sémantique correspond. Sinon, remonter le cas plutôt que de tordre un
   token de carte pour un usage qui n'en est pas un.
3. Ne créer aucun nouveau token sans l'avoir justifié dans le rapport.

### `3)` Vérification

1. `xcodebuild build -scheme PulpeLocal -configuration Local -destination 'platform=iOS Simulator,name=Pulpe Tests' CODE_SIGNING_ALLOWED=NO`.
2. `swiftlint lint --strict`, filtré sur les fichiers touchés.
3. Le simulateur MCP est hors service : aucune capture. Ne pas prétendre avoir vu le rendu.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Le tableau site → fond → verdict couvre les 7 sites, chaque verdict adossé à une couleur de fond relevée dans le code et à un ratio calculé, et chaque site non corrigé porte la raison de ne pas l'avoir été. |
| 2    | Tout site modifié figure au tableau avec le verdict `morte` ; aucun site `vivante` n'apparaît dans le diff.                                        |
| 2    | Aucun nouveau token de couleur n'est introduit sans justification écrite dans le rapport final.                                                    |
| 3    | Le build passe, `swiftlint --strict` est propre sur les fichiers touchés, et le mode clair est inchangé partout (les contours restent `.clear`).   |
