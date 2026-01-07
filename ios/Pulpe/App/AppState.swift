import SwiftUI

@Observable
final class AppState {
    // MARK: - Auth State

    enum AuthStatus: Equatable {
        case loading
        case unauthenticated
        case authenticated
    }

    private(set) var authState: AuthStatus = .loading
    private(set) var currentUser: UserInfo?

    // MARK: - Navigation

    var selectedTab: Tab = .currentMonth
    var budgetPath = NavigationPath()
    var templatePath = NavigationPath()

    // MARK: - Onboarding & Tutorial

    var hasCompletedOnboarding: Bool = UserDefaults.standard.bool(forKey: "pulpe-onboarding-completed") {
        didSet { UserDefaults.standard.set(hasCompletedOnboarding, forKey: "pulpe-onboarding-completed") }
    }

    private var tutorialCompleted: Bool = UserDefaults.standard.bool(forKey: "pulpe-tutorial-completed") {
        didSet { UserDefaults.standard.set(tutorialCompleted, forKey: "pulpe-tutorial-completed") }
    }

    var showTutorial: Bool {
        !tutorialCompleted && authState == .authenticated
    }

    // MARK: - Biometric

    var biometricEnabled: Bool = UserDefaults.standard.bool(forKey: "pulpe-biometric-enabled") {
        didSet { UserDefaults.standard.set(biometricEnabled, forKey: "pulpe-biometric-enabled") }
    }

    var showBiometricEnrollment = false

    // MARK: - Services

    private let authService: AuthService
    private let biometricService: BiometricService

    init(authService: AuthService = .shared, biometricService: BiometricService = .shared) {
        self.authService = authService
        self.biometricService = biometricService
    }

    // MARK: - Actions

    @MainActor
    func checkAuthState() async {
        authState = .loading

        guard biometricEnabled else {
            // Clear any stale tokens from previous install
            await authService.clearBiometricTokens()
            authState = .unauthenticated
            return
        }

        do {
            if let user = try await authService.validateBiometricSession() {
                currentUser = user
                authState = .authenticated
            } else {
                // No tokens found
                authState = .unauthenticated
            }
        } catch {
            // Face ID cancelled, lockout, or server error - keep tokens for retry button
            authState = .unauthenticated
        }
    }

    @MainActor
    func login(email: String, password: String) async throws {
        let user = try await authService.login(email: email, password: password)
        currentUser = user
        hasCompletedOnboarding = true
        authState = .authenticated

        // Prompt biometric enrollment after successful login
        if shouldPromptBiometricEnrollment() {
            showBiometricEnrollment = true
        }
    }

    @MainActor
    func logout() async {
        await authService.logout()
        currentUser = nil
        authState = .unauthenticated
        biometricEnabled = false

        // Reset navigation
        budgetPath = NavigationPath()
        templatePath = NavigationPath()
        selectedTab = .currentMonth
    }

    @MainActor
    func completeOnboarding(user: UserInfo) {
        currentUser = user
        hasCompletedOnboarding = true
        authState = .authenticated
    }

    func completeTutorial() {
        tutorialCompleted = true
    }

    // MARK: - Biometric Actions

    func shouldPromptBiometricEnrollment() -> Bool {
        biometricService.canUseBiometrics() && !biometricEnabled && authState == .authenticated
    }

    func canRetryBiometric() async -> Bool {
        guard biometricService.canUseBiometrics() else { return false }
        return await authService.hasBiometricTokens()
    }

    @MainActor
    func retryBiometricLogin() async {
        await checkAuthState()
    }

    @MainActor
    func enableBiometric() async {
        guard biometricService.canUseBiometrics() else { return }

        do {
            try await authService.saveBiometricTokens()
            biometricEnabled = true
        } catch {
            // Silently fail - user can retry from settings
        }
    }

    @MainActor
    func disableBiometric() async {
        await authService.clearBiometricTokens()
        biometricEnabled = false
    }
}

// MARK: - Tab

enum Tab: String, CaseIterable, Identifiable {
    case currentMonth = "current-month"
    case budgets = "budgets"
    case templates = "templates"

    var id: String { rawValue }

    var title: String {
        switch self {
        case .currentMonth: "Ce mois-ci"
        case .budgets: "Budgets"
        case .templates: "Modèles"
        }
    }

    var icon: String {
        switch self {
        case .currentMonth: "calendar.badge.clock"
        case .budgets: "calendar"
        case .templates: "doc.text"
        }
    }
}

// MARK: - Navigation Destinations

enum BudgetDestination: Hashable {
    case details(budgetId: String)
}

enum TemplateDestination: Hashable {
    case details(templateId: String)
}
