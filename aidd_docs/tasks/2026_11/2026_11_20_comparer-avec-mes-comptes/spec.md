# Spec: « Comparer avec mes comptes »

The contract every phase builds against: rules, screen selection, numbers and copy. The board (https://claude.ai/artifact/VSGHiBCgPCkKD4pnH9kMWg, version 35) shows each screen; where the board and this file disagree, this file wins. The reasoning behind each rule is in [`decisions.md`](./decisions.md).

French is the source copy. Every string also gets en, de and it entries in the same change (tutoiement in every language, `pnpm test:lexicon` green).

## 1. Where the feature lives

- Name everywhere: « Comparer avec mes comptes ». « Rapprocher mes comptes » and the bare « Comparer » button label disappear on web and Android.
- Entry points: the home page (always the current month) and the budget detail page only when the viewed month is the current period (pay day aware). Past and future months show no button.
- Web works at desktop width (dialog, 560px) and phone width (full-screen dialog, bottom sheets), like the « Mon patrimoine » intro.

## 2. Guide

- 3 scenes, animated in code like the « Mon patrimoine » intro, with « Réduire les animations » showing each final state at once. The scene drawing is decorative (hidden from screen readers); one sentence per scene is read instead.
- Opens by itself the first time the form is opened on this device, before step 1. « Passer » (every scene) and « Comparer maintenant » (last scene) go to step 1. Seen = stored on the device, set whatever the exit.
- The « ? » button (« Revoir le guide ») in the form header replays it from any step; leaving it returns to the step the person was on, typed values intact.
- The guide is a page inside the comparison sheet or dialog, not a second dialog.

| Scene | Title | Sentence | Drawing |
| --- | --- | --- | --- |
| 1 | Vérifie que Pulpe et ta banque disent la même chose | Tu évites les mauvaises surprises : si un montant manque, Pulpe te le montre. | « Ma banque · Compte courant 890.00 » ≠ « Pulpe · Déjà coché 950.00 », then « 60 de différence » |
| 2 | Tape ce que ta banque affiche | Ouvre l'app de ta banque et recopie le montant de ton compte. | The bank balance circled, then 8, 9, 0 typed into « Sur tes comptes », then a tap on « Comparer » |
| 3 | Pulpe te montre ce qui manque | Coche l'essence de 60 : Pulpe est à jour avec ta banque. | « Tu vois cette dépense dans l'app de ta banque ? », « Essence · hier 60.00 » gets checked, Pulpe goes 950.00 → 890.00, « Pareil des deux côtés » |

Buttons: « Passer », « Suivant », « Comparer maintenant ». Step dots read « Étape N sur 3 ».

## 3. Step 1, « Combien as-tu aujourd'hui ? »

Header: « Étape 1 sur 2 », title « Combien as-tu aujourd'hui ? », sentence « Tape ce que ta banque affiche aujourd'hui, compte par compte. »

- Each row: a name, a « J'ai » / « Je dois » choice, an amount in the budget currency, and « Retirer » (accessible name « Retirer {nom} de la liste »).
  - Rows from Mon patrimoine show their side as a fixed label (own → « J'ai », owe → « Je dois ») and the caption « Mis à jour dans Mon patrimoine. ».
  - Free rows show a full-width two-segment control (accessible name « {nom} : ce que j'ai ou ce que je dois »), at least 44pt high.
  - A « Je dois » row coming from a card carries « Tout ce que tu dois, achats récents compris. Pas ta limite. ».
- « Ajouter un compte » opens a sheet:
  - « Seulement les comptes de tes dépenses. Pas l'épargne. »
  - « Nouveau compte » · « Juste pour comparer » (free row, « J'ai » by default).
  - « Une somme que je dois » · « PayPal, Klarna, facture programmée » (free row, « Je dois »).
  - « Depuis Mon patrimoine » · « Mis à jour avec ce que tu tapes », then the own and owe items grouped by type, each with its side. Hidden: archived items, other currencies, items already in the list, and any item that a saving budget line of the current month points to (`budgetLine.assetId`). The whole block is hidden when the `net_worth` flag is off.
- Card help: while no « Je dois » row exists, under « Ajouter un compte »: « Tu paies aussi par carte de crédit, PayPal ou Klarna ? » [Ajouter ce que je dois] (adds a « Je dois » free row and focuses its name).
- Total: « En tout » with the sum; when a « Je dois » row exists, the line under it reads « {J'ai total} − {Je dois total} que tu dois ». Button « Comparer ».
- « Retirer » removes the row from this comparison only. It never archives, deletes or edits a Mon patrimoine item (unlinking `inPulpe` stays as today).
- On « Comparer »: balances of Mon patrimoine rows are recorded as snapshots, as today. Free rows never create a Mon patrimoine item (the « Ajouter à Mon patrimoine » switch is removed).
- Device memory: names and sides of free rows are kept on this device for the next comparison (never their amounts, never sent to the server). Cleared on sign-out.
- Draft: rows and amounts typed during a comparison survive the app going to background and the PIN or biometric lock, in memory only, keyed by budget. They are dropped when the comparison ends.

## 4. Step 2, the comparison

Header: « Étape 2 sur 2 », back arrow to step 1, « ? ».

### 4.1 The figures

- « Sur tes comptes » = J'ai total − Je dois total.
- Compared figure = realized balance of the month + prior correction + starting amount. The « Dans Pulpe, déjà coché » row shows its parts apart (see Display).
  - Prior correction (server): for each of the last two existing budgets before this one (`previousBudgetId` chain), `realizedNet(P) − storedEndingBalance(P)`, a null stored value counting as 0, exactly as the rollover counts it. It removes from the comparison what the rollover counted as spent but nobody checked. « Disponible à dépenser » does not change.
  - Starting amount (server, per person): 0 until the person answers « Oui, c'était déjà là ». When it is not 0, tapping « {starting amount} d'avant Pulpe » opens a small editor with an amount field, [Enregistrer] and [Remettre à 0].
  - Display: the figure on the « Dans Pulpe, déjà coché » row is the realized balance alone, the same number as « Solde pointé » on the Accueil. Under it, in this order, one line per part that is not 0: « {±prior correction} pas coché les mois d'avant » (plain text), then « {±starting amount} d'avant Pulpe » (the editor button). The gap still uses the whole compared figure.
  - After a check moves the realized balance, the old realized balance is shown struck through next to the new one. Checking an item of a previous month only changes the « pas coché » line. Editing the starting amount or removing « Je dois » keeps the struck figure.
- Step 2 waits for the server context. If it fails, step 2 shows « Impossible de comparer pour l'instant. » with [Réessayer], writes nothing, and the back arrow keeps step 1's amounts.
- Gap = Sur tes comptes − Dans Pulpe, in cents, no tolerance.
- Title = verdict: « Tes comptes ont {|gap|} de moins que Pulpe » (gap < 0), « Tes comptes ont {gap} de plus que Pulpe » (gap > 0), « Pareil des deux côtés » (gap = 0).

### 4.2 Suggestions

- Candidates: unchecked movements and unchecked budget lines of the month, plus the server's unchecked items of the two previous budgets. Same rule as today: the check moves the compared figure towards zero without crossing it; ranked by what remains; 3 at most.
- Each row: name, then a second line « Prévue ce mois » (budget line), « Mois dernier » (1 budget back) or « Il y a 2 mois » (2 back), else the date (« Essence · mardi »). The amount is highlighted green when it equals the remaining gap exactly. Rows are at least 64pt high.
- Lead sentence: « Coche les dépenses que tu vois dans l'app de ta banque. » (gap < 0, no « Je dois » row), or « Coche les dépenses et l'épargne que tu vois dans l'app de ta banque. » when a shown row is a saving, « Coche les achats faits avec ta carte. » (gap < 0 and a « Je dois » row), « Coche les revenus que tu vois dans l'app de ta banque. » (gap > 0).
- « Voir les {n} autres à cocher » opens the existing list of items to check.
- Checking a row checks the real item (any of the three months) and recomputes. The struck figure follows §4.1. Once a check has closed part of the gap, a bar reads « {found} trouvés » (what is left is already in the title, never repeated); editing the starting amount or removing « Je dois » hides it until the next check.
- With a « Je dois » row and gap < 0: « Tu coches tes achats de carte à la facture ? » [Retirer « Je dois {montant} »] (removes the « Je dois » rows and recomputes).
- Footer: [Aucune dépense ne correspond] (« Rien ne correspond » when a shown row is a saving, « Aucun revenu ne correspond » when gap > 0), then « Laisser comme ça ».

### 4.3 Which screen shows

Computed from the current numbers, recomputed after every check, row change or answer. `dismissed` = the person tapped « Aucune … ne correspond » in this comparison. `first` = the server has no completed comparison for this person and the starting amount is 0.

| Condition, first match wins | Screen |
| --- | --- |
| gap = 0 | Matched |
| candidates and not dismissed | Suggestions |
| gap > 0 and first | First comparison |
| gap > 0 and salary maybe early | Salary early |
| abs(gap) < 10.00 | Small gap |
| gap < 0 | Large gap |
| gap > 0 | More on accounts |

Salary maybe early = gap > 0, a pay day other than 1 is set, and the next period starts in 5 days or fewer (today counted). The threshold 10.00 is in the budget currency.

### 4.4 Screens

- **Small gap**: card « Un arrondi ou des frais de ta banque ? » with the mini row « Café · payé 3.80 · noté 3.00 » (gap > 0: « Café · payé 3.00 · noté 3.80 »). [Noter une dépense de {|gap|}] or [Noter un revenu de {gap}], under it « Disponible : {avant} → {après} ». Then « Laisser comme ça ».
- **Large gap**: « Tu vois −{|gap|} dans l'app de ta banque, mais pas dans Pulpe ? » [Oui, noter une dépense de {|gap|}], « Disponible : {avant} → {après} », [Non, laisser comme ça].
- **More on accounts**: if no « Je dois » row, a card « Tu as payé par carte de crédit, PayPal ou Klarna ? » [Ajouter ce que je dois] (back to step 1 with a new « Je dois » row). Then « Tu vois +{gap} dans l'app de ta banque, mais pas dans Pulpe ? » [Oui, noter un revenu de {gap}], « Disponible : {avant} → {après} », [Non, laisser comme ça].
- **Salary early**: « Ton salaire est arrivé en avance ? » / « Reviens comparer le {jour}, jour de ta paie. » [Voir les autres raisons], « Laisser comme ça ».
- **First comparison**: no label above the question (it would be false for people who compared before this release). « Ces {gap} étaient là avant Pulpe ? » [Oui, c'était déjà là], « Ton disponible ne change pas. », [Non, autre chose] (opens Other reasons), « Laisser comme ça ». « Oui » stores starting amount += gap, then shows Matched.
- **Other reasons** (sheet, from Salary early and First comparison): title « D'où viennent ces {gap} ? », close button, at most 3 reasons in this order, each kept only when its condition holds, then « Laisser comme ça »:
  1. No « Je dois » row: « Tu as payé par carte de crédit, PayPal ou Klarna ? », mini visual Pulpe « Habits 350.00 » checked vs « Ta banque · Pas encore là », [Ajouter ce que je dois].
  2. A checked expense budget line of the month has allocated movements above 0 and below its amount: « Une prévision cochée n'est pas toute dépensée ? », mini visual of that line (« {spent} dépensés » / « {left} encore là »), round green mark « Normal, rien à faire ».
  3. Always: « Tu as reçu de l'argent ? », mini visual « Prime · 20 nov. » « Pas dans Pulpe » « +{gap} », [Noter un revenu de {gap}], « Disponible : {avant} → {après} ».
  4. Always: « Ton compte épargne est dans la liste ? », mini visual « Compte épargne {gap} » « À retirer », [Revoir mes comptes] (back to step 1).
- **Matched**: the title « Pareil des deux côtés » alone (no sentence repeating it), success mark, then a card:
  - « Sur tes comptes {on accounts} », the figure the lines below start from.
  - « Encore prévu −{x} » when À dépenser < (compared − starting amount), or « Encore à recevoir +{x} » when it is above; no line when equal.
  - « D'avant Pulpe −{starting} » when the starting amount is not 0.
  - « À dépenser ce mois {remaining} » (green).
  - [Terminer].
- « Disponible : {avant} → {après} »: avant = « Disponible à dépenser » now, après = avant + gap.

### 4.5 Writing an entry

- The noted movement: name « Écart avec mes comptes » (translated), kind expense or income by the gap sign, amount |gap|, free (no budget line), checked now, dated today. The name is not shown before the tap.
- A comparison is completed when the person leaves step 2 by [Terminer], « Laisser comme ça », « Non, laisser comme ça », a noted entry or « Oui, c'était déjà là ». Completion is sent to the server once per comparison and emits `account_reconciliation_completed` with `adjustment_kind` income, expense or none, as today.
- Pulpe never unchecks anything.

## 5. Words

- « payé » with « tu » as the subject; never « parti », never « l'argent est parti ».
- Never « il », « elle », « celles » or « dessus » without naming the thing; no masculine form for the person (« tu reçois ton salaire »).
- Never « ajustement », never « transaction » on screen.
- Amounts in tabular figures, never split across two lines.
- About 35 words at most per step-2 screen; one question or action per block.
- Each fact once: no label above a question, no sentence repeating the title, no number the title already gives.

## 6. Analytics

| Event | Properties | Emitted |
| --- | --- | --- |
| `account_reconciliation_guide_viewed` | `source`: `auto` or `help` | the guide opens |
| `account_reconciliation_guide_completed` | `source` | « Comparer maintenant » |
| `account_reconciliation_guide_skipped` | `source` | any other exit (« Passer », close, back) |
| `account_reconciliation_completed` | `adjustment_kind` (unchanged) | completion, see 4.5 |

No amount, label or account name in any payload.
