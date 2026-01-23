import SwiftUI
import WidgetKit

private enum UserDefaultsKey {
    static let onboardingCompleted = "pulpe-onboarding-completed"
    static let tutorialCompleted = "pulpe-tutorial-completed"
    static let biometricEnabled = "pulpe-biometric-enabled"
}

@Observable @MainActor
final class AppState {
    // MARK: - Auth State

    enum AuthStatus: Equatable {
        case loading
        case unauthenticated
        case authenticated
    }

    private(set) var authState: AuthStatus = .loading
    private(set) var currentUser: UserInfo?

    // MARK: - Maintenance State

    private(set) var isInMaintenance = false

    // MARK: - Navigation

    var selectedTab: Tab = .currentMonth
    var budgetPath = NavigationPath()
    var templatePath = NavigationPath()

    // MARK: - Onboarding & Tutorial

    var hasCompletedOnboarding: Bool = UserDefaults.standard.bool(forKey: UserDefaultsKey.onboardingCompleted) {
        didSet { UserDefaults.standard.set(hasCompletedOnboarding, forKey: UserDefaultsKey.onboardingCompleted) }
    }

    // MARK: - Biometric

    var biometricEnabled: Bool = UserDefaults.standard.bool(forKey: UserDefaultsKey.biometricEnabled) {
        didSet { UserDefaults.standard.set(biometricEnabled, forKey: UserDefaultsKey.biometricEnabled) }
    }

    var showBiometricEnrollment = false

    // MARK: - Services

    private let authService: AuthService
    private let biometricService: BiometricService

    // MARK: - Toast

    let toastManager = ToastManager()

    init(authService: AuthService = .shared, biometricService: BiometricService = .shared) {
        self.authService = authService
        self.biometricService = biometricService
    }

    // MARK: - Actions

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

    func logout() async {
        await authService.logout()
        currentUser = nil
        authState = .unauthenticated
        biometricEnabled = false

        // Clear sensitive widget data
        WidgetDataCoordinator().clear()
        WidgetCenter.shared.reloadAllTimelines()

        // Reset navigation
        budgetPath = NavigationPath()
        templatePath = NavigationPath()
        selectedTab = .currentMonth
    }

    func completeOnboarding(user: UserInfo) {
        currentUser = user
        hasCompletedOnboarding = true
        authState = .authenticated
    }

    func resetTips() {
        ProductTips.resetAllTips()
    }

    // MARK: - Biometric Actions

    func shouldPromptBiometricEnrollment() -> Bool {
        biometricService.canUseBiometrics() && !biometricEnabled && authState == .authenticated
    }

    func canRetryBiometric() async -> Bool {
        guard biometricService.canUseBiometrics() else { return false }
        return await authService.hasBiometricTokens()
    }

    func retryBiometricLogin() async {
        await checkAuthState()
    }

    func enableBiometric() async {
        guard biometricService.canUseBiometrics() else { return }

        do {
            try await authService.saveBiometricTokens()
            biometricEnabled = true
        } catch {
            // Silently fail - user can retry from settings
        }
    }

    func disableBiometric() async {
        await authService.clearBiometricTokens()
        biometricEnabled = false
    }

    // MARK: - Maintenance Actions

    func setMaintenanceMode(_ active: Bool) {
        isInMaintenance = active
    }

    func checkMaintenanceStatus() async {
        do {
            isInMaintenance = try await MaintenanceService.shared.checkStatus()
        } catch {
            // Fail-closed: assume maintenance on error
            isInMaintenance = true
        }
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
