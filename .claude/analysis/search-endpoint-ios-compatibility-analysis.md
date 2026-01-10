# Search Endpoint iOS Compatibility Analysis

**Subject**: Is the search endpoint from this branch usable in the iOS app?

**Solution**: **Yes, the endpoint is fully compatible** with the iOS app. The iOS app already has the infrastructure to consume it - you only need to add the endpoint definition and a Swift model for the response.

## Options Evaluated

### Option 1: Add Search to iOS (Recommended)

- **Implementation**: Add endpoint case to `Endpoints.swift`, create `TransactionSearchResult` Swift model, add method to `TransactionService`
- **Pros**:
  - Backend already provides JSON response in standard `APIResponse` wrapper
  - Authentication (JWT Bearer) already handled by `APIClient`
  - Response format (`{ success: true, data: [...] }`) matches iOS `APIResponse<T>` decoder
- **Cons**:
  - Requires adding Swift model to match Zod schema
  - Need to implement search UI in iOS
- **Code Impact**: 3 files to modify in iOS (`Endpoints.swift`, `TransactionService.swift`, new model file)

### Option 2: Do Nothing

- **Implementation**: Leave iOS app without search functionality
- **Pros**: No development effort
- **Cons**: Feature parity gap between web and iOS

## Technical Analysis

### Backend Endpoint (Already Implemented)

**File:** `backend-nest/src/modules/transaction/transaction.controller.ts:106-137`

```typescript
@Get('search')
async search(
  @Query('q') query: string,
  @SupabaseClient() supabase: AuthenticatedSupabaseClient,
): Promise<TransactionSearchResponse> {
  if (!query || query.length < 2) {
    throw new BadRequestException(
      'Le terme de recherche doit contenir au moins 2 caractères',
    );
  }
  return this.transactionService.search(query, supabase);
}
```

- **Route**: `GET /transactions/search?q=<query>`
- **Auth**: Protected by `AuthGuard` (JWT Bearer token)
- **Validation**: Minimum 2 characters for query parameter
- **Response**: Standard `{ success: true, data: TransactionSearchResult[] }` format

### Response Schema (Shared)

**File:** `shared/schemas.ts:282-314`

```typescript
export const transactionSearchResultSchema = z.object({
  id: z.uuid(),
  itemType: searchItemTypeSchema,        // 'transaction' | 'budget_line'
  name: z.string(),
  amount: z.number(),
  kind: transactionKindSchema,           // 'income' | 'expense' | 'saving'
  recurrence: transactionRecurrenceSchema.or(z.null()),
  transactionDate: z.iso.datetime({ offset: true }).or(z.null()),
  category: z.string().nullable(),
  budgetId: z.uuid(),
  budgetName: z.string(),
  year: z.number().int(),
  month: z.number().int(),
  monthLabel: z.string(),
});
```

### iOS Infrastructure Compatibility

| Aspect | Backend | iOS | Status |
|--------|---------|-----|--------|
| Auth | JWT Bearer | `APIClient` adds token automatically | ✅ Compatible |
| Response wrapper | `{ success, data }` | `APIResponse<T>` decoder | ✅ Compatible |
| Date format | ISO8601 | `Formatters.iso8601WithFractional` | ✅ Compatible |
| HTTP method | GET | Supported in `HTTPMethod` enum | ✅ Compatible |
| Query params | `?q=` | Need to add URL encoding | ⚠️ Minor work |

### iOS Files Requiring Changes

1. **`Endpoints.swift`** - Add search case:
```swift
// Add to enum Endpoint
case transactionsSearch(query: String)

// Add to path computed property
case .transactionsSearch(let query):
    return "/transactions/search?q=\(query.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? query)"
```

2. **New model file** - `TransactionSearchResult.swift`:
```swift
enum SearchItemType: String, Codable, Sendable {
    case transaction
    case budgetLine = "budget_line"
}

struct TransactionSearchResult: Identifiable, Codable, Sendable {
    let id: String
    let itemType: SearchItemType
    let name: String
    let amount: Decimal
    let kind: TransactionKind
    let recurrence: TransactionRecurrence?
    let transactionDate: Date?
    let category: String?
    let budgetId: String
    let budgetName: String
    let year: Int
    let month: Int
    let monthLabel: String
}
```

3. **`TransactionService.swift`** - Add search method:
```swift
func search(query: String) async throws -> [TransactionSearchResult] {
    try await apiClient.request(.transactionsSearch(query: query), method: .get)
}
```

## Code References

- `backend-nest/src/modules/transaction/transaction.controller.ts:106-137` - Search endpoint
- `backend-nest/src/modules/transaction/transaction.service.ts:771-927` - Search service implementation
- `shared/schemas.ts:279-314` - Zod schemas for search response
- `ios/Pulpe/Core/Network/APIClient.swift:49-74` - Generic request method
- `ios/Pulpe/Core/Network/APIResponse.swift:4-32` - Response wrapper decoder
- `ios/Pulpe/Core/Network/Endpoints.swift:32-35` - Current transaction endpoints
- `ios/Pulpe/Domain/Services/TransactionService.swift:16-18` - Pattern for service methods

## Recommendation Rationale

The search endpoint is **100% compatible** with the existing iOS architecture because:

1. **Standard API contract**: The backend returns `{ success: true, data: [...] }` which the iOS `APIResponse<T>` generic decoder already handles.

2. **Authentication reuse**: JWT tokens are automatically injected by `APIClient` via `KeychainManager`.

3. **Established patterns**: The iOS app already consumes similar transaction endpoints (`transactionsByBudget`, `transactionsCreate`). Adding search follows the exact same pattern.

4. **Type safety**: You can create a Swift model that mirrors the Zod schema in `shared/schemas.ts` - all types have Swift equivalents.

The only work required is:
- Add 1 endpoint case (~5 lines)
- Create 1 model struct (~20 lines)
- Add 1 service method (~3 lines)
- Build the search UI (separate task)
