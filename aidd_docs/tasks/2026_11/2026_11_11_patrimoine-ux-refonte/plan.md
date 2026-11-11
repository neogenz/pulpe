---
objective: "Mon patrimoine reads as one coherent screen on web and iOS: one sheet per element, Types instead of Catégories, a reconciliation link set where it is used, a legible Sankey in both themes."
status: in-progress
---

# Plan: Refonte UX de Mon patrimoine

Source: retours de Maxime du 2026-11-11 (captures web desktop et mobile) et grill du même jour. Les retours portaient sur le placeholder qui chevauche la devise, le sélecteur de devise trop grand, l'UX des catégories, la scrollbar dans la dialog de valeur, une page peu Material 3, le Sankey écrasé, la double action « Modifier » / « Mettre à jour la valeur », le « Dans Pulpe » incompréhensible, le contraste du Sankey en sombre et le pluriel de la note de change.

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1   | Web : une seule feuille d'élément | [`phase-1.md`](./phase-1.md) | none |
| 2   | Web : page, groupes et Sankey | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | Web : lien au patrimoine depuis le rapprochement | [`phase-3.md`](./phase-3.md) | 1 |
| 4   | iOS : une seule feuille, groupes par Type | [`phase-4.md`](./phase-4.md) | none |
| 5   | iOS : Sankey par Type et contraste | [`phase-5.md`](./phase-5.md) | none |
| 6   | iOS : lien au patrimoine depuis le rapprochement | [`phase-6.md`](./phase-6.md) | 4 |

## External sources

| URL | What it settled |
| --- | --------------- |
| https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html | 4.5:1 for the Sankey labels (text under 18pt) |
| https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html | 3:1 for the nodes against the card surface |
| https://m3.material.io/components/lists/overview | List rows with one primary action (tap) and a trailing icon menu |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| Runtime | No new endpoint. `PATCH /v1/assets/:id` already accepts `inPulpe` and `categoryId` (`shared/schemas.ts` `assetUpdateSchema`). `POST /v1/assets` creates an element with its first value. `DELETE /v1/asset-categories/:id` stays for iOS builds already installed. | 3, 6 |
| Regression | High on the web feature: `net-worth-page.spec.ts`, `asset-form-dialog.spec.ts`, `asset-categories-dialog.spec.ts`, `net-worth-asset-row.spec.ts`, `net-worth-sankey.flows.spec.ts`, `reconcile-accounts-dialog.spec.ts` (`describe('accounts linked to « Mon patrimoine »')` l.707-911), `frontend/e2e/tests/features/net-worth.spec.ts`. Medium on iOS: `AssetFormDraftTests`, `AssetValueSheetTests`, `AssetCategoriesLogicTests`, `NetWorthSectionsTests`, `NetWorthSankeyTests`, `ReconcileLinkedAccountsTests`. No safety-net phase: the existing specs lock the behavior that stays, and each phase rewrites the specs of what it changes. | 1-6 |
| Architecture | `pattern/reconcile-accounts` cannot import `feature/net-worth`, so resolving a Type by name moves from `NetWorthStore.#resolveCategory` to `core/asset/`. The value dialog and the categories dialog/sheet are deleted on both clients. | 2, 3, 4 |
| Documentation | `docs/BUSINESS_RULES.md` § Patrimoine: the Type rule (a Type with no element is hidden, debt suggestions), the link set from the reconciliation, and the end of the `own`-only first value in the merged sheet. | 1, 3 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `pnpm test:lexicon` (`.github/scripts/lexicon.test.mjs` l.538) refuses `rapproché(e)(s)` in every catalog | The badge and the hints cannot say « Rapproché chaque mois ». Use « Mis à jour au rapprochement ». |
| `frontend/DESIGN.md` Semantic Color Rule and Three-Layer Token Rule | The Sankey reads `--mat-sys-primary` directly. The contrast fix goes through `--pulpe-*` roles. |
| `frontend/DESIGN.md` « dialogues plein écran sous `40rem` » | The element sheet goes full screen on handset, like `reconcile-accounts-dialog.service.ts`. |
| `transloco-i18n.md`: new keys in fr, en, de, it, fr first | Every renamed or added string. |
| `ios/CLAUDE.md`: « catégorie » belongs to `BudgetLine` | Renaming to « Type » also removes this collision on iOS. |
| `.claude/rules/05-workflows-and-processes/posthog-events.md` | No event is added. `account_reconciliation_completed` keeps its payload. |
| PostHog privacy (`ph-no-capture` on names and amounts, never on interactive elements) | Type names, element names and values in every new view. |
| SwiftLint 500-line ceiling | `ReconcileAccountsSheet.swift` is at 492. Phase 6 extracts before adding. |
| CLAUDE.md « past ~300 net LOC, stop » | Each phase ships as its own PR. |

## Decisions

| Decision | Why |
| -------- | --- |
| UX contract shared by every phase. The direction is always « Ce que j'ai » / « Ce que je dois », and both sides are built the same way: a heading, then one card per « Type ». Tapping a row opens « Modifier » (name, Type, value). The row ⋮ holds Modifier, Archiver and Supprimer; a Type header ⋮ holds « Renommer le type ». An amount field carries its currency as a suffix and starts from the current value. Choosing among my own things always reads the same: a select of what exists, then « Autre… » that opens an inline name field (« Autre type… » in the sheet, « Autre compte… » in the reconciliation). The link badge reads « Mis à jour au rapprochement ». | Coherence asked for after the grill. « Modifier » stays in the menu because every other row menu of the product, web and iOS, starts with it; the tap is a shortcut, not a second action. « Type » already names the kind of a prévision, so it does the same job here. |
| A Type with no element is hidden, not deleted: the select and the page only list the Types that an element uses, and picking or typing its name reuses it. No backend change. | Deleting it server-side bought nothing: resolving a Type by name already avoids the duplicate error. Known limit: renaming a Type to the name of a hidden one still answers « Un type porte déjà ce nom ». |
| Type suggestions follow the direction. « Ce que j'ai » offers Comptes, Épargne, Placements, Cash, Objets de valeur, Biens. « Ce que je dois » offers Crédit, Hypothèque, Leasing, Carte de crédit. The select lists the existing Types already used by that direction, plus the unused suggestions, plus « Autre type… ». | A debt filed under « Comptes » made no sense. No schema change: a Type has no direction, the client filters. |
| The Sankey starts at the Types: Types → Ce que j'ai → Dettes by Type (overdrafts in « Découverts ») and Fortune nette. It is hidden when there is nothing to split (one Type and no debt). | It stays readable at 30+ elements, since there are at most about 10 nodes per column. The element detail lives in the lists. |
| The reconciliation link is the row itself. In the « Comptes » step each row picks one of my accounts of Mon patrimoine or « Autre compte… ». The accounts I finish with are the ones Pulpe follows: picking one links it, removing its row stops following it, and it stays in Mon patrimoine. A free row is private unless I tick « Ajouter à Mon patrimoine ». The form toggle is removed. | « Dans Pulpe » only had a meaning in the reconciliation. A separate « Enregistrer dans » select would have named the account twice (name field and select) and needed a « Ne pas enregistrer » option that unlinked for good while reading as « not this time ». |
