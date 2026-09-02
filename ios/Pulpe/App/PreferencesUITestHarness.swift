import SwiftUI

private actor PreferencesUITestService: UserSettingsServicing {
    private var locale = SupportedLocale.fr

    func getSettings() async throws -> UserSettings {
        settings
    }

    func updateSettings(_ update: UpdateUserSettings) async throws -> UserSettings {
        locale = update.locale ?? locale
        return settings
    }

    private var settings: UserSettings {
        UserSettings(
            payDayOfMonth: 25,
            currency: .chf,
            showCurrencySelector: false,
            locale: locale
        )
    }
}

struct PreferencesUITestHarness: View {
    @State private var appState: AppState
    @State private var userSettingsStore: UserSettingsStore
    @State private var currentMonthStore = CurrentMonthStore()
    @State private var budgetListStore = BudgetListStore()
    @State private var dashboardStore = DashboardStore()
    private let showsFeedback: Bool

    init() {
        AppLocale.persist(.fr)
        let appState = AppState()
        appState.authState = .authenticated
        appState.currentUser = UserInfo(
            id: "feedback-ui-test",
            email: "feedback@local.test",
            firstName: "Camille"
        )
        _appState = State(initialValue: appState)
        _userSettingsStore = State(
            initialValue: UserSettingsStore(service: PreferencesUITestService())
        )
        showsFeedback = ProcessInfo.processInfo.environment["UITEST_FEEDBACK"] == "1"
    }

    var body: some View {
        Group {
            if showsFeedback {
                AccountView()
            } else {
                NavigationStack {
                    PreferencesView()
                }
            }
        }
        .environment(\.dynamicTypeSize, dynamicTypeSize)
        .preferredColorScheme(preferredColorScheme)
        .environment(appState)
        .environment(userSettingsStore)
        .environment(currentMonthStore)
        .environment(budgetListStore)
        .environment(dashboardStore)
        .environment(appState.toastManager)
        .environment(\.locale, AppLocale.uiLocale(for: userSettingsStore.locale))
    }

    private var dynamicTypeSize: DynamicTypeSize {
        ProcessInfo.processInfo.environment["UITEST_DYNAMIC_TYPE"] == "accessibility3"
            ? .accessibility3
            : .large
    }

    private var preferredColorScheme: ColorScheme? {
        switch ProcessInfo.processInfo.environment["UITEST_COLOR_SCHEME"] {
        case "light": .light
        case "dark": .dark
        default: nil
        }
    }
}
