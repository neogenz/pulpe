import Foundation
import PostHog

/// Central analytics service wrapping PostHog iOS SDK.
/// All callers are @MainActor (SwiftUI views, stores), so MainActor isolation
/// ensures thread-safe access to `isInitialized` without requiring actor hops.
@MainActor
final class AnalyticsService {
    static let shared = AnalyticsService()
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
