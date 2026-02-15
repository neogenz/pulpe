import Foundation

/// Application configuration loaded from environment or Info.plist
enum AppConfiguration {
    // MARK: - API Configuration

    static var apiBaseURL: URL {
        #if DEBUG
        // Development - use local or staging (includes /api/v1 prefix)
        if let urlString = ProcessInfo.processInfo.environment["API_BASE_URL"],
           let url = URL(string: urlString) {
            return url
        }
        return URL(string: "http://localhost:3000/api/v1")!
        #else
        // Production - read from Info.plist
        guard let urlString = Bundle.main.infoDictionary?["API_BASE_URL"] as? String,
              let url = URL(string: urlString) else {
            fatalError("API_BASE_URL not configured in Info.plist")
        }
        return url
        #endif
    }

    // MARK: - Supabase Configuration

    static var supabaseURL: URL {
        #if DEBUG
        if let urlString = ProcessInfo.processInfo.environment["SUPABASE_URL"],
           let url = URL(string: urlString) {
            return url
        }
        return URL(string: "http://localhost:54321")!
        #else
        // Production - read from Info.plist
        guard let urlString = Bundle.main.infoDictionary?["SUPABASE_URL"] as? String,
              let url = URL(string: urlString) else {
            fatalError("SUPABASE_URL not configured in Info.plist")
        }
        return url
        #endif
    }

    static var supabaseAnonKey: String {
        #if DEBUG
        return ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"]
            ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        #else
        // Production - read from Info.plist
        guard let key = Bundle.main.infoDictionary?["SUPABASE_ANON_KEY"] as? String else {
            fatalError("SUPABASE_ANON_KEY not configured in Info.plist")
        }
        return key
        #endif
    }

    // MARK: - Feature Flags

    static var isDemoModeEnabled: Bool {
        #if DEBUG
        true
        #else
        false
        #endif
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
}
