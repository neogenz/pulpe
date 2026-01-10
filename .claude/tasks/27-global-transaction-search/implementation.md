# Implementation: Global Budget Search

## Completed

### Shared Package (`shared/`)
- Added `SearchItemType` enum ('transaction' | 'budget_line')
- Updated `transactionSearchResultSchema` to support both types:
  - Added `itemType` field to distinguish result types
  - Added `recurrence` field (nullable) for budget lines
  - Made `transactionDate` nullable for budget lines
- Updated `index.ts` to export `SearchItemType`

### Backend (`backend-nest/`)
- Added `TransactionSearchQueryDto` and `TransactionSearchResponseDto` in `dto/transaction-swagger.dto.ts`
- Updated `search()` method in `transaction.service.ts`:
  - Queries both `transaction` AND `budget_line` tables
  - Uses ILIKE with PostgREST `*` wildcard for case-insensitive search
  - Enriches results with budget context (budgetName, year, month, monthLabel)
  - Combines and sorts results by year/month descending
  - Limits to 50 total results (25 per table)
- Added `GET /transactions/search?q=` endpoint in `transaction.controller.ts`

### Frontend (`frontend/`)
- Added `search$()` method in `transaction-api.ts`
- Created `SearchTransactionsDialogComponent`:
  - Debounced search input (300ms)
  - Loading state with spinner
  - Results table with period, type icon, name, amount columns
  - Type column shows icon with tooltip: receipt for "Réel", event_note for "Prévision"
  - Empty/initial state handling
  - Click to select and navigate
- Added search button in `budget-list-page.ts` header
- Added `openSearchDialog()` method for navigation

## Key Features

- **Unified search**: Searches across all transactions AND budget lines
- **Type differentiation**: Icon indicator (receipt/event_note) to distinguish results
- **Budget context**: Each result shows budget name and period (year/month)
- **Navigation**: Clicking a result navigates to the corresponding budget

## Test Results

- Typecheck: ✓
- Lint: ✓ (only pre-existing warnings about function line length)
- Quality: ✓

## Files Changed

| File | Changes |
|------|---------|
| `shared/schemas.ts` | Added itemType, recurrence fields to search schema |
| `shared/index.ts` | Exported SearchItemType |
| `backend-nest/.../transaction.service.ts` | Updated search to query both tables |
| `backend-nest/.../transaction.controller.ts` | Search endpoint |
| `backend-nest/.../dto/transaction-swagger.dto.ts` | Search DTOs |
| `frontend/.../transaction-api.ts` | `search$()` method |
| `frontend/.../search-transactions-dialog.ts` | Updated with type column |
| `frontend/.../budget-list-page.ts` | Search button and dialog |

## Usage

Search terms work on:
- **Transactions**: `name` and `category` fields
- **Budget lines**: `name` field

Examples:
- "Loyer" → finds budget lines named "Loyer"
- "Migros" → finds transactions with "Migros" in name or category
- "Abonnements" → finds budget lines like "Abonnements divers"
