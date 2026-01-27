---
description: "XCTest patterns for Swift unit testing"
paths:
  - "ios/**/*Tests*/**/*.swift"
  - "ios/**/*.swift"
---

# Testing with XCTest

## Framework

```swift
import XCTest
@testable import Pulpe
```

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
    └── TestDataFactory.swift
```

### Test Structure

```swift
final class CurrentMonthStoreTests: XCTestCase {

    // MARK: - Properties

    private var store: CurrentMonthStore!
    private var mockService: MockBudgetService!

    // MARK: - Setup

    override func setUp() {
        super.setUp()
        mockService = MockBudgetService()
        store = CurrentMonthStore(service: mockService)
    }

    override func tearDown() {
        store = nil
        mockService = nil
        super.tearDown()
    }

    // MARK: - Tests

    func testLoadBudget_setsDataOnSuccess() async {
        // Given
        mockService.stubbedBudget = TestDataFactory.createBudget()

        // When
        await store.forceRefresh()

        // Then
        XCTAssertNotNil(store.budget)
        XCTAssertEqual(store.budget?.name, "Janvier 2025")
    }
}
```

## Core Principles

### Language

Write all test code and descriptions in **English**.

### Given-When-Then (GWT)

Separate each test into three phases with comments:

```swift
func testToggleTransaction_updatesState() async {
    // Given: A transaction that is not checked
    let transaction = TestDataFactory.createTransaction(isChecked: false)
    store.setTransactions([transaction])

    // When: We toggle it
    await store.toggleTransaction(transaction)

    // Then: It should be checked
    XCTAssertTrue(store.transactions.first?.isChecked ?? false)
}
```

### Naming Convention

Use `testDescriptiveName_expectedBehavior` format (camelCase):

```swift
// Good
func testDefaultFilter_showsOnlyUncheckedItems() { }
func testGetNextAvailableMonth_withNoBudgets_returnsCurrentMonth() { }
func testGetNextAvailableMonth_skipsMultipleTakenMonths() { }
func testDaysRemainingLogic_calculatesCorrectly() { }

// Bad
func testStuff() { }
func test1() { }
func testBudget() { }
```

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
func testLoadData_setsLoadingState() async {
    // Given
    mockService.stubbedBudget = TestDataFactory.createBudget()

    // When
    await store.forceRefresh()

    // Then
    XCTAssertFalse(store.isLoading)
    XCTAssertNotNil(store.budget)
}
```

- Use `async` test methods directly
- No need for `XCTestExpectation` with async/await
- Test loading states, success, and error paths

## Formula Testing (Pure Functions)

```swift
final class BudgetFormulasTests: XCTestCase {

    func testCalculateAvailable_subtractsExpenses() {
        // Given
        let income: Decimal = 3000
        let expenses: Decimal = 1500
        let savings: Decimal = 500

        // When
        let available = BudgetFormulas.calculateAvailable(
            income: income,
            expenses: expenses,
            savings: savings
        )

        // Then
        XCTAssertEqual(available, 1000)
    }
}
```

- Pure function tests: no setup/teardown needed
- Test edge cases: zero, negative, overflow
- Test boundary conditions

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Test implementation details | Test behavior and outcomes |
| Share mutable state between tests | Reset in `setUp()` / `tearDown()` |
| Force unwrap in tests | Use `XCTUnwrap()` or optional assertions |
| Skip GWT structure | Separate Given, When, Then |
| Inline magic values | Use `TestDataFactory` |
| Test private methods directly | Test via public API |
| `XCTestExpectation` for async | Use `async` test methods |
