# APEX Task: 01-fix-budget-detail-panel-bugs

**Created:** 2026-01-19T21:10:00.000Z
**Task:** Corriger les bugs du budget-detail-panel: erreur 400 lors de l'ajout de transaction + bouton delete non fonctionnel

---

## Configuration

| Flag | Value |
|------|-------|
| Auto mode (`-a`) | true |
| Examine mode (`-x`) | false |
| Save mode (`-s`) | true |
| Test mode (`-t`) | false |
| Economy mode (`-e`) | false |
| Branch mode (`-b`) | false |
| PR mode (`-pr`) | false |
| Interactive mode (`-i`) | false |
| Branch name | N/A |

---

## User Request

```
Il faut corriger un bug : depuis le budget-detail-panel.ts, quand j'ajoute une transaction alloué, j'ai une erreur 400, qui casse en plus le refresh et le cache du détails du budget dans le container dessous ...

voici la réponse serveur:
{
    "success": false,
    "statusCode": 400,
    "message": {
        "statusCode": 400,
        "message": "Validation failed",
        "errors": [
            {
                "origin": "string",
                "code": "invalid_format",
                "format": "datetime",
                "path": ["checkedAt"],
                "message": "Invalid ISO datetime"
            }
        ]
    },
    "error": "ZodValidationException"
}

De plus, je peux pas supprimer une transaction depuis ce panel, il ne se passe rien quand je clic sur le bouton delete.
```

---

## Identified Bugs

### Bug 1: Erreur 400 - checkedAt invalid datetime
- **Symptom:** POST /api/v1/transactions returns 400
- **Cause:** `checkedAt` field has invalid ISO datetime format
- **Impact:** Transaction creation fails, breaks refresh and cache

### Bug 2: Delete transaction non fonctionnel
- **Symptom:** Click on delete button does nothing
- **Cause:** To be investigated
- **Impact:** Cannot delete transactions from detail panel

---

## Acceptance Criteria

- [ ] AC1: Adding a transaction from the detail panel works without 400 error
- [ ] AC2: Budget details refresh correctly after adding a transaction
- [ ] AC3: Delete transaction button works and removes the transaction
- [ ] AC4: No regression on existing functionality

---

## Progress

| Step | Status | Timestamp |
|------|--------|-----------|
| 00-init | ✓ Complete | 2026-01-19T21:10:00.000Z |
| 01-analyze | ⏸ Pending | |
| 02-plan | ⏸ Pending | |
| 03-execute | ⏸ Pending | |
| 04-validate | ⏸ Pending | |
| 05-examine | ⏭ Skip | |
| 06-resolve | ⏭ Skip | |
| 07-tests | ⏭ Skip | |
| 08-run-tests | ⏭ Skip | |
| 09-finish | ⏭ Skip | |
