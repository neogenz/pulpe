# Pulpe - Product Context

> Business rules, workflows, domain glossary.

---

## Core Concepts

### Financial Flow Types

| Type | Description |
|------|-------------|
| **Income** | Money enter budget |
| **Expense** | Money go out (living costs, purchases) |
| **Saving** | Planned savings treated as expenses ensure realization |

### Domain Model

| Entity | Description |
|--------|-------------|
| **Template** | Reusable month structure (income, expenses, savings) |
| **Budget** | Monthly instance from template, modifiable independently |
| **Budget Line** | Planned item (income/expense/saving) |
| **Transaction** | Actual operation adjust budget vs reality |

---

## Calculation Model

### Key Formulas

```
Available = Income + Rollover (from previous month)
Remaining = Available - Expenses
Progress = (Expenses ÷ Available) × 100
Ending Balance = Remaining (stored, becomes next month's rollover)
```

### Envelope Logic (SSOT: `shared/BudgetFormulas`)

All calcs use single formula set w/ envelope logic + kind filtering. One version each formula — no "with/without envelope" variants.

- **Allocated transactions** (`budget_line_id` set) covered by envelope (budget line). Effective amount = `max(line.amount, consumed)`. Prevents double-counting when transactions allocated to line.
- **Kind filter**: Computing `consumed` for line, only transactions matching line's kind category count (income tx for income lines, expense/saving tx for expense/saving lines). Prevents misallocated tx inflating wrong total.
- **Free transactions** (`budget_line_id` null) impact budget directly, added on top of envelope totals.
- **totalSavings**: Uses envelope logic (`max(line.amount, consumed)`) for saving lines, plus free saving tx. Complete savings picture incl ad-hoc savings.

### Rollover Chain

```
Month M   : ending_balance = (income + rollover_from_M-1) - expenses
Month M+1 : rollover = ending_balance_from_M
First month: rollover = 0
```

### Example

```
Jan: income=5000, expenses=4500, rollover=0    → ending=500
Feb: income=5200, expenses=4800, rollover=500  → ending=900
Mar: income=5100, expenses=5200, rollover=900  → ending=800
```

> Negative ending_balance propagates as negative rollover (debt).

---

## Business Rules

### RG-001: Template ↔ Budget Sync

- Template changes offer: "Template only" or "Apply to future months"
- Manually adjusted budget lines (`is_manually_adjusted = true`) never modified
- Never applies past months

### RG-002: Budget Line Consumption States

Applies **expense lines only**. Income and saving lines always display category color regardless consumption (saving = objective reach, not limit respect).

**Tint visuel iOS Budget Detail Page** (gouverné par `BudgetLineMixedRow.amountColor` ; voir RG-010) :

| Threshold | Tint montant |
|-----------|--------------|
| 0–49 % | neutre (text secondary) |
| 50–100 % | warning |
| >100 % | critical |

**État logique** (utilisé pour alertes, calculs, agrégats serveur, rollover) :

| Threshold | State |
|-----------|-------|
| 0–79 % | `healthy` |
| 80–100 % | `near-limit` |
| >100 % | `over-budget` |
| 100 %+ overall budget | Allowed, creates negative rollover |

Cette dissymétrie (visuel à 50 %, logique à 80 %) est volontaire : le tint donne un signal précoce à l'œil pendant le scan ; l'état logique reste plus tolérant pour éviter la sur-alerte.

### RG-003: Atomicity

- Budget creation from template: complete or rollback
- Transaction import: all or nothing with error report

### RG-004: Constraints

- One default template per user
- One budget per month per user
- At least one income line required in template
- Warning if expenses + savings > income in template

### RG-005: Transactions

