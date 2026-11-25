import SwiftUI

/// The net-worth account screens (PUL-376) on fixed data, flag on, for the accessibility audit
/// and the captures: « Mon patrimoine » and an element's detail, the « Compte » field in each
/// sheet, « Préférences » and « Compte ». `UITEST_NET_WORTH_SCREEN` picks the screen; theme and
/// text size follow the simulator.
struct NetWorthAccountsUITestHarness: View {
    enum Screen: String {
        case list, detail, preferences, account, movement, addLine, templateLine
    }

    @State private var appState = AppState()
    @State private var userSettingsStore = UserSettingsStore(service: NetWorthUITestSettingsService())
    @State private var assetStore = AssetStore(service: NetWorthUITestAssetService())
    @State private var featureFlagsStore: FeatureFlagsStore
    @State private var currentMonthStore = CurrentMonthStore()
    @State private var budgetListStore = BudgetListStore()
    @State private var dashboardStore = DashboardStore()
    @State private var savingsGoalStore = SavingsGoalStore()
    @State private var tagStore = TagStore()
    @State private var uiPreferences = UIPreferencesState()
    /// The app loads the settings at boot, before any sheet: the default account prefills from them.
    @State private var isReady = false
    private let screen: Screen
    private let period = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: nil)

    init() {
        AppLocale.persist(.fr)
        UserDefaults.standard.set(true, forKey: NetWorthIntroGate.storageKey)
        // Its own suite: forcing the flag must not leak into the app's cached value.
        let flags = UserDefaults(suiteName: "uitest.net-worth-accounts") ?? .standard
        flags.set(true, forKey: "pulpe.feature_flags.\(FeatureFlagsStore.netWorthKey)")
        _featureFlagsStore = State(initialValue: FeatureFlagsStore(defaults: flags))
        screen = ProcessInfo.processInfo.environment["UITEST_NET_WORTH_SCREEN"].flatMap(Screen.init) ?? .list

        let appState = AppState()
        appState.authState = .authenticated
        appState.currentUser = UserInfo(id: "net-worth-ui-test", email: "camille@local.test", firstName: "Camille")
        appState.selectedTab = .netWorth
        if screen == .detail { appState.netWorthPath.append(NetWorthDestination.asset(id: "courant")) }
        _appState = State(initialValue: appState)

        #if DEBUG
        let store = CurrentMonthStore()
        let now = Date()
        store.populateForTesting(budget: Budget(
            id: Self.budgetId, month: period.month, year: period.year,
            description: "Budget UI Test", userId: "ui-test-user", templateId: "ui-test-template",
            endingBalance: 2_500, rollover: nil, remaining: 2_500, previousBudgetId: nil,
            createdAt: now, updatedAt: now
        ))
        _currentMonthStore = State(initialValue: store)
        #endif
    }

    private static let budgetId = "net-worth-ui-test-budget"

    var body: some View {
        Group { if isReady { content } else { Color.clear } }
            .suppressesTips()
            .environment(appState)
            .environment(uiPreferences)
            .environment(userSettingsStore)
            .environment(assetStore)
            .environment(featureFlagsStore)
            .environment(currentMonthStore)
            .environment(budgetListStore)
            .environment(dashboardStore)
            .environment(savingsGoalStore)
            .environment(tagStore)
            .environment(appState.toastManager)
            .environment(\.locale, AppLocale.uiLocale(for: .fr))
            .task {
                await userSettingsStore.forceRefresh()
                await assetStore.loadIfNeeded()
                isReady = true
            }
    }

    @ViewBuilder
    private var content: some View {
        @Bindable var state = appState
        switch screen {
        case .list, .detail:
            NavigationStack(path: $state.netWorthPath) {
                NetWorthView()
                    .navigationDestination(for: NetWorthDestination.self) { destination in
                        switch destination {
                        case .asset(let id): AssetDetailView(assetId: id, service: NetWorthUITestAssetService())
                        }
                    }
            }
        case .preferences:
            NavigationStack { PreferencesView() }
        case .account:
            NavigationStack { AccountView() }
        case .movement:
            sheet {
                MovementSheet(context: MovementSheetContext(
                    store: currentMonthStore, budgetId: Self.budgetId, source: .addButton
                ))
            }
        case .addLine:
            sheet {
                AddBudgetLineSheet(
                    budgetId: Self.budgetId, anchorMonth: period.month, anchorYear: period.year
                ) { _ in }
            }
        case .templateLine:
            // Linked to « Livret Raiffeisen » and moved on it too: the conflict message shows.
            sheet {
                EditTemplateLineSheet(
                    templateLine: TemplateLine(
                        id: "template-line", templateId: "template", name: "Épargne mensuelle",
                        amount: 500, kind: .saving, recurrence: .fixed, description: "",
                        createdAt: Date(), updatedAt: Date(),
                        assetId: "raiffeisen", accountId: "raiffeisen"
                    ),
                    templateName: "Mon modèle",
                    userCurrency: .chf
                ) { _, _ in }
            }
        }
    }

    private func sheet(@ViewBuilder _ sheet: @escaping () -> some View) -> some View {
        Color.clear.pulpeBackground().sheet(isPresented: .constant(true), content: sheet)
    }
}

