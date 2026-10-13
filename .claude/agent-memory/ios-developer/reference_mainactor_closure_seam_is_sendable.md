---
name: mainactor-closure-seam-is-sendable
description: A `@MainActor (…) -> Void` parameter type is implicitly @Sendable in Swift 6, so a test recorder closure capturing a local var fails to convert; drop the annotation on a seam inside an already-@MainActor method
metadata:
  type: reference
---

Swift 6 treats a global-actor-isolated function type as `@Sendable`. A test-seam parameter
typed `send: @MainActor (Event, [String: Any]) -> Void` therefore rejects the usual test
recorder (`var sent = []; let record = { sent.append(...) }`) with
`converting non-Sendable function value to '@MainActor @Sendable (...)' may introduce data races`.

When the method itself is already `@MainActor` (an `@Observable @MainActor` store/state
extension) and the closure is non-escaping, leave the parameter type un-annotated: the
default `{ AnalyticsService.shared.capture($0, properties: $1) }` still compiles (isolated
default argument), and the test recorder needs no `nonisolated(unsafe)`.

`AnalyticsService.shared` has no recording test double; event-emission tests go through an
injected capture closure (`FirstTransactionTracker.init(captureFirstTransaction:)`,
`OnboardingState.capturePaused(send:)`).
