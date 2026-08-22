# Data layer

TanStack Query owns everything that comes from the API. Zustand owns everything that does
not: the session, the vault state, and UI state that has to outlive a screen. A value that
the server can return is never mirrored into a Zustand store — two sources of truth for the
same number is how the amount on the home screen ends up disagreeing with the amount on the
budget it came from.

## Every data query waits for the vault

Financial amounts come back as AES-256-GCM ciphertext and are decrypted with the client key
that `ApiClient` sends as `X-Client-Key`. That key only exists once the user has unlocked the
vault with their PIN. A query that fires before the unlock therefore goes out without the
header, and the failure is quiet: the request succeeds, and the app renders ciphertext or a
zero.

So every query that reads user data carries the gate:

```ts
const { isUnlocked } = useVaultStore();

useQuery({
  queryKey: budgetKeys.list(),
  queryFn: () => fetchBudgets(),
  enabled: isUnlocked,
});
```

The three endpoints that legitimately run before the unlock are the vault's own
(`/encryption/vault-status`, `/encryption/salt`, `/encryption/validate-key`) and the version
check (`/app/version`). They hold no encrypted column, and gating them would deadlock the
unlock screen on itself.

## Key shape

One `*Keys` object per entity, next to the queries that use it, built so that a prefix
invalidates everything below it:

```ts
export const budgetKeys = {
  all: ["budgets"] as const,
  list: () => [...budgetKeys.all, "list"] as const,
  detail: (id: string) => [...budgetKeys.all, "detail", id] as const,
  lines: (id: string) => [...budgetKeys.all, "detail", id, "lines"] as const,
};
```

`invalidateQueries({ queryKey: budgetKeys.all })` then reaches the list and every detail
without anyone maintaining a list of keys to sweep. Never inline a raw array at a call site —
a key spelled by hand is a key that silently stops matching the one it was meant to pair with.

## Invalidation is the mutation's job, and it crosses entities

A mutation invalidates every entity its write can move, not just the one it named. The
couplings that already exist server-side:

| Mutation                    | Also invalidates                               |
| --------------------------- | ---------------------------------------------- |
| any budget-line write       | the parent budget's detail (totals recompute)  |
| a savings-goal contribution | the goal, its plan, and the budgets it spans   |
| postponing a line           | **both** the source and the destination budget |
| a spread                    | every budget in the spread group               |

The last two are the ones that get missed: they write to a budget the user is not looking at,
so a stale cache shows the right screen with the wrong number.

## Sign-out clears the cache

`session-store` calls `queryClient.clear()` on `SIGNED_OUT`. `clear()` rather than
`invalidateQueries()` — invalidation leaves the data in memory and merely marks it stale, so
the next account to sign in on the device would paint the previous one's amounts for a frame.
