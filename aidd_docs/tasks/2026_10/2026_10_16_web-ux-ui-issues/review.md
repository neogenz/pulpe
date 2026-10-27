# Review: reconcile dialog inputs + optional MCP wrapping key

- **Verdict**: approve
- **Diff**: `HEAD...working-tree`
- **Axes run**: code, functional, relevancy
- **Date**: 2026_10_16
- **Findings**: 0 critical, 0 warning, 0 minor

## Phases

### Phase 1 — Reconcile dialog inputs read as inputs

- [x] Account name is a labelled outlined field on every row, first included — `reconcile-accounts-dialog.html:47-67`
- [x] Overdraft is an explicit checkbox bound to the typed sign — `reconcile-accounts-dialog.html:115-122`, `reconcile-accounts-dialog.ts:250-257`
- [x] Typed account name stays inside `ph-no-capture`, field stays typeable when amounts are hidden — `reconcile-accounts-dialog.html:50`, `styles.scss:544`, `reconcile-accounts-dialog.spec.ts:237`
- [x] Dead key `accounts.overdraft` removed from all four catalogs — `public/i18n/{fr,en,de,it}.json`
- [x] Specs follow the new indices and the checkbox — `reconcile-accounts-dialog.spec.ts:192-385` (23/23 green)

### Phase 2 — Missing MCP_WRAPPING_KEY does not block a local boot

- [x] Key optional while MCP is off outside production — `environment.ts:72-80,135-146`, `environment.spec.ts:81-102`
- [x] Still required when MCP is configured or production-like — `environment.ts:136-138`, `environment.spec.ts:86-101`
- [x] Keyless credential access fails loudly instead of at boot — `supabase-mcp-oauth.repository.ts:56-74`, `mcp-oauth.spec.ts:154-159`
- [x] Backend boots locally with no key ("Nest application successfully started") — `main.ts:543`
- [x] A `.env` copied from `.env.example` boots: placeholder commented out — `backend-nest/.env.example:79-81`
- [x] Wrapping-key comment matches the optional schema — `aes-gcm.crypto-service.ts:80-81`

## Findings

None.

## Verification

| Metric        | Value |
| ------------- | ----- |
| Verified      | 100% (11/11) |
| Files checked | reconcile-accounts-dialog.{html,scss,ts,spec.ts}, i18n/{fr,en,de,it}.json, environment.ts, environment.spec.ts, main.ts, supabase-mcp-oauth.repository.ts, mcp-oauth.spec.ts, aes-gcm.crypto-service.ts, .env.example |
| Unchecked     | none |
| Unplanned     | none |
