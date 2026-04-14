import Foundation
import PostHog

/// Central analytics service wrapping PostHog iOS SDK.
/// All callers are @MainActor (SwiftUI views, stores), so MainActor isolation
/// ensures thread-safe access to `isInitialized` without requiring actor hops.
@MainActor
final class AnalyticsService {
    static let shared = AnalyticsService()

    /// PostHog person property keys — must mirror `ANALYTICS_PROPERTIES`
    /// in `shared/src/feature-flags.ts`.
    nonisolated static let earlyAdopterProperty = "early_adopter"

    private(set) var isInitialized = false

    private init() {}

    // MARK: - Setup

    func initialize() {
        guard AppConfiguration.isPostHogEnabled,
              let apiKey = AppConfiguration.postHogApiKey else {
            return
        }

        let config = PostHogConfig(apiKey: apiKey, host: AppConfiguration.postHogHost)
        config.captureScreenViews = false
        config.captureApplicationLifecycleEvents = false
        PostHogSDK.shared.setup(config)

        PostHogSDK.shared.register([
            "environment": AppConfiguration.environment.rawValue,
            "app_version": AppConfiguration.appVersion,
            "platform": "ios"
        ])

        isInitialized = true
    }

    // MARK: - Event Capture

    func capture(_ event: AnalyticsEvent, properties: [String: Any] = [:]) {
        guard isInitialized else { return }
        let sanitized = Self.sanitizeProperties(properties)
        PostHogSDK.shared.capture(event.rawValue, properties: sanitized)
    }

    func captureAuthError(_ event: AnalyticsEvent, error: Error, method: String) {
        let kind = AuthErrorLocalizer.classify(error)
        capture(event, properties: [
            "method": method,
            "error_kind": String(describing: kind),
            "error_message": AuthErrorLocalizer.localize(error)
        ])
    }

    // MARK: - Screen Tracking

    func screen(_ name: String, properties: [String: Any] = [:]) {
        guard isInitialized else { return }
        let sanitized = Self.sanitizeProperties(properties)
        PostHogSDK.shared.screen(name, properties: sanitized)
    }

    // MARK: - User Identity

    func identify(userId: String, properties: [String: Any] = [:]) {
        guard isInitialized else { return }
        let sanitized = Self.sanitizeProperties(properties)
        PostHogSDK.shared.identify(
            userId,
            userProperties: sanitized,
            userPropertiesSetOnce: [
                "first_app_version": AppConfiguration.appVersion
            ]
        )
    }

    func reset() {
        guard isInitialized else { return }
        PostHogSDK.shared.reset()
    }

    // MARK: - Feature Flags

    /// Returns true when the given feature flag is enabled for the current user.
    /// Safe default: returns false before PostHog initializes.
    func isFeatureEnabled(_ key: String) -> Bool {
        guard isInitialized else { return false }
        return PostHogSDK.shared.isFeatureEnabled(key)
    }

    /// Forces PostHog to re-fetch feature flags from the server.
    /// `onComplete` is called on the main actor once the network response has been
    /// applied to the SDK's local cache — safe to read `isFeatureEnabled` inside it.
    /// Call after identify() so person-property-based flags re-evaluate.
    func reloadFeatureFlags(onComplete: (@MainActor @Sendable () -> Void)? = nil) {
        guard isInitialized else { return }
        PostHogSDK.shared.reloadFeatureFlags {
            Task { @MainActor in onComplete?() }
        }
    }

    // MARK: - Lifecycle

    func flush() {
        guard isInitialized else { return }
        PostHogSDK.shared.flush()
    }

    // MARK: - Sanitization

    private static let financialWords: Set<String> = [
        "amount", "balance", "income", "savings", "total",
        "projection", "rollover", "expenses", "available"
    ]

    /// Strips properties containing financial keywords from event data.
    /// Uses word-component matching: splits keys by `_` and checks each component.
    static func sanitizeProperties(_ properties: [String: Any]) -> [String: Any] {
        guard !properties.isEmpty else { return properties }
        return properties.filter { key, _ in
            return !key.split(separator: "_").contains { financialWords.contains(String($0)) }
        }
    }
}
