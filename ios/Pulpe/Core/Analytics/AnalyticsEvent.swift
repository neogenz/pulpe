import Foundation

/// All tracked analytics events. Names match web conventions (`snake_case`, `object_action`).
enum AnalyticsEvent: String, CaseIterable {
    // MARK: - Lifecycle
    case appOpened = "app_opened"

    // MARK: - Onboarding Funnel
    case welcomeScreenViewed = "welcome_screen_viewed"
    /// Fires once per session when the user enters the multi-step onboarding
    /// flow — either by tapping "S'inscrire avec email" on welcome, or via a
    /// fresh social OAuth that routes them straight into the questionnaire.
    /// Matches the web funnel's `onboarding_started`. Distinct from
    /// `onboardingResumed`, which covers cold-start recovery of an in-progress
    /// signup — `started` = first time, `resumed` = continuing.
    case onboardingStarted = "onboarding_started"
    case signupStarted = "signup_started"
    case signupCompleted = "signup_completed"
    case onboardingStepCompleted = "onboarding_step_completed"
    case onboardingAbandoned = "onboarding_abandoned"
    /// Fires when an email user cold-starts an in-progress signup after
    /// killing or backgrounding the app. Source disambiguates the pending-user
    /// router from the legacy `wasEmailRegistered` session fallback.
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
