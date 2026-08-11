---
status: pending
---

# Instruction: Durcissement `config.toml` auth Supabase

## Architecture projection

```txt
backend-nest/supabase/
└── config.toml   ✏️ enable_confirmations, secure_password_change, commentaires d'alignement prod
```

## Contexte technique (lu avant de coder)

- Décision utilisateur : **corriger le `config.toml` local seul** — la config production vit dans le dashboard Supabase et sera alignée manuellement après vérification des flux signup web + iOS (hors scope de cette phase).
- `config.toml:173` `enable_confirmations = false` et `:175` `secure_password_change = false` sont des valeurs permissives qu'un `supabase config push` propagerait en prod.
- Impact local : l'inscription en environnement de dev exigera une confirmation email (Mailpit/Inbucket local de Supabase) — vérifier que les flux E2E locaux ne cassent pas (`frontend/.env.e2e`, helpers de signup).

## Tasks to do

### `1)` Sécuriser les valeurs auth du config local

> Le fichier de config versionné doit refléter la posture cible, pas la posture permissive.

1. `enable_confirmations = true` avec commentaire : prod à aligner dans le dashboard après validation des flux signup web/iOS.
2. `secure_password_change = true` avec le même commentaire d'alignement.
3. Laisser `minimum_password_length`, OTP et le reste inchangés (constats BASSE, hors scope).

### `2)` Vérifier les flux locaux

> Les tests E2E et le seed local ne doivent pas casser avec la confirmation email activée.

1. `supabase start` puis vérifier le signup local (le mail de confirmation arrive dans Inbucket).
2. Si un helper E2E crée des utilisateurs (seed, fixtures), l'adapter pour confirmer l'email via l'API admin locale ou Mailpit — uniquement si un flux existant casse.

## Test acceptance criteria

| Task | Acceptance criteria                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------ |
| 1    | `config.toml` contient `enable_confirmations = true` et `secure_password_change = true` avec commentaires d'alignement prod |
| 2    | `supabase start` démarre, un signup local reçoit bien son mail de confirmation dans Inbucket, et les flux E2E existants passent |
