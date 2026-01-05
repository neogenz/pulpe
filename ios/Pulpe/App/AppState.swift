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

    // MARK: - Services

    private let authService: AuthService

    init(authService: AuthService = .shared) {
        self.authService = authService
    }

    // MARK: - Actions

    @MainActor
    func checkAuthState() async {
        authState = .loading

        do {
            if let user = try await authService.validateSession() {
                currentUser = user
                authState = .authenticated
            } else {
                authState = .unauthenticated
            }
        } catch {
            authState = .unauthenticated
        }
    }

    @MainActor
    func login(email: String, password: String) async throws {
        let user = try await authService.login(email: email, password: password)
        currentUser = user
        authState = .authenticated
    }

    @MainActor
    func logout() async {
        await authService.logout()
        currentUser = nil
        authState = .unauthenticated

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
