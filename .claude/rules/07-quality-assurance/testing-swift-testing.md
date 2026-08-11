---
description: "Swift Testing patterns for iOS unit testing"
paths:
  - "ios/PulpeTests/**/*.swift"
  - "ios/PulpeUITests/**/*.swift"
---

# Testing with Swift Testing

`PulpeTests/` is Swift Testing end to end — `struct` suites with `@Suite`/`@Test`,
`#expect()`/`#require()`, inline setup, `@MainActor` on suites testing `@Observable` stores.
**NEVER** `import XCTest` there.

**Exception — `PulpeUITests/` requires XCTest.** XCUITest (`XCUIApplication`, `XCTestCase`)
has no Swift Testing equivalent, so every file there is `import XCTest` +
`final class … : XCTestCase`. Everything below targets `PulpeTests/` only.

Tests mirror the source structure. Shared helpers live in `Helpers/`:
`TestDataFactory` for model builders, `waitForCondition()` in `AsyncTestHelpers.swift` for
polling. Test names read `descriptiveName_condition_expectedBehavior`, no `test` prefix.

## `#expect` breaks on `rethrows` higher-order calls

`#expect(...)` emits `error: call can throw, but it is not marked with 'try' and the error is
not handled` when the asserted expression contains a `rethrows` higher-order call —
`allSatisfy(\.x)`, `allSatisfy { … }`, `contains(where:)`, `contains { … }`. The macro's
expansion cannot prove the rethrows is non-throwing, and adding `try` then warns "no throwing
calls". Extract to a `let` first:

```swift
let allPast = items.allSatisfy(\.isPast)
#expect(allPast)            // NOT #expect(items.allSatisfy(\.isPast))
```

## `-only-testing:` can select zero tests and still pass

On a Swift Testing suite, a `-only-testing:` filter that matches nothing prints
`** TEST SUCCEEDED **`. Read the executed count before believing a green run.

Swift 6 concurrency in tests — `nonisolated(unsafe)` for captured `var`, `Task.init` instead
of `TaskGroup.addTask` — is in `swift.md`, which loads on the same files.

## Anti-Patterns

| Don't | Do |
|-------|-----|
| `import XCTest` in `PulpeTests/` | `import Testing` (`PulpeUITests/` stays on XCTest) |
| `final class … XCTestCase` in `PulpeTests/` | `struct` with `@Suite` |
| `setUp()` / `tearDown()` | Inline setup per test |
| `#expect(items.allSatisfy(...))` | Extract to a `let`, assert the plain bool |
| Force unwrap in tests | `try #require()` |
| Inline magic values | `TestDataFactory` |
| Testing private methods directly | Test via the public API |
| `XCTestExpectation` for async | `async` test methods |
| Sharing mutable state between tests | Fresh instance per test |
