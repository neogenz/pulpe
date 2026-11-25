---
status: pending
---

# Instruction: Serveur — compte par défaut

## Architecture projection

```txt
.
├── shared/schemas.ts ✏️
├── docs/BUSINESS_RULES.md ✏️
└── backend-nest/
    ├── supabase/
    │   ├── migrations/20261125150000_user_default_account.sql ✅
    │   └── tests/
    │       ├── user_default_account.sql ✅
    │       └── README.md ✏️
    └── src/
        ├── types/database.types.ts ✏️
        ├── common/utils/asset-link.ts ✏️
        └── modules/
            ├── user/
            │   ├── domain/user.entity.ts ✏️
            │   ├── domain/ports/user-repository.port.ts ✏️
            │   ├── infrastructure/persistence/supabase-user.repository.ts ✏️
            │   └── infrastructure/persistence/supabase-user.repository.spec.ts ✏️
            ├── transaction/
            │   ├── transaction.module.ts ✏️
            │   ├── application/create-transaction.use-case.ts ✏️
            │   └── application/create-transaction.use-case.spec.ts ✏️
            ├── budget-line/
            │   ├── budget-line.module.ts ✏️
            │   ├── application/create-budget-line.use-case.ts ✏️
            │   ├── application/create-budget-line.use-case.spec.ts ✏️
            │   └── application/create-budget-line-spread.use-case.ts ✏️
            └── transaction-import/
                ├── transaction-import.module.ts ✏️
                ├── domain/transaction-import.entity.ts ✏️
                ├── application/confirm-transaction-import.use-case.ts ✏️
                ├── application/confirm-transaction-import.use-case.spec.ts ✏️
                └── infrastructure/persistence/supabase-transaction-import.repository.ts ✏️
```

## Test Scope

| Scenario   | Action | Observable outcome | Actor |
| ---------- | ------ | ------------------ | ----- |
| Setup      | Jeu d'essai du ticket, aucun compte par défaut | `GET /v1/users/settings` → `defaultAccountId: null` | api |
| Happy path | `PUT` Compte courant, puis créer « Loyer » 1 500, « Restaurant » 80, « Salaire » 6 000 sans `accountId`, pointer (CA36) | trois mouvements sur Compte courant, valeur 9 420 | api |
| Happy path | `PUT` Revolut puis `null` (CA33, CA34) ; réglage lu en retour | mouvements existants inchangés, nouveaux sur Revolut puis sans compte | api |
| Edge case  | Création avec `accountId: null` ; écart de rapprochement `null` (CA32, CA44) | sans compte, Compte courant reste 5 000 | api |
| Edge case  | Réel rattaché sans champ ; prévision depuis le modèle (CA4, CA31) | compte de la prévision / de la ligne, jamais le défaut | api |
| Edge case  | Livret par défaut, Épargne 500 Versée sur Livret sans `accountId` (CA45) | acceptée sans compte, Livret 10 500 une fois pointée | api |
| Edge case  | Import : ligne libre et ligne allouée | libre = défaut, allouée = suit la prévision | api |
| Edge case  | Supprimer, archiver le compte par défaut (CA35) ; `PUT` d'un élément archivé ou d'un autre utilisateur | réglage `null` ; 404 | api |
| Edge case  | Choisir un défaut (CA30) | aucune ligne de budget, de modèle ni mouvement écrit | system |
| Teardown   | Scripts SQL en `ROLLBACK` | base intacte | system |

## Tasks to do

### `1)` Table du réglage

1. Contract, `safe-after v0.66.2`. `user_default_account (user_id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE, asset_id uuid NOT NULL, updated_at, FOREIGN KEY (asset_id, user_id) REFERENCES asset (id, user_id) ON DELETE CASCADE)`.
2. RLS SELECT/INSERT/UPDATE/DELETE propriétaire, `TO authenticated`, grants ; trigger `updated_at`.
3. Trigger invoker `AFTER UPDATE OF archived_at ON asset … WHEN (NEW.archived_at IS NOT NULL)` qui supprime la ligne du réglage.

### `2)` Route des réglages

1. `userSettingsSchema.defaultAccountId: z.uuid().nullable().default(null)` ; `updateUserSettingsSchema.defaultAccountId: z.uuid().nullable().optional()`.
2. Repository : lecture dans `findSettings` ; `findDefaultAccountId()` (une requête, sans Supabase Auth) ; écriture : `null` supprime, un id actif de l'utilisateur fait un upsert, sinon `ASSET_NOT_FOUND`.

### `3)` Appliquer le défaut à la création

1. `asset-link.ts` : `accountIdForCreate(requested, defaultId, assetId)` — demandé (même `null`) l'emporte ; défaut = `assetId` → `null` ; sinon le défaut.
2. Mouvement libre, prévision, lissage additif, lignes libres de l'import : défaut lu une fois, seulement si `accountId` est absent. Réel rattaché, ligne allouée de l'import, modèle, couple « Remettre sur ton épargne » : jamais.
3. Modules : `UserModule` importé, `USER_REPOSITORY` injecté.

### `4)` Tests et règles

1. `user_default_account.sql` : RLS, FK composite, CA35 suppression et archivage, désarchivage sans retour.
2. Specs : CA28 (route), CA30, CA32, CA33, CA34, CA44, CA45, CA36, import.
3. § Patrimoine : compte par défaut et priorité de CA32.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Migration appliquée ; suppression ou archivage du compte vide le réglage. |
| 2 | `GET` et `PUT /v1/users/settings` portent `defaultAccountId` ; 404 sur un élément archivé ou étranger. |
| 3 | La priorité de CA32 et CA45 tient sur chaque chemin de création. |
| 4 | `bun test`, `bun run quality` et la suite SQL verts ; la section décrit le réglage. |
