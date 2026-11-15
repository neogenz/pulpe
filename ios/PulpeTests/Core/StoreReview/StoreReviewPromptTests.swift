import Foundation
@testable import Pulpe
import Testing

@MainActor
struct StoreReviewPromptTests {
    @Test func requests_onFifthMovement_onlyOncePerVersion() async {
        let defaults = Self.isolatedDefaults()
        var requests = 0
        let prompt = Self.prompt(defaults: defaults, version: "1.14.0") { requests += 1 }

        for _ in 1..<StoreReviewPrompt.movementsBeforeRequest { await prompt.recordMovementCreated() }
        #expect(requests == 0)

        await prompt.recordMovementCreated()
        #expect(requests == 1)

        for _ in 1...10 { await prompt.recordMovementCreated() }
        #expect(requests == 1)
    }

    @Test func requests_again_afterFiveMovementsOnNextVersion() async {
        let defaults = Self.isolatedDefaults()
        var requests = 0
        let previous = Self.prompt(defaults: defaults, version: "1.14.0") { requests += 1 }
        for _ in 1...StoreReviewPrompt.movementsBeforeRequest { await previous.recordMovementCreated() }

        let next = Self.prompt(defaults: defaults, version: "1.15.0") { requests += 1 }
        for _ in 1..<StoreReviewPrompt.movementsBeforeRequest { await next.recordMovementCreated() }
        #expect(requests == 1)

        await next.recordMovementCreated()
        #expect(requests == 2)
    }

    @Test func retries_onNextMovement_whenNoSceneWasActive() async {
        let defaults = Self.isolatedDefaults()
        var isActive = false
        var requests = 0
        let prompt = StoreReviewPrompt(
            defaults: defaults,
            appVersion: "1.14.0",
            waitForCalmMoment: {},
            presentReview: { isActive },
            captureRequested: { requests += 1 }
        )
        for _ in 1...StoreReviewPrompt.movementsBeforeRequest { await prompt.recordMovementCreated() }
        #expect(requests == 0)

        isActive = true
        await prompt.recordMovementCreated()
        #expect(requests == 1)
    }

    private static func prompt(
        defaults: UserDefaults,
        version: String,
        onRequest: @escaping @MainActor () -> Void
    ) -> StoreReviewPrompt {
        StoreReviewPrompt(
            defaults: defaults,
            appVersion: version,
            waitForCalmMoment: {},
            presentReview: { true },
            captureRequested: onRequest
        )
    }

    private static func isolatedDefaults() -> UserDefaults {
        let suite = "StoreReviewPromptTests.\(UUID().uuidString)"
        let defaults = UserDefaults(suiteName: suite) ?? .standard
        defaults.removePersistentDomain(forName: suite)
        return defaults
    }
}
