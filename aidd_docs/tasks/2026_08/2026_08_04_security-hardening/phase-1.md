---
status: pending
---

# Instruction: Purge du dump production local

## Architecture projection

```txt
backend-nest/supabase/
└── 20250927121800_production_data.sql  ❌ dump prod (hash bcrypt, refresh tokens, finances en clair) — gitignoré, jamais commité
AuthKey_MWKLT79BNT.p8                   ✏️ permissions 644 → 600 (fichier racine, non tracké)
```

## Tasks to do

### `1)` Supprimer le dump de production

> Éliminer la seule copie locale en clair des données de production.

1. Vérifier que le fichier n'est tracké nulle part : `git log --all --oneline -- "*production_data*"` (doit être vide).
2. Supprimer `backend-nest/supabase/20250927121800_production_data.sql`.
3. Chercher d'autres copies dans le workspace : `rg -l '\$2a\$10\$' --hidden -g '!node_modules' -g '!.git'` à la racine (doit ne rien retourner après suppression).

### `2)` Restreindre les permissions de la clé Apple

> La clé privée App Store Connect ne doit être lisible que par son propriétaire.

1. `chmod 600 AuthKey_MWKLT79BNT.p8`.
2. Vérifier `ls -l AuthKey_MWKLT79BNT.p8` → `-rw-------`.

### `3)` Rotation manuelle (hors code, à faire par l'utilisateur)

> Le hash bcrypt du compte propriétaire a existé en clair : changer le mot de passe par précaution.

1. L'utilisateur change le mot de passe du compte propriétaire dans Supabase Auth (dashboard) et révoque les sessions actives.

## Test acceptance criteria

| Task | Acceptance criteria                                                              |
| ---- | -------------------------------------------------------------------------------- |
| 1    | Le fichier n'existe plus ; aucun hash bcrypt (`$2a$10$`) n'est trouvé dans le workspace hors `node_modules`/`.git` |
| 2    | `AuthKey_MWKLT79BNT.p8` a des permissions `-rw-------`                            |
| 3    | L'utilisateur confirme la rotation du mot de passe (action manuelle, hors CI)     |
