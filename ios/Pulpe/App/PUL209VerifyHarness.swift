// swiftlint:disable function_body_length function_parameter_count large_tuple
#if DEBUG
import SwiftUI
import UIKit

/// DEBUG-only priming flags read by `BudgetDetailsView` and `BudgetLineDetailSheet`
/// when the visual verification harness mounts. Each scenario sets exactly the
/// vars it needs in `PUL209VerifyHarness.body.task`, then the views pick them up
/// in `.onAppear`. Production launches never set these (no harness is mounted).
@MainActor
enum PUL209VerifyState {
    /// Budget line id whose detail sheet should auto-present after the screen
    /// finishes loading. `nil` keeps the sheet closed.
    static var pendingOpenLineId: String?

    /// Budget line id that should appear pointed (checkedAt set) underneath the
    /// open sheet. Mutates the seed before it lands in `BudgetDetailCache`.
    static var pendingPointedLineId: String?

    /// Persisted type filter rawValue applied via `setTypeFilter` on appear.
    /// `nil` falls back to whatever UserDefaults already holds.
    static var pendingTypeFilter: String?

    /// Persisted checked filter rawValue applied via `setCheckedFilter` on appear.
    static var pendingCheckedFilter: String?

    /// When `true`, `BudgetLineDetailSheet` overlays a static stand-in for the
    /// toolbar `Menu` (SwiftUI cannot programmatically open `Menu`). Visual-only.
    static var pendingShowMenu: Bool = false
}

/// Mounted in place of `RootView` when the app launches with a `PUL209_VERIFY_*`
/// argument. Bypasses auth + network by pre-seeding `BudgetDetailCache.shared`
/// before `BudgetDetailsView`'s task runs — the view's early-return path then
/// skips its real fetch and renders against the deterministic seed.
struct PUL209VerifyHarness: View {
    let scenario: UITestLaunchScenario

    /// Stable id for the seeded budget. Must match what we pass to
    /// `BudgetDetailsView(budgetId:)` so the view model picks the seed up.
    private static let seedBudgetId = "pul209-verify"

    @State private var appState = AppState()
    @State private var userSettingsStore = UserSettingsStore()
    @State private var featureFlagsStore = FeatureFlagsStore()
    @State private var uiPreferences = UIPreferencesState()
    @State private var didSeed = false

    var body: some View {
        Group {
            if didSeed {
                NavigationStack {
                    BudgetDetailsView(budgetId: Self.seedBudgetId)
                }
            } else {
                Color.appBackground.ignoresSafeArea()
            }
        }
        .environment(appState)
        .environment(userSettingsStore)
        .environment(featureFlagsStore)
        .environment(uiPreferences)
        .environment(\.amountsHidden, false)
        .task {
            // Seed cache + priming vars BEFORE mounting BudgetDetailsView so the
            // view model picks the data up in its init() and the .task hits the
            // early-return path instead of fetching from the network.
            seedScenario()
            didSeed = true

            // Wait for SwiftUI to settle (sheet presentation, animations) then
            // snapshot the window into the app sandbox. The script pulls the PNG
            // via `simctl get_app_container` — bypasses the flaky `simctl io
            // screenshot` path which times out under headless CI conditions.
            try? await Task.sleep(for: .milliseconds(3500))
            Self.captureWindowToSandbox(named: scenario.captureName)
        }
    }

    // MARK: - Window Snapshot

    /// Renders the current key window into a PNG and writes it to the app's
    /// Documents directory under `<name>.png`. Pull via:
    ///   xcrun simctl get_app_container booted app.pulpe.ios data
    @MainActor
    static func captureWindowToSandbox(named name: String) {
        guard
            let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
            let window = scene.windows.first(where: { $0.isKeyWindow }) ?? scene.windows.first
        else {
            return
        }

        let renderer = UIGraphicsImageRenderer(bounds: window.bounds)
        let image = renderer.image { _ in
            window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
        }

        guard let data = image.pngData() else { return }
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let url = docs.appendingPathComponent("\(name).png")
        try? data.write(to: url, options: .atomic)
    }

    // MARK: - Scenario Seeding

