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
    @State private var appState = AppState()
    @State private var userSettingsStore: UserSettingsStore
    @State private var currentMonthStore = CurrentMonthStore()
    @State private var budgetListStore = BudgetListStore()
    @State private var dashboardStore = DashboardStore()

    init() {
        AppLocale.persist(.fr)
        _userSettingsStore = State(
            initialValue: UserSettingsStore(service: PreferencesUITestService())
        )
    }

    var body: some View {
        NavigationStack {
            PreferencesView()
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
