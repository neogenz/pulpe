import Foundation

/// Application configuration loaded from environment or Info.plist
enum AppConfiguration {
    // MARK: - API Configuration

    static var apiBaseURL: URL {
        #if DEBUG
        // Development - use local or staging (includes /api/v1 prefix)
        URL(string: "https://backend-production-e7df.up.railway.app/api/v1")!
        #else
        // Production (includes /api/v1 prefix)
        URL(string: "https://backend-production-e7df.up.railway.app/api/v1")!
        #endif
    }

    // MARK: - Supabase Configuration

    static var supabaseURL: URL {
        #if DEBUG
        URL(string: "https://xvrbcvltpkqwiiexvfxh.supabase.co")!
        #else
        // Production - replace with your Supabase project URL
        URL(string: "https://xvrbcvltpkqwiiexvfxh.supabase.co")!
        #endif
    }

    static var supabaseAnonKey: String {
        #if DEBUG
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmJjdmx0cGtxd2lpZXh2ZnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNjM2NTgsImV4cCI6MjA2NDYzOTY1OH0.xkOV-IR9h5T08YH1_BZ8VevlWF0VCoZDctiO4lbeLmc"
        #else
        // Production - replace with your Supabase anon key
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2cmJjdmx0cGtxd2lpZXh2ZnhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwNjM2NTgsImV4cCI6MjA2NDYzOTY1OH0.xkOV-IR9h5T08YH1_BZ8VevlWF0VCoZDctiO4lbeLmc"
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
