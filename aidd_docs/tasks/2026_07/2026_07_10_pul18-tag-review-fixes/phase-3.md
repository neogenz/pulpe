---
status: done
---

# Instruction: Shared tag-junction helper (findings #4, #5, #10)

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
backend-nest/src/
├── common/utils/
│   ├── tag-links.util.ts                                            ✅ replaceTagLinks() + fetchTagIds() (~50 lines)
│   └── tag-links.util.spec.ts                                       ✅ error mapping 23503/42501 → TAG_NOT_FOUND, fallback def
└── modules/
    ├── budget-line/infrastructure/persistence/
    │   └── supabase-budget-line.repository.ts                       ✏️ thin wrapper delegates; toggleCheckRpc refetch via fetchTagIds (~-48 lines)
    ├── transaction/infrastructure/persistence/
    │   └── supabase-transaction.repository.ts                       ✏️ same (~-48 lines)
    └── budget-template/infrastructure/persistence/
        └── supabase-budget-template.repository.ts                   ✏️ wrapper + operation param threaded from 2 call sites (#10) (~-30 lines)
```

## Tasks to do

### `1)` Extract `replaceTagLinks` helper (#4)

> One implementation of the replace-set contract; three thin per-domain wrappers.

1. Create `common/utils/tag-links.util.ts` with the findings' signature: `{ rpcName: 'replace_transaction_tags' | 'replace_budget_line_tags' | 'replace_template_line_tags', rpcIdParam, entityId, tagIds, operation, entityType, fallbackErrorDef }` — static literals per call site, no dynamic SQL.
2. Keep the per-domain `BusinessException`/`ERROR_DEFINITIONS` contract: 23503/42501 → `TAG_NOT_FOUND`, anything else → the caller's `fallbackErrorDef` (error-handling-backend rule).
3. Each repository's private method becomes a ~10-line wrapper; delete the triplicated bodies.

### `2)` Extract post-toggle tag refetch (#4)

> The two "RPC returns bare row, refetch links" blocks collapse into one helper.

1. `fetchTagIds(supabase, junctionTable: 'transaction_tag' | 'budget_line_tag', fkColumn, entityId, operation, fallbackErrorDef)` in the same file.
2. Rewire `budget-line.toggleCheckRpc` (~794-819) and `transaction.toggleCheck` (~437-454).

### `3)` Thread `operation` through template tag calls (#10)

> Template-line tag failures become distinguishable in structured logs.

1. `insertLine`, `updateLine`, and the phase-2 bulk error mapping each pass their own operation name (`'insertLine'`, `'updateLine'`, `'bulkApplyTemplateLineOperations'`) — the helper signature already carries it.

### `4)` Re-measure file sizes (#5)

> The extraction itself is the file-size fix; no separate splitting.

1. `wc -l` on the 3 repositories: budget-line expected back under the 1000-line ceiling (~968). Record the numbers; do NOT start further decomposition.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1    | All existing repository/use-case specs stay green; a stale tag id still yields `ERR_TAG_NOT_FOUND` with the same HTTP status on all 3 entities. |
| 2    | Toggle-check responses still carry `tagIds`; helper spec covers the refetch error path. |
| 3    | The `operation` field in the exception logging context differs between create/update/bulk template-line tag failures. |
| 4    | `supabase-budget-line.repository.ts` ≤ 1000 lines. |
