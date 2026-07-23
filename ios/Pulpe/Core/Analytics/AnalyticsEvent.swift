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
    /// Fires when the user taps a suggestion chip in the onboarding charges or
    /// savings steps. Measures which presets matter to funnel the suggestion
    /// catalog by product usage.
    case onboardingSuggestionToggled = "onboarding_suggestion_toggled"
    /// Fires when the user adds a custom row via the "+ Ajouter" sheet or by
    /// toggling a suggestion on. `source` tells which path.
    case customTransactionAdded = "custom_transaction_added"
    /// Fires when the user removes a custom row via swipe, trash, or by
    /// toggling a suggestion off.
    case customTransactionRemoved = "custom_transaction_removed"

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

    // MARK: - Notifications
    /// Fires when the value-framed pre-permission sheet is shown — after the user's
    /// first real "pointer", never at launch. Precedes the OS prompt.
    case notificationPrimeShown = "notification_prime_shown"
    case notificationPermissionGranted = "notification_permission_granted"
    case notificationPermissionDenied = "notification_permission_denied"
    /// Fires when the "Rappels" preference toggle changes. Property `enabled` (Bool).
    case reminderToggled = "reminder_toggled"

    // MARK: - What's New
    /// Fires when the post-update release-notes dialog is shown. Property:
    /// `version` (the running app version the notes are shown for).
    case iosWhatsNewShown = "ios_whats_new_shown"

    // MARK: - Currency
    case currencyChanged = "currency_changed"
    case currencySelectorToggled = "currency_selector_toggled"
    /// Fires when onboarding currency persistence exhausts all retry attempts.
    /// Properties: `currency` (target ISO code), `attempts` (total tried).
    case currencyPersistFailed = "currency_persist_failed"

    // MARK: - Savings Goals
    /// Objectifs first-run intro cover. `viewed` fires on open, then exactly one
    /// of `completed` (final "Créer mon objectif") or `skipped` (Passer / Plus tard).
    case savingsGoalsIntroViewed = "savings_goals_intro_viewed"
    case savingsGoalsIntroCompleted = "savings_goals_intro_completed"
    case savingsGoalsIntroSkipped = "savings_goals_intro_skipped"
}