private actor NetWorthUITestSettingsService: UserSettingsServicing {
    private var defaultAccountId: String? = "courant"

    func getSettings() async throws -> UserSettings { settings }

    func updateSettings(_ update: UpdateUserSettings) async throws -> UserSettings {
        if let change = update.defaultAccountId { defaultAccountId = change }
        return settings
    }

    private var settings: UserSettings {
        UserSettings(
            payDayOfMonth: 25, currency: .chf, showCurrencySelector: false, locale: .fr,
            defaultAccountId: defaultAccountId
        )
    }
}

/// A default current account with a month-end projection, an overdraft, an element with no
/// exchange rate, a savings account and a debt: every badge and line the epic adds.
private struct NetWorthUITestAssetService: AssetServicing {
    private static func daysAgo(_ days: Int) -> Date {
        Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
    }

    private static func asset(
        _ id: String, _ name: String, category: String, value: Decimal,
        currency: SupportedCurrency = .chf, direction: AssetDirection = .own, converted: Decimal?? = nil
    ) -> Asset {
        Asset(
            id: id, categoryId: category, name: name, currency: currency, direction: direction,
            inPulpe: id == "courant", archivedAt: nil, latestValue: value, recordedValue: value,
            latestRecordedAt: daysAgo(10), convertedValue: converted ?? value
        )
    }

    private static let assets = [
        asset("courant", "Compte courant", category: "comptes", value: 9_420),
        asset("joint", "Compte joint", category: "comptes", value: -250),
        asset("raiffeisen", "Livret Raiffeisen", category: "epargne", value: 12_000),
        asset("eur", "Livret EUR", category: "epargne", value: 5_000, currency: .eur, converted: .some(nil)),
        asset("credit", "Crédit auto", category: "dettes", value: 8_500, direction: .owe),
    ]

    func getNetWorth() async throws -> NetWorth {
        NetWorth(
            totals: NetWorthTotals(baseCurrency: .chf, gross: 21_170, debts: 8_500, net: 12_670, incomplete: true),
            categories: [
                AssetCategory(id: "comptes", name: "Comptes", total: 9_170),
                AssetCategory(id: "epargne", name: "Épargne", total: 12_000),
                AssetCategory(id: "dettes", name: "Crédits", total: 8_500),
            ],
            assets: Self.assets
        )
    }

    func getHistory(id: String, cursor _: String?) async throws -> AssetHistory {
        guard let asset = Self.assets.first(where: { $0.id == id }) else { throw APIError.assetNotFound }
        let period = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: nil)
        return AssetHistory(
            asset: asset,
            entries: [
                AssetHistoryEntry(sourceId: "courses", at: Self.daysAgo(2), kind: .movement(
                    name: "Courses", effect: -180, supersededAt: nil
                )),
                AssetHistoryEntry(sourceId: "salaire", at: Self.daysAgo(5), kind: .movement(
                    name: "Salaire", effect: 1_600, supersededAt: nil
                )),
                AssetHistoryEntry(sourceId: "saisie", at: Self.daysAgo(10), kind: .snapshot(value: 8_000)),
                AssetHistoryEntry(sourceId: "loyer", at: Self.daysAgo(15), kind: .movement(
                    name: "Loyer", effect: -1_800, supersededAt: Self.daysAgo(10)
                )),
                AssetHistoryEntry(sourceId: "saisie-0", at: Self.daysAgo(20), kind: .snapshot(value: 9_800)),
            ],
            nextCursor: nil,
            monthEndProjection: id == "courant"
                ? AssetMonthEndProjection(month: period.month, year: period.year, value: 7_620)
                : nil
        )
    }

    func create(_: AssetCreate) async throws -> AssetRecord { throw URLError(.unsupportedURL) }
    func update(id _: String, _: AssetUpdate) async throws -> AssetRecord { throw URLError(.unsupportedURL) }
    func delete(id _: String) async throws { throw URLError(.unsupportedURL) }
    func recordSnapshots(_: AssetSnapshotsCreate) async throws -> AssetSnapshotsResult {
        throw URLError(.unsupportedURL)
    }
    func createCategory(_: AssetCategoryWrite) async throws -> AssetCategoryRecord { throw URLError(.unsupportedURL) }
    func renameCategory(id _: String, _: AssetCategoryWrite) async throws -> AssetCategoryRecord {
        throw URLError(.unsupportedURL)
    }
}
