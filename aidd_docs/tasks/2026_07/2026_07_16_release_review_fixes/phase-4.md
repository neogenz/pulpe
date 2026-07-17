---
status: done
---

# Instruction: Types — régénérer database.types.ts sur une DB locale propre

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
backend-nest/src/types/
└── database.types.ts    ✏️ purge des types fantômes PUL-18 (tag, budget_line_tag, transaction_tag, replace_*_tags) par régénération
```

## Tasks to do

### `1)` Reset DB locale + régénération

> Les types actuels ont été générés sur une DB polluée par un worktree sibling (PUL-18 non mergée sur preview).

1. **Demander confirmation à l'utilisateur** avant tout reset (DB locale partagée entre worktrees; un sibling peut avoir des données en cours).
2. Depuis le **repo principal** (pas le worktree — montages kong): `supabase db reset --local` pour rejouer uniquement les migrations de preview.
3. Rejouer le seed chiffré (script encrypt-seed) — sinon montants à 0 en local; re-login PIN 1234.
4. Dans `backend-nest` du worktree: `bun run generate-types:local`, puis `bun run format` (le générateur sort sans point-virgules).
5. Vérifier le diff: seuls les objets fantômes PUL-18 disparaissent (`tag`, `budget_line_tag`, `transaction_tag`, `replace_budget_line_tags`, `replace_transaction_tags`); les types savings-goal restent intacts.
6. Gate: `bun run quality` + `bun test` backend verts (aucun code live ne référence les types fantômes — la review l'a prouvé — donc zéro breakage attendu).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `grep -E "budget_line_tag|transaction_tag|replace_budget_line_tags" backend-nest/src/types/database.types.ts` ne matche plus rien; type-check + tests backend verts; le diff ne touche que des suppressions de types fantômes |