    private func seedScenario() {
        let details = Self.seedDetails(for: scenario)

        BudgetDetailCache.shared.invalidateAll()
        BudgetDetailCache.shared.store(
            budgetId: Self.seedBudgetId,
            budget: details.budget,
            budgetLines: details.budgetLines,
            transactions: details.transactions
        )
        BudgetDetailCache.shared.storeAllBudgets([
            BudgetSparse(
                id: details.budget.id,
                month: details.budget.month,
                year: details.budget.year,
                remaining: details.budget.remaining,
                rollover: details.budget.rollover
            )
        ])

        switch scenario {
        case .pul209VerifyMixed:
            PUL209VerifyState.pendingTypeFilter = BudgetLineKindFilter.all.rawValue
            PUL209VerifyState.pendingCheckedFilter = CheckedFilterOption.unchecked.rawValue
            PUL209VerifyState.pendingShowMenu = false
            PUL209VerifyState.pendingOpenLineId = nil
        case .pul209VerifyFilterExpense:
            PUL209VerifyState.pendingTypeFilter = BudgetLineKindFilter.expense.rawValue
            PUL209VerifyState.pendingCheckedFilter = CheckedFilterOption.unchecked.rawValue
            PUL209VerifyState.pendingShowMenu = false
            PUL209VerifyState.pendingOpenLineId = nil
        case .pul209VerifyFilterChecked:
            PUL209VerifyState.pendingTypeFilter = BudgetLineKindFilter.all.rawValue
            PUL209VerifyState.pendingCheckedFilter = CheckedFilterOption.checked.rawValue
            PUL209VerifyState.pendingShowMenu = false
            PUL209VerifyState.pendingOpenLineId = nil
        case .pul209VerifySheetOpen:
            PUL209VerifyState.pendingTypeFilter = BudgetLineKindFilter.all.rawValue
            PUL209VerifyState.pendingCheckedFilter = CheckedFilterOption.unchecked.rawValue
            PUL209VerifyState.pendingShowMenu = false
            PUL209VerifyState.pendingOpenLineId = SeedIDs.coursesLineId
        case .pul209VerifySheetPointed:
            PUL209VerifyState.pendingTypeFilter = BudgetLineKindFilter.all.rawValue
            PUL209VerifyState.pendingCheckedFilter = CheckedFilterOption.all.rawValue
            PUL209VerifyState.pendingShowMenu = false
            PUL209VerifyState.pendingOpenLineId = SeedIDs.coursesLineId
        case .pul209VerifySheetMenu:
            PUL209VerifyState.pendingTypeFilter = BudgetLineKindFilter.all.rawValue
            PUL209VerifyState.pendingCheckedFilter = CheckedFilterOption.unchecked.rawValue
            PUL209VerifyState.pendingShowMenu = true
            PUL209VerifyState.pendingOpenLineId = SeedIDs.coursesLineId
        case .budgetLongPressWithTransactions, .budgetLongPressEmpty:
            // These scenarios are owned by `BudgetLongPressUITestHarness`; the
            // `current` resolver routes them to a different harness so this
            // branch is only reached if the dispatch in PulpeApp is wrong.
            break
        }
    }

    // MARK: - Seed Data Factory

    /// Stable identifiers for the canonical seed. Kept in one place so the
    /// scenario switch above can cross-reference them without typo risk.
    private enum SeedIDs {
        static let salaireLineId = "pul209-line-salaire"
        static let epargneLineId = "pul209-line-epargne"
        static let telephoneLineId = "pul209-line-telephone"
        static let internetLineId = "pul209-line-internet"
        static let coursesLineId = "pul209-line-courses"
        static let transportLineId = "pul209-line-transport"
    }

