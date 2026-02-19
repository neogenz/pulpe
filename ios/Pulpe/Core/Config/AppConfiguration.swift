import Foundation

/// Application runtime configuration loaded from Info.plist.
enum AppConfiguration {
    enum Environment: String {
        case local
        case preview
        case prod
    }

    // MARK: - API Configuration

    static var apiBaseURL: URL {
        guard let url = URL(string: requiredValue(for: "API_BASE_URL")) else {
            fatalError("API_BASE_URL is invalid")
        }
        return url
    }

    // MARK: - Supabase Configuration

    static var supabaseURL: URL {
        guard let url = URL(string: requiredValue(for: "SUPABASE_URL")) else {
            fatalError("SUPABASE_URL is invalid")
        }
        return url
    }

    static var supabaseAnonKey: String {
        requiredValue(for: "SUPABASE_ANON_KEY")
    }

    static var environment: Environment {
        guard let environment = Environment(rawValue: requiredValue(for: "APP_ENV")) else {
            fatalError("APP_ENV is invalid. Expected one of: local, preview, prod")
        }
        return environment
    }

    // MARK: - Auth Redirects

    static var passwordResetRedirectURL: URL {
        URL(string: "pulpe://reset-password")!
    }

    // MARK: - Feature Flags

    static var isDemoModeEnabled: Bool {
        environment != .prod
    }

    // MARK: - App Info

    static var appVersion: String {
        Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    }

    static var buildNumber: String {
        Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    }

    static var bundleIdentifier: String {
        Bundle.main.bundleIdentifier ?? "app.pulpe.ios"
    }

    // MARK: - Timeouts

    static let requestTimeout: TimeInterval = 10
    static let resourceTimeout: TimeInterval = 30

    // MARK: - Limits

    static let maxTemplates = 5
    static let maxBudgetYearsAhead = 3
    
    // MARK: - Cache Durations
    
    /// Cache validity for frequently changing data (budgets, transactions)
    /// Short duration to ensure multi-device sync stays fresh
    static let shortCacheValidity: TimeInterval = 30
    
    /// Cache validity for historical/aggregated data (dashboard trends)
    /// Longer duration since this data changes less frequently
    static let longCacheValidity: TimeInterval = 300
    
    /// Debounce delay for widget sync to avoid excessive reloads
    static let widgetSyncDebounceDelay: TimeInterval = 1.0
    
    // MARK: - Security
    
    /// Grace period before requiring PIN re-entry after backgrounding (RG-006)
    static let backgroundGracePeriod: Duration = .seconds(30)
    
    /// Minimum PIN length
    static let minPinLength = 4

    // MARK: - Private

    private static func requiredValue(for key: String) -> String {
        if let value = ProcessInfo.processInfo.environment[key], !value.isEmpty {
            return value
        }

        if let value = Bundle.main.object(forInfoDictionaryKey: key) as? String,
           !value.isEmpty {
            guard !value.contains("$(") else {
                fatalError("\(key) is unresolved. Check your build configuration and xcconfig mapping.")
            }

            return value
        }

        if isRunningTests, let fallback = testFallbackValue(for: key) {
            return fallback
        }

        fatalError("\(key) not configured in Info.plist")
    }

    private static var isRunningTests: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    private static func testFallbackValue(for key: String) -> String? {
        switch key {
        case "API_BASE_URL":
            return "http://localhost:3000/api/v1"
        case "SUPABASE_URL":
            return "http://127.0.0.1:54321"
        case "SUPABASE_ANON_KEY":
            return "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH"
        case "APP_ENV":
            return "local"
        default:
            return nil
        }
    }
}
