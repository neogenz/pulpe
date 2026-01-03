import Foundation

/// Application configuration loaded from environment or Info.plist
enum AppConfiguration {
    // MARK: - API Configuration

    static var apiBaseURL: URL {
        #if DEBUG
        // Development - use local or staging (includes /api/v1 prefix)
        URL(string: ProcessInfo.processInfo.environment["API_BASE_URL"] ?? "http://localhost:3000/api/v1")!
        #else
        // Production (includes /api/v1 prefix)
        URL(string: "https://api.pulpe.app/api/v1")!
        #endif
    }

    // MARK: - Supabase Configuration

    static var supabaseURL: URL {
        #if DEBUG
        URL(string: ProcessInfo.processInfo.environment["SUPABASE_URL"] ?? "http://localhost:54321")!
        #else
        // Production - replace with your Supabase project URL
        URL(string: "https://your-project.supabase.co")!
        #endif
    }

    static var supabaseAnonKey: String {
        #if DEBUG
        ProcessInfo.processInfo.environment["SUPABASE_ANON_KEY"]
            ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0"
        #else
        // Production - replace with your Supabase anon key
        "your-production-anon-key"
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

    static let requestTimeout: TimeInterval = 30
    static let resourceTimeout: TimeInterval = 60

    // MARK: - Limits

    static let maxTemplates = 5
    static let maxBudgetYearsAhead = 3
}