- Manual entry only
- Added to budget lines (don't replace)
- Modification allowed for allocated tx (name, amount)
- Reallocation to another envelope not allowed
- Free tx editing follows same pattern
- Impact remaining immediately

### RG-006: App Lock & Biometric Unlock (iOS)

| Rule | Value |
|------|-------|
| PIN length | Exactly 4 digits (enforced client-side before PBKDF2 derivation) |
| Grace period | 30 seconds in background |
| Cold start | Always requires Face ID/PIN (no grace period) |
| Lock behavior | In-memory client key cleared, biometric keychain preserved |
| Biometric auto-trigger | Face ID/Touch ID prompts automatically on PIN screen |
| Fallback | PIN entry via numpad (Face ID button visible while < 4 digits entered) |

**Flow:** Background >= 30s OR app killed → `needsPinEntry` → PinEntryView auto-triggers Face ID → success = instant unlock; fail/cancel = user types PIN.

**Design decision:** `clearCache()` (in-memory only) used, not `clearAll()` (would wipe biometric keychain). Preserves biometric key across grace period locks, enables Face ID as fast re-entry path.

### RG-007: Recovery Key

- Recovery key shown **once** after PIN setup, PIN recovery, or manual regeneration from settings
- Format: 32 bytes, base32 grouped (`XXXX-XXXX-...`)
- **Never stored server-side** (only `wrappedDEK` stored)
- Clipboard copy available; no email/cloud backup
- Regenerable anytime from Account settings (requires password verification)
- Both PIN + recovery key lost: encrypted financial data **permanently inaccessible** (zero-knowledge model)
- Account recoverable via email password reset, but encrypted amounts become undecipherable
- iOS: "J'ai noté ma clé" button dismisses without paste-back confirmation (spec says `Confirmation obligatoire` but iOS does not enforce — known deviation)

### RG-009: Multi-Currency & Conversion

| Aspect | Règle |
|--------|-------|
| Devises supportées | CHF, EUR (extensible) |
| Devise par défaut | CHF (configurable dans les paramètres utilisateur) |
| Source des taux | Frankfurter API (`frankfurter.dev`), cache 24h côté backend |
| Fallback panne Frankfurter | Sert le dernier taux disponible sans limite de staleness (web : badge "Taux du {date}" + tooltip) |
| Métadonnées de conversion | Chaque transaction/prévision/template/objectif d'épargne stocke : `originalAmount`, `originalCurrency`, `targetCurrency`, `exchangeRate` |
| Nature des métadonnées | Historique, pas live — le taux au moment de la saisie est figé définitivement |
| Même devise | Si base === target, taux = 1 sans appel API |
| Colonnes chiffrées | `original_amount` / `original_target_amount` chiffrés comme `amount` (AES-256-GCM) |
| Affichage | Badge `currency_exchange` avec tooltip quand des métadonnées de conversion existent |
| Paramètre utilisateur | `currency` (devise préférée) + `showCurrencySelector` (toggle) dans `user_metadata` Supabase |

### RG-008: Widget Data Privacy

- Widget caches `available` (remaining budget) as plaintext `Decimal` in App Group UserDefaults
- **Not encrypted at rest** — WidgetKit runs separate process w/o keychain/Face ID access
- App lock (30s grace period) does **not** extend to widget preview
- Widget data cleared on logout and password reset
- **Accepted risk:** widget shows financial amounts even when app locked

### RG-010: Affichage liste budget mensuel (iOS)

Règles métier d'affichage de la page détail budget (liste enveloppes + bottom sheet). Source : référentiel mai 2026 (`Pulpe v2 UX UI`, validated DM2.1.b.c5 + DM2.1.c). Couleurs / tailles / espacements vivent dans `memory-bank/DA.md` + `DesignTokens.swift` + `Color+Pulpe.swift` — pas répétés ici.

#### Hiérarchie & principes
- Label de l'enveloppe = élément dominant. Le montant est secondaire.
- Étiquette texte uppercase au-dessus du label : « REVENU » / « ÉPARGNE » / « DÉPENSE ». Toujours présente.
- Couleur jamais seule pour porter le sens (toujours doublée d'un mot).
- Pas de redondance : si l'info est déjà visible (ex: restant à droite), ne pas la répéter dans le sous-titre.
- Absence est un signal : pas de sous-titre quand il n'y a rien à dire.

#### Ordre & groupes
- Ordre par défaut : Revenu → Épargne → Dépense.
- Section header : « Revenus » / « Épargne » / « Dépenses » + compteur d'items « · N ».
- Un groupe disparaît automatiquement si tous ses items sont filtrés.

#### Filtres
- Une barre unique horizontale scrollable.
- Filtre Type (gauche, dominant) : Tout / Revenus / Épargne / Dépenses + counters dynamiques.
- Filtre Pointage (droite, secondaire) : « À pointer » (défaut) / « Pointé » / « Tout ».
- Cumulatif AND. Compteurs Type recalculés selon Pointage actif.

#### Interaction sur une ligne
- **Tap cercle** → toggle pointé/non-pointé. **N'ouvre pas la sheet.**
- **Tap reste de la ligne** (label, montant) → ouvre bottom sheet detail.
- Sur enveloppe pointée : tap ouvre quand même la sheet (consultation possible).
- **Déviation Pulpe** : pas de swipe-left actions, pas de long-press reorder. Édition/suppression via menu de la sheet (la spec mentionne ces gestes mais ne sont pas implémentés volontairement).

#### Pointage
- Triple-codage visuel : opacité réduite + strikethrough sur le label + coche pleine dans le cercle.
- Sous-titre masqué quand pointé (état terminal).

#### Montant à droite — par type d'enveloppe

Mental model : on affiche ce qui répond à la question que se pose l'utilisateur pour ce type d'enveloppe.
- Dépense → « combien il me reste pour ce poste ? » → restant.
- Revenu → « est-ce arrivé ? » → réel reçu.
- Épargne → « j'ai bien transféré ? » → réel versé.

| Type | Cas | Montant affiché | Couleur |
|---|---|---|---|
| Dépense | rien dépensé | prévu | neutre |
| Dépense | en cours, <50 % conso | restant (`prévu − réel`) | neutre |
| Dépense | en cours, ≥50 % conso | restant | warning |
| Dépense | dépassée | **excess** (`réel − prévu`) | critical |
| Revenu | rien encore reçu | prévu | income |
| Revenu | reçu (partiel ou total) | réel | income |
| Épargne | rien encore versé | prévu | primary |
| Épargne | versé (partiel ou total) | réel | primary |

Toujours actif (jamais grisé), même quand `réel == 0`.

Sous-montant (en gris, sous le montant principal) — labellise ce que le chiffre représente :

| Cas | Sous-montant |
|---|---|
| Dépense rien dépensé | « prévu » (le montant à droite est déjà le prévu) |
| Dépense en cours partielle (`réel > 0 ∧ réel ≠ prévu ∧ pas de dépassement`) | « restant sur X.XX » (sans CHF, suffixe sur le principal) |
| Dépense `réel == prévu` | masqué (redondant) |
| Dépense dépassée | « de dépassement » (label seul, sous le montant excess en critical) |

#### Sous-titre (sous le label)

| État | Sous-titre |
|---|---|
| Revenu rien reçu (`réel == 0`) | (pas de sous-titre — le montant à droite montre déjà le prévu, redondant) |
| Revenu en cours (`0 < réel < prévu`) | « X.XX CHF à recevoir » (où `X.XX = prévu − réel`) |
| Revenu reçu (`réel ≥ prévu`) | « Reçu » |
| Épargne rien versé (`réel == 0`) | (pas de sous-titre — le montant à droite montre déjà le prévu, redondant) |
| Épargne en cours (`0 < réel < prévu`) | « X.XX CHF à transférer » (où `X.XX = prévu − réel`) |
| Épargne versé (`réel ≥ prévu`) | « Transféré » |
| Dépense rien dépensé | (pas de sous-titre) |
| Dépense en cours | (pas de sous-titre — le restant est à droite, le répéter est une redite interdite) |
| Dépassée | « Budget dépassé » (critical, bold) |
| Pointée | (pas de sous-titre — état terminal) |

**Précédence** : si l'enveloppe est pointée, c'est l'état terminal qui prime. Pas de sous-titre, peu importe le type ou l'état de consommation. Les autres règles ne s'appliquent que si `pointée == false`.

#### Bottom sheet de détail

Cadre avec la liste (même mental model) : restant en XL + consommé/prévu en sous-titre + progress bar.

- Handle drag iOS natif.
- Header : nom de l'enveloppe, wrap max 2 lignes, ellipse au-delà.
- Hero chiffré : **restant en XL**, sous-titre `consommé / prévu` (ex: `342.50 / 800.00 CHF`), progress bar.
- Progress bar pleine largeur, **toujours visible ici** (contrairement à la liste où elle est conditionnelle).
- État chip : « Bonne voie » / « À surveiller » / « Dépassé » selon pourcentage [composant `BudgetLineStateChip` à implémenter].
- Liste des transactions de l'enveloppe pour le mois en cours.
- CTA sticky bottom : « + Ajouter une transaction » (ne scroll pas).

#### Transaction row dans la sheet
- Label : wrap max 2 lignes (pas d'ellipse) — mode lecture, pas scan.
- Date sous le label.
- Montant CHF à droite, tabular-nums.
- Si transaction en devise étrangère :
  - Le CHF reste le montant principal.
  - Sous le CHF, en gris : devise originale + montant (ex: `EUR 38.50`). Format ISO 3 lettres + 2 décimales sans séparateur.
  - Pas de taux de change ici (vit dans le détail transaction si besoin).

#### Multi-devise (rappel cohérent avec RG-009)
- Tous les agrégats en CHF (devise du compte) : total enveloppe, restant, hero du mois.
- Devise originale uniquement au niveau transaction dans la sheet, jamais en agrégat.
- Taux de change figé au jour de la transaction (immuable).
- Liste des enveloppes : **jamais** de devise originale d'une transaction individuelle. La liste reste en CHF pur.

#### Truncation
- Liste : 1 ligne, ellipse — densité de scan.
- Sheet : 2 lignes wrap max, hauteur variable acceptée.
- Montants : jamais d'ellipse — `chfShort()` (ex: `1.25M`) si trop grand.
- Pills (filtres) : nowrap, scroll horizontal.

#### Format monétaire
- `1'234.56 CHF` partout : séparateur suisse `'`, 2 décimales obligatoires, suffixe CHF visible.
- Tabular-nums sur tous les chiffres.
- Sous-montant (« prévu », « restant sur X.XX », « de dépassement ») : 2 décimales sur les chiffres, sans CHF (suffixe est sur le montant principal).

#### Anti-patterns à éviter
- Montant gris pâle pour signifier « rien encore » → lu comme « désactivé ».
- Picto chevron/flèche sans étiquette texte → indéchiffrable.
- Pourcentage à droite sans contexte (« 21 % ») → bruit, pas signal.
- Barre de progression toujours affichée dans la liste → peigne dentelé, redondant.
- Couleur seule pour distinguer revenu/épargne/dépense → exclut les daltoniens.
- Sous-titre verbeux quand le montant à droite suffit.
- Sous-montant « restant sur X.XX » quand `réel == prévu` → redondant (masquer).
- Sous-titre Épargne / Revenu reprenant le montant déjà visible à droite → redondant.
- Couleur dominante (full-card vert, montant XXL) → écrase la hiérarchie typographique.

---

## Workflows

### WF-000: Onboarding

1. Enter basic info (income + fixed expenses)
2. Auto-create "Standard Month" template
3. Generate current month budget
4. Redirect to dashboard

### WF-001: Annual Planning

1. Select reference template
2. Choose period (default: calendar year)
3. Generate 12 identical budgets
4. Adjust individual months as needed

### WF-002: Monthly Tracking

1. View dashboard (available, remaining, progress)
2. Add transactions as they occur
3. Receive alerts at thresholds
4. Auto-close at month end with rollover calculation

### WF-004: Dashboard (planned — #271)

1. Open app → see hero number "Disponible à dépenser"
2. Temporal progress bar: % month elapsed vs % budget consumed
3. See unchecked budget lines (quick-check from dashboard)
4. Bar chart: income vs expenses over last 6 months
5. FAB (+) for quick transaction entry

### WF-003: Demo Mode

1. Click "Try demo" (login or onboarding)
2. Cloudflare Turnstile validation
3. Create ephemeral user (backend)
4. Generate realistic data
5. 24h session w/ auto-cleanup

**Protection**: Rate limiting (10/hour/IP) + Turnstile + single-use tokens

---

## Glossary

### Technical → User Terms (FR)

| Technical | User-Facing |
|-----------|-------------|
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

### Domain Terms

| Term | Definition |
|------|------------|
| Template | Reusable month structure |
| Budget | Monthly instance from template |
| Budget Line | Planned budget item |
| Transaction | Actual operation entry |
| Available | Income + rollover |
| Remaining | Available - expenses |
| Rollover | Surplus/deficit carried to next month |
| Ending Balance | Month result (becomes next rollover) |
| Original Amount | Montant saisi dans la devise d'origine (avant conversion) |
| Exchange Rate | Taux de change figé au moment de la saisie |
| Currency Metadata | Ensemble {originalAmount, originalCurrency, targetCurrency, exchangeRate} |

---

*See `projectbrief.md` for project overview.*
*See `DA.md` for brand guidelines and UX writing.*