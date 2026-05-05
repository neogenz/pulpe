import Foundation
@testable import Pulpe
import Testing

@MainActor
struct AnalyticsServiceTests {
    private let sut = AnalyticsService.shared

    // MARK: - Event Naming Convention

    @Test func allEventRawValues_areSnakeCase() {
        let snakeCasePattern = /^[a-z][a-z0-9_]*$/
        for event in AnalyticsEvent.allCases {
            #expect(
                event.rawValue.wholeMatch(of: snakeCasePattern) != nil,
                "\(event) raw value '\(event.rawValue)' is not snake_case"
            )
        }
    }

    @Test func eventRawValues_matchWebConvention() {
        #expect(AnalyticsEvent.appOpened.rawValue == "app_opened")
        #expect(AnalyticsEvent.welcomeScreenViewed.rawValue == "welcome_screen_viewed")
        #expect(AnalyticsEvent.signupStarted.rawValue == "signup_started")
        #expect(AnalyticsEvent.signupCompleted.rawValue == "signup_completed")
        #expect(AnalyticsEvent.onboardingStepCompleted.rawValue == "onboarding_step_completed")
        #expect(AnalyticsEvent.loginCompleted.rawValue == "login_completed")
        #expect(AnalyticsEvent.pinSetupCompleted.rawValue == "pin_setup_completed")
        #expect(AnalyticsEvent.budgetCreated.rawValue == "budget_created")
        #expect(AnalyticsEvent.transactionCreated.rawValue == "transaction_created")
        #expect(AnalyticsEvent.tabSwitched.rawValue == "tab_switched")
    }

    // MARK: - Sanitization

    @Test func sanitizeProperties_removesFinancialData() {
        let properties: [String: Any] = [
            "amount": 1500,
            "balance": 3000,
            "income": 5000,
            "savings": 200,
            "total": 9000,
            "ending_balance": 1234,
            "target_amount": 500,
            "available": 800,
            "projection": 1200,
            "rollover": 100,
            "net_income": 4000,
            "expenses_total": 2000,
            "income_total": 6000,
            "savings_total": 1500,
            "budget_amount": 3500,
            "type": "expense",
            "step": "2"
        ]

        let sanitized = AnalyticsService.sanitizeProperties(properties)

        #expect(sanitized["amount"] == nil)
        #expect(sanitized["balance"] == nil)
        #expect(sanitized["income"] == nil)
        #expect(sanitized["savings"] == nil)
        #expect(sanitized["total"] == nil)
        #expect(sanitized["ending_balance"] == nil)
        #expect(sanitized["target_amount"] == nil)
        #expect(sanitized["available"] == nil)
        #expect(sanitized["projection"] == nil)
        #expect(sanitized["rollover"] == nil)
        #expect(sanitized["net_income"] == nil)
        #expect(sanitized["expenses_total"] == nil)
        #expect(sanitized["income_total"] == nil)
        #expect(sanitized["savings_total"] == nil)
        #expect(sanitized["budget_amount"] == nil)
    }

    @Test func sanitizeProperties_removesCompoundFinancialKeys() {
        let properties: [String: Any] = [
            "total_amount": 9000,
            "current_balance": 3000,
            "monthly_income": 5000,
            "monthly_savings": 200,
            "available_budget": 800,
            "type": "expense"
        ]

        let sanitized = AnalyticsService.sanitizeProperties(properties)

        #expect(sanitized["total_amount"] == nil)
        #expect(sanitized["current_balance"] == nil)
        #expect(sanitized["monthly_income"] == nil)
        #expect(sanitized["monthly_savings"] == nil)
        #expect(sanitized["available_budget"] == nil)
        #expect(sanitized["type"] as? String == "expense")
    }

    @Test func sanitizeProperties_preservesNonFinancialData() {
        let properties: [String: Any] = [
            "type": "expense",
            "step": "2",
            "method": "email",
            "tab": "budgets",
            "screen_name": "dashboard"
        ]

        let sanitized = AnalyticsService.sanitizeProperties(properties)

        #expect(sanitized["type"] as? String == "expense")
        #expect(sanitized["step"] as? String == "2")
        #expect(sanitized["method"] as? String == "email")
        #expect(sanitized["tab"] as? String == "budgets")
        #expect(sanitized["screen_name"] as? String == "dashboard")
    }

    @Test func sanitizeProperties_emptyInput_returnsEmpty() {
        let sanitized = AnalyticsService.sanitizeProperties([:])
        #expect(sanitized.isEmpty)
    }

    // MARK: - Guard Paths (not initialized in test environment)

    @Test func capture_whenNotInitialized_doesNotCrash() {
        sut.capture(.appOpened)
        sut.capture(.budgetCreated, properties: ["type": "expense"])
    }

    @Test func screen_whenNotInitialized_doesNotCrash() {
        sut.screen("TestScreen")
        sut.screen("Dashboard", properties: ["tab": "budgets"])
    }

    @Test func identify_whenNotInitialized_doesNotCrash() {
        sut.identify(userId: "test-user")
        sut.identify(userId: "test-user", properties: ["plan": "free"])
    }

    @Test func reset_whenNotInitialized_doesNotCrash() {
        sut.reset()
    }

    @Test func flush_whenNotInitialized_doesNotCrash() {
        sut.flush()
    }

    @Test func eventCapturing_isDisabledInTestEnvironment() {
        // Test xcconfig fallback sets POSTHOG_ENABLED=false → events gated off,
        // even if SDK initialized with the test API key fallback. Flag reads
        // remain available via `isInitialized`.
        #expect(sut.isEventCapturingEnabled == false)
    }
}
