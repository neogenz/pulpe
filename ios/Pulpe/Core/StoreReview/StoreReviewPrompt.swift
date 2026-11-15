import StoreKit
import UIKit

/// Asks for an App Store rating once Pulpe has been used for real: after the fifth movement
/// recorded since the last request, at most once per app version, never at launch. Apple
/// caps the prompt at three a year and decides on its own whether it shows. Nothing is asked
/// beforehand: filtering who sees the prompt is review gating, which both stores forbid.
@MainActor
final class StoreReviewPrompt {
    static let shared = StoreReviewPrompt()
    static let movementsBeforeRequest = 5

    private let defaults: UserDefaults
    private let appVersion: String
    private let waitForCalmMoment: @Sendable () async -> Void
    private let presentReview: @MainActor () -> Bool
    private let captureRequested: @MainActor () -> Void
    private var isRequesting = false

    init(
        defaults: UserDefaults = .standard,
        appVersion: String = AppConfiguration.appVersion,
        waitForCalmMoment: @escaping @Sendable () async -> Void = {
            // The add sheet is still closing when the movement lands; Apple's own sample waits too.
            try? await Task.sleep(for: .seconds(2))
        },
        presentReview: @escaping @MainActor () -> Bool = StoreReviewPrompt.presentInActiveScene,
        captureRequested: @escaping @MainActor () -> Void = {
            AnalyticsService.shared.capture(.storeReviewRequested, properties: ["source": "automatic"])
        }
    ) {
        self.defaults = defaults
        self.appVersion = appVersion
        self.waitForCalmMoment = waitForCalmMoment
        self.presentReview = presentReview
        self.captureRequested = captureRequested
    }

    /// Call once the server accepted a new movement.
    func recordMovementCreated() async {
        let count = defaults.integer(forKey: Key.movementCount) + 1
        defaults.set(count, forKey: Key.movementCount)
        guard !isRequesting,
              count >= Self.movementsBeforeRequest,
              defaults.string(forKey: Key.lastRequestedVersion) != appVersion else { return }
        isRequesting = true
        defer { isRequesting = false }
        await waitForCalmMoment()
        // Backgrounded meanwhile: the next movement tries again.
        guard presentReview() else { return }
        defaults.set(appVersion, forKey: Key.lastRequestedVersion)
        defaults.set(0, forKey: Key.movementCount)
        captureRequested()
    }

    private static func presentInActiveScene() -> Bool {
        guard let scene = UIApplication.shared.connectedScenes
            .first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene else { return false }
        AppStore.requestReview(in: scene)
        return true
    }

    private enum Key {
        static let movementCount = "pulpe.store-review.movement-count"
        static let lastRequestedVersion = "pulpe.store-review.last-requested-version"
    }
}