    /// Canonical seed mirroring `.context/attachments/Screenshot 2026-05-06 at 07.29.45.png`.
    /// Six lines covering every kind + checked-state combination plus six
    /// transactions linked to "Courses" (incl. two in EUR for the FX caption).
    private static func seedDetails(for scenario: UITestLaunchScenario) -> BudgetDetails {
        let budgetId = seedBudgetId
        // April 2026 (canonical screenshot is "avril 2026"). Use a Date close to
        // the period boundary so transaction "relative" labels read recent.
        let calendar = Calendar(identifier: .gregorian)
        let referenceDate = calendar.date(from: DateComponents(year: 2026, month: 4, day: 15)) ?? Date()

        let budget = Budget(
            id: budgetId,
            month: 4,
            year: 2026,
            description: "Avril 2026",
            userId: nil,
            templateId: "pul209-template",
            endingBalance: nil,
            rollover: 4060,
            remaining: nil,
            previousBudgetId: nil,
            createdAt: referenceDate,
            updatedAt: referenceDate
        )

        var lines: [BudgetLine] = [
            line(
                id: SeedIDs.salaireLineId, budgetId: budgetId, name: "Salaire",
                amount: 7500, kind: .income, recurrence: .fixed, checked: false, refDate: referenceDate
            ),
            line(
                id: SeedIDs.epargneLineId, budgetId: budgetId, name: "Épargne mensuelle",
                amount: 600, kind: .saving, recurrence: .fixed, checked: false, refDate: referenceDate
            ),
            line(
                id: SeedIDs.telephoneLineId, budgetId: budgetId, name: "Téléphone",
                amount: 100, kind: .expense, recurrence: .fixed, checked: false, refDate: referenceDate
            ),
            line(
                id: SeedIDs.internetLineId, budgetId: budgetId, name: "Internet",
                amount: 100, kind: .expense, recurrence: .fixed, checked: false, refDate: referenceDate
            ),
            line(
                id: SeedIDs.coursesLineId, budgetId: budgetId, name: "Courses",
                amount: 800, kind: .expense, recurrence: .oneOff, checked: false, refDate: referenceDate
            ),
            line(
                id: SeedIDs.transportLineId, budgetId: budgetId, name: "Transport",
                amount: 150, kind: .expense, recurrence: .oneOff, checked: false, refDate: referenceDate
            )
        ]

        // For the "checked filter" + "sheet pointed" scenarios, mark Internet as
        // pointed so the UI has at least one line in the checked subset.
        switch scenario {
        case .pul209VerifyFilterChecked, .pul209VerifySheetPointed:
            if let index = lines.firstIndex(where: { $0.id == SeedIDs.internetLineId }) {
                lines[index] = checkedCopy(of: lines[index])
            }
        default:
            break
        }

        let transactions = coursesTransactions(
            budgetId: budgetId,
            lineId: SeedIDs.coursesLineId,
            referenceDate: referenceDate
        )

        return BudgetDetails(
            budget: budget,
            transactions: transactions,
            budgetLines: lines
        )
    }

    private static func line(
        id: String,
        budgetId: String,
        name: String,
        amount: Decimal,
        kind: TransactionKind,
        recurrence: TransactionRecurrence,
        checked: Bool,
        refDate: Date
    ) -> BudgetLine {
        BudgetLine(
            id: id,
            budgetId: budgetId,
            templateLineId: nil,
            savingsGoalId: nil,
            name: name,
            amount: amount,
            kind: kind,
            recurrence: recurrence,
            isManuallyAdjusted: false,
            checkedAt: checked ? refDate : nil,
            createdAt: refDate,
            updatedAt: refDate
        )
    }

    private static func checkedCopy(of source: BudgetLine) -> BudgetLine {
        BudgetLine(
            id: source.id,
            budgetId: source.budgetId,
            templateLineId: source.templateLineId,
            savingsGoalId: source.savingsGoalId,
            name: source.name,
            amount: source.amount,
            kind: source.kind,
            recurrence: source.recurrence,
            isManuallyAdjusted: source.isManuallyAdjusted,
            checkedAt: source.updatedAt,
            createdAt: source.createdAt,
            updatedAt: source.updatedAt,
            originalAmount: source.originalAmount,
            originalCurrency: source.originalCurrency,
            targetCurrency: source.targetCurrency,
            exchangeRate: source.exchangeRate,
            isRollover: source.isRollover,
            rolloverSourceBudgetId: source.rolloverSourceBudgetId
        )
    }

    /// Six "Courses" transactions matching the canonical screenshot. Two carry
    /// FX metadata (EUR) so the sheet renders the secondary currency caption.
    private static func coursesTransactions(
        budgetId: String,
        lineId: String,
        referenceDate: Date
    ) -> [Transaction] {
        let entries: [(name: String, amount: Decimal, daysAgo: Int, fxEUR: Decimal?)] = [
            ("Migros · Conthey", 87.40, 0, nil),
            ("Carrefour · Sallanches", 42.10, 3, 38.50),
            ("Coop · Sion", 64.20, 6, nil),
            ("Aligro · Vétroz", 156.80, 12, nil),
            ("Casino · Annemasse", 89.50, 16, 81.20),
            ("Migros · Lausanne", 100, 20, nil)
        ]

        return entries.enumerated().map { index, entry in
            let date = referenceDate.addingTimeInterval(TimeInterval(-86_400 * entry.daysAgo))
            return Transaction(
                id: "pul209-tx-\(index)",
                budgetId: budgetId,
                budgetLineId: lineId,
                name: entry.name,
                amount: entry.amount,
                kind: .expense,
                transactionDate: date,
                category: nil,
                checkedAt: nil,
                createdAt: date,
                updatedAt: date,
                originalAmount: entry.fxEUR,
                originalCurrency: entry.fxEUR == nil ? nil : .eur,
                targetCurrency: entry.fxEUR == nil ? nil : .chf,
                exchangeRate: nil
            )
        }
    }
}
#endif
