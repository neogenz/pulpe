import Foundation

/// All tracked analytics events. Names match web conventions (`snake_case`, `object_action`).
enum AnalyticsEvent: String, CaseIterable {
    // MARK: - Lifecycle
    case appOpened = "app_opened"

    // MARK: - Onboarding Funnel
    case welcomeScreenViewed = "welcome_screen_viewed"
    case signupStarted = "signup_started"
    case signupCompleted = "signup_completed"
    case onboardingStepCompleted = "onboarding_step_completed"
    case onboardingAbandoned = "onboarding_abandoned"
    /// Fired when a user re-enters onboarding mid-flow after killing/backgrounding the app.
    /// Source is either a pending user slot (cold-start recovery router) or the legacy
    /// `wasEmailRegistered` session fallback.
    case onboardingResumed = "onboarding_resumed"

    // MARK: - Auth
    case loginCompleted = "login_completed"
    case loginFailed = "login_failed"
    case signupFailed = "signup_failed"
    case sessionRestoreFailed = "session_restore_failed"
    case logoutCompleted = "logout_completed"
    case pinSetupCompleted = "pin_setup_completed"
    case pinEntered = "pin_entered"
    case pinChanged = "pin_changed"

    // MARK: - Budget
    case budgetCreated = "budget_created"
    case firstBudgetCreated = "first_budget_created"

    // MARK: - Transaction
    case transactionCreated = "transaction_created"

    // MARK: - Navigation
    case tabSwitched = "tab_switched"
}
