---
description: "Swift Testing patterns for iOS unit testing"
paths:
  - "ios/**/*Tests*/**/*.swift"
  - "ios/**/*.swift"
---

# Testing with Swift Testing

## Framework

```swift
import Foundation
@testable import Pulpe
import Testing
```

**NEVER** use `import XCTest` — the entire test suite uses Swift Testing.

## Organization

### File Placement

Tests mirror the source structure:

```
PulpeTests/
├── Domain/
│   ├── Store/          # Store logic tests
│   ├── Models/         # Model tests
│   ├── Services/       # Service tests
│   └── Formulas/       # Formula tests
├── Features/           # ViewModel tests
├── Shared/             # Extension tests
└── Helpers/
    ├── TestDataFactory.swift
    └── AsyncTestHelpers.swift
```

### Test Structure

```swift
@Suite("CurrentMonthStore Tests")
@MainActor
struct CurrentMonthStoreTests {
    @Test func loadBudget_setsDataOnSuccess() async {
        let mockService = MockBudgetService()
        mockService.stubbedBudget = TestDataFactory.createBudget()
        let store = CurrentMonthStore(service: mockService)

        await store.forceRefresh()

        #expect(store.budget != nil)
        #expect(store.budget?.name == "Janvier 2025")
    }
}
```

Key differences from XCTest:
- `struct` (not `final class ... XCTestCase`)
- `@Suite` and `@Test` decorators
- `#expect()` and `#require()` (not `XCTAssert*`)
- No `setUp()` / `tearDown()` — inline setup per test
- `@MainActor` on suites testing `@Observable` stores

## Core Principles

### Language

Write all test code and descriptions in **English**.

### Arrange-Act-Assert

Separate each test into three phases (comments optional for short tests):

```swift
@Test func toggleTransaction_updatesState() async {
    // Arrange
    let transaction = TestDataFactory.createTransaction(isChecked: false)
    let store = makeStore(transactions: [transaction])

    // Act
    await store.toggleTransaction(transaction)

    // Assert
    #expect(store.transactions.first?.isChecked == true)
}
```

### Naming Convention

Use `descriptiveName_condition_expectedBehavior` format (no `test` prefix — `@Test` handles discovery):

```swift
// Good
@Test func defaultFilter_showsOnlyUncheckedItems() { }
@Test func getNextAvailableMonth_withNoBudgets_returnsCurrentMonth() { }
@Test func daysRemainingLogic_calculatesCorrectly() { }

// Bad
@Test func stuff() { }
@Test func test1() { }
@Test func budget() { }
```

### Parameterized Tests

Use `arguments:` for testing multiple inputs:

```swift
@Test("Valid emails are recognized", arguments: [
    "user@example.com",
    "user.name+tag@domain.co",
    "a@b.cd",
])
func isEmailValid_validEmails(email: String) {
    let sut = LoginViewModel()
    sut.email = email
    #expect(sut.isEmailValid, "Expected \(email) to be valid")
}
```

## Assertions

| Swift Testing | XCTest equivalent |
|---|---|
| `#expect(condition)` | `XCTAssertTrue(condition)` |
| `#expect(!condition)` | `XCTAssertFalse(condition)` |
| `#expect(a == b)` | `XCTAssertEqual(a, b)` |
| `#expect(a != nil)` | `XCTAssertNotNil(a)` |
| `let val = try #require(optional)` | `let val = try XCTUnwrap(optional)` |
| `#expect(throws: SomeError.self) { try foo() }` | `XCTAssertThrowsError(try foo())` |

## Test Data Factory

Use a shared factory for mock data:

```swift
enum TestDataFactory {
    static func createBudget(
        id: String = UUID().uuidString,
        name: String = "Test Budget",
        lines: [BudgetLine] = []
    ) -> Budget {
        Budget(id: id, name: name, startDate: .now, endDate: .now, budgetLines: lines)
    }

    static func createTransaction(
        id: String = UUID().uuidString,
        amount: Decimal = 42.0,
        isChecked: Bool = false
    ) -> Transaction {
        Transaction(id: id, amount: amount, isChecked: isChecked, date: .now)
    }
}
```

- Use default parameters for flexibility
- Mirror real model structure
- Keep in `Helpers/TestDataFactory.swift`

## Mocking Services

```swift
// Mock actor for testing
actor MockBudgetService: BudgetServiceProtocol {
    var stubbedBudget: Budget?
    var stubbedError: Error?
    var fetchCallCount = 0

    func getCurrentMonthBudget() async throws -> Budget? {
        fetchCallCount += 1
        if let error = stubbedError { throw error }
        return stubbedBudget
    }
}
```

- Protocol-based mocking (define protocols for services)
- Track call counts for verification
- Stub return values and errors

## Async Testing

```swift
@Test func loadData_setsLoadingState() async {
    let mockService = MockBudgetService()
    mockService.stubbedBudget = TestDataFactory.createBudget()
    let store = CurrentMonthStore(service: mockService)

    await store.forceRefresh()

    #expect(!store.isLoading)
    #expect(store.budget != nil)
}
```

- Use `async` test methods directly
- Use `waitForCondition()` helper from `AsyncTestHelpers.swift` for polling
- Test loading states, success, and error paths

## Formula Testing (Pure Functions)

```swift
struct BudgetFormulasTests {
    @Test func calculateAvailable_subtractsExpenses() {
        let income: Decimal = 3000
        let expenses: Decimal = 1500
        let savings: Decimal = 500

        let available = BudgetFormulas.calculateAvailable(
            income: income,
            expenses: expenses,
            savings: savings
        )

        #expect(available == 1000)
    }
}
```

- Pure function tests: no setup needed
- Test edge cases: zero, negative, overflow
- Test boundary conditions

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `import XCTest` | `import Testing` |
| `final class ... XCTestCase` | `struct` with `@Suite` |
| `XCTAssert*` | `#expect()` / `#require()` |
| `setUp()` / `tearDown()` | Inline setup per test |
| `func testName()` | `@Test func name()` |
| Test implementation details | Test behavior and outcomes |
| Share mutable state between tests | Create fresh instances per test |
| Force unwrap in tests | Use `try #require()` |
| Inline magic values | Use `TestDataFactory` |
| Test private methods directly | Test via public API |
| `XCTestExpectation` for async | Use `async` test methods |
