---
status: pending
---

# Instruction: Confidentialité frontend (PostHog, xlsx, doc remember-device)

## Architecture projection

```txt
frontend/
├── package.json                                                  ✏️ xlsx npm → distribution officielle SheetJS
└── projects/webapp/src/app/
    ├── core/analytics/posthog.ts                                 ✏️ maskTextSelector sur les zones financières
    ├── core/analytics/posthog.spec.ts                            ✏️ config de masking vérifiée
    ├── core/budget/excel-export.service.ts                       ✏️ import adapté si nécessaire (même API attendue)
    ├── core/file-download.ts                                     ✏️ idem
    └── feature/dashboard/ (+ écrans montants)                    ✏️ attribut data-ph-mask sur les affichages de montants
docs/
└── ENCRYPTION.md                                                 ✏️ risque accepté remember-device documenté
```

## User Journey

```mermaid
flowchart TD
  A[Replay PostHog activé en prod] -->|maskAllInputs + maskTextSelector [data-ph-mask]| B[Montants masqués dans le replay]
  C[Utilisateur coche remember-device] -->|avertissement explicite| D[Choix éclairé - risque documenté]
  E[Export Excel] -->|SheetJS à jour| F[CVE-2023-30533 / CVE-2024-22363 corrigées]
```

## Contexte technique (lu avant de coder)

- PostHog : `posthog.ts:101-105` pose `maskAllInputs: true` mais rien pour le texte du DOM. `SessionRecordingOptions` expose `maskTextSelector`/`maskTextClass` (pas `maskAllText` — vérifié ctx7). Le sanitizer d'événements (`posthog-sanitizer.ts`) est déjà exhaustif, ne pas y toucher.
- `xlsx` n'est utilisé qu'en **export** (`file-download.ts:34` `writeFileXLSX`, `excel-export.service.ts` `utils`) — aucun parsing de fichiers entrants. La migration vers la distribution officielle SheetJS (registry CDN) apporte les correctifs avec la même API.
- Convention frontend : vérifier `ui/` ou `pattern/` avant de créer ; l'attribut `data-ph-mask` suit le style des `data-testid` existants.
- Remember-device : conservé (décision utilisateur) — seuls la documentation et un libellé d'avertissement changent.

## Tasks to do

### `1)` Masquer les montants dans le session replay

> Si le replay est activé en prod, aucun montant ni libellé financier affiché ne doit être enregistré.

1. Dans `posthog.ts`, ajouter `maskTextSelector: '[data-ph-mask]'` à `session_recording` (conserver `maskAllInputs: true`).
2. Identifier les composants affichant des montants financiers (dashboard « Disponible à dépenser », « Épargne prévue », lignes de budget, objectifs d'épargne) et ajouter `data-ph-mask` sur l'élément porteur du montant — sans créer de composant, attribut direct sur le template existant.
3. Spec : la config passée à `posthog.init` contient le sélecteur.

### `2)` Migrer `xlsx` vers la distribution officielle SheetJS

> Consommer les correctifs des deux CVE sans changer le code d'export.

1. Remplacer dans `frontend/package.json` la dépendance `xlsx` par le tarball/registry officiel SheetJS (voir Resources du plan) ; mettre à jour la config pnpm si un registry scoped est requis (`.npmrc`).
2. Vérifier que `writeFileXLSX` et `utils` restent disponibles à l'identique ; adapter les imports uniquement si le nom de package change.
3. `pnpm install` + test manuel de l'export Excel depuis le dashboard + `pnpm test` frontend.

### `3)` Documenter le risque accepté remember-device

> Le choix de persister la clientKey en localStorage est assumé et visible.

1. `docs/ENCRYPTION.md` : section risques acceptés — localStorage de la clientKey (scénario de vol combiné token + clé via XSS, mitigations existantes : CSP stricte, sanitizer Angular, session Supabase).
2. Dans les 3 écrans vault (`enter-vault-code`, `setup-vault-code`, `recover-vault-code`), ajouter un court texte d'avertissement sous la checkbox « se souvenir de cet appareil » (clé i18n `auth.vaultCode.rememberDeviceHint`, FR + EN), sans changer le comportement.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------------- |
| 1    | La config `session_recording` envoyée à PostHog contient `maskTextSelector: '[data-ph-mask]'` et les principaux écrans de montants portent l'attribut |
| 2    | L'export Excel produit un fichier identique à avant ; `xlsx` vulnérable n'est plus dans le lockfile (`pnpm why xlsx` → version SheetJS corrigée) |
| 3    | L'avertissement s'affiche sous la checkbox des 3 écrans vault ; `ENCRYPTION.md` documente le risque accepté    |
| —    | `pnpm quality` frontend vert                                                                                   |
