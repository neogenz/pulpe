// swiftlint:disable file_length
import Foundation
import OSLog

@Observable @MainActor
final class CurrentMonthStore: StoreProtocol {
    // MARK: - Types

    /// A checkable item in the "À pointer" dashboard card.
    /// Priority: free transactions → allocated transactions → budget lines.
    enum CheckableItem: Identifiable, Sendable {
        case transaction(Transaction, consumption: BudgetFormulas.Consumption? = nil)
        case budgetLine(BudgetLine, consumption: BudgetFormulas.Consumption? = nil)

        var id: String {
            switch self {
            case .transaction(let tx, _): return "tx-\(tx.id)"
            case .budgetLine(let line, _): return "bl-\(line.id)"
            }
        }

        var kind: TransactionKind {
            switch self {
            case .transaction(let tx, _): return tx.kind
            case .budgetLine(let line, _): return line.kind
            }
        }

        var name: String {
            switch self {
            case .transaction(let tx, _): return tx.name
            case .budgetLine(let line, _): return line.name
            }
        }

        var consumption: BudgetFormulas.Consumption? {
            switch self {
            case .transaction(_, let consumption): return consumption
            case .budgetLine(_, let consumption): return consumption
            }
        }
    }

    struct SavingsSummary: Sendable {
        let totalPlanned: Decimal
        let totalRealized: Decimal
        let checkedCount: Int
        let totalCount: Int

        var progressPercentage: Double {
            guard totalPlanned > 0 else { return 0 }
            return max(0, min(Double(truncating: (totalRealized / totalPlanned * 100) as NSDecimalNumber), 100))
        }

        var isComplete: Bool { progressPercentage >= 100 && totalPlanned > 0 }
        var hasSavings: Bool { totalPlanned > 0 || totalRealized > 0 }
    }

    /// Loading lifecycle — makes invalid UI states irrepresentable.
    /// Error details live in the separate `error` property (mutations need independent error storage).
    enum ContentState: Equatable, Sendable {
        /// Store just initialized — no data fetched yet
        case idle
        /// Actively loading — no previous data available
        case loading
        /// Budget and details loaded successfully
        case loaded
        /// API confirmed no budget for the current month
        case empty
        /// Loading failed — check `error` for details
        case failed
    }

    // MARK: - State

    private(set) var contentState: ContentState = .idle
    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    /// The server's reading of the user's closed months; `nil` until the details load.
    private(set) var history: DriftHistory?
    /// A home mutation is in flight: the chart shimmers its projection, which is drawn from
    /// an optimistic store until the server has settled the entry.
    /// ponytail: one flag, so two overlapping mutations clear it on the first response;
    /// a counter if that ever shows.
    private(set) var isSettling = false
    private(set) var error: APIError?

    /// Derived from `contentState` — satisfies `StoreProtocol.isLoading`
    var isLoading: Bool { contentState == .loading }

    /// Returns true if the store has an error and no budget data to display
    var hasError: Bool { contentState == .failed }

    /// Custom pay day used for period resolution (set via loadBudgetSummary)
    private(set) var payDayOfMonth: Int?

    // Track IDs of items currently syncing for visual feedback
    private(set) var syncingTransactionIds: Set<String> = []
    private(set) var syncingBudgetLineIds: Set<String> = []

    // MARK: - Cache Metadata

    private var lastLoadTime: Date?

    /// Fired by every amount-changing mutation below (adds, updates, deletes —
    /// not toggles). Lets the app invalidate sibling stores that project the
    /// same budget aggregates (`BudgetListStore`, `DashboardStore`) without
    /// this store knowing them — wired once in `PulpeApp.init` (PUL-270).
    @ObservationIgnored var onMutation: (@MainActor () -> Void)?

    // Cache for expensive computed properties
    private var cachedMetrics: BudgetFormulas.Metrics?
    private var cachedRealizedMetrics: BudgetFormulas.RealizedMetrics?
    private var cachedUncheckedItems: [CheckableItem]?
    private var cachedSavingsSummary: SavingsSummary?
    private var cachedDriftLines: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)]?
    private var cachedBalanceTrajectory: BudgetFormulas.BalanceTrajectory?
    private var cachedPlannedRemaining: Decimal?

    // Widget sync debouncing
    private var widgetSyncTask: Task<Void, Never>?

    /// Coalescing task to prevent concurrent API loads
    private var loadTask: Task<Void, Never>?
    /// Generation counter to safely nil loadTask after completion
    private var loadGeneration = 0

    private var isCacheValid: Bool {
        guard let lastLoad = lastLoadTime else { return false }
        return Date().timeIntervalSince(lastLoad) < AppConfiguration.shortCacheValidity
    }

    // MARK: - Services

    private let budgetService: BudgetService
    private let budgetLineService: BudgetLineService
    private let transactionService: TransactionService
    private let widgetSyncService: WidgetDataSyncService

    // MARK: - Initialization

    init(
        budgetService: BudgetService = .shared,
        budgetLineService: BudgetLineService = .shared,
        transactionService: TransactionService = .shared,
        widgetSyncService: WidgetDataSyncService = .shared
    ) {
        self.budgetService = budgetService
        self.budgetLineService = budgetLineService
        self.transactionService = transactionService
        self.widgetSyncService = widgetSyncService
    }

    // MARK: - Loading

    /// Primary startup loader — called once by PulpeApp.task after auth.
    /// Resolves the current budget period, loads budget + details in one pass.
    func loadBudgetSummary(payDayOfMonth: Int? = nil) async {
        self.payDayOfMonth = payDayOfMonth

        // Cancel any in-flight forceRefresh that may be using a stale/nil payDay
        loadTask?.cancel()

        // If we already have a budget for the correct period, skip reload
        if let existingBudget = budget {
            let period = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)
            if existingBudget.month == period.month && existingBudget.year == period.year {
                return
            }
            // Period mismatch — clear stale budget before reloading
            budget = nil
            budgetLines = []
            transactions = []
            recomputeMetrics()
        }

        contentState = .loading
        error = nil
        let loadStart = ContinuousClock.now

        do {
            let sparseBudgets = try await budgetService.getBudgetsSparse(
                fields: "month,year",
                limit: 13
            )
            let period = BudgetPeriodCalculator.periodForDate(Date(), payDayOfMonth: payDayOfMonth)

            guard let match = sparseBudgets.first(where: {
                $0.month == period.month && $0.year == period.year
            }) else {
                try await DesignTokens.Animation.ensureMinimumSkeletonTime(since: loadStart)
                contentState = .empty
                return
            }

            try Task.checkCancellation()

            let details = try await budgetService.getBudgetWithDetails(id: match.id)
            try await DesignTokens.Animation.ensureMinimumSkeletonTime(since: loadStart)

            applyDetails(details)
        } catch where error.isCancellationOrURLCancellation {
            if contentState == .loading { contentState = .idle }
        } catch {
            self.error = (error as? APIError) ?? .networkError(error)
            contentState = .failed
        }
    }

    /// Loads details (transactions + budget lines) when the view needs them
    func loadDetailsIfNeeded() async {
        guard !isCacheValid else { return }
        await loadDetails()
    }

    /// Full data loading - called when view needs transactions and budget lines
    private func loadDetails() async {
        // If a forceRefresh is already in progress, piggyback on it
        if let existingTask = loadTask {
            await existingTask.value
            return
        }

        guard let currentBudget = budget else {
            // No budget loaded — skip if already loading, otherwise trigger a full load
            guard contentState != .loading else { return }
            await forceRefresh()
            return
        }

        // Budget exists — loading details in background, stay .loaded (no skeleton)
        error = nil
        // A detail screen may have just written this month: take it rather than refetch.
        // `forceRefresh` never comes through here, so pull-to-refresh still hits the server.
        if adoptSharedSnapshotIfFresh() { return }

        do {
            let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
            applyDetails(details)
        } catch where error.isCancellationOrURLCancellation {
            // silently absorb
        } catch {
            self.error = (error as? APIError) ?? .networkError(error)
        }
    }

    /// Update the stored payDayOfMonth so subsequent forceRefresh() calls use the correct period
    func setPayDay(_ payDay: Int?) {
        payDayOfMonth = payDay
        // The trajectory is cut along the period boundaries, so it is only as
        // fresh as this value. Callers do follow with a refresh, but the cache
        // must not depend on them remembering to.
        recomputeMetrics()
    }

    /// Invalidates the cache so the next `loadDetailsIfNeeded()` / `loadIfNeeded()` will re-fetch.
    func invalidateCache() {
        loadTask?.cancel()
        loadTask = nil
        loadGeneration += 1
        lastLoadTime = nil
    }

    func loadIfNeeded() async {
        guard !isCacheValid else { return }
        guard contentState != .loading else { return }
        await forceRefresh()
    }

    func reset() {
        loadTask?.cancel()
        loadTask = nil
        loadGeneration = 0
        widgetSyncTask?.cancel()
        widgetSyncTask = nil
        contentState = .idle
        budget = nil
        budgetLines = []
        transactions = []
        history = nil
        payDayOfMonth = nil
        syncingTransactionIds = []
        syncingBudgetLineIds = []
        lastLoadTime = nil
        cachedMetrics = nil
        cachedRealizedMetrics = nil
        cachedUncheckedItems = nil
        cachedSavingsSummary = nil
        cachedDriftLines = nil
        cachedBalanceTrajectory = nil
        cachedPlannedRemaining = nil
        error = nil
        BudgetDetailCache.shared.invalidateAll()
    }

    /// Clears stale error state before a new load cycle — prevents brief error flash on view (re-)entry
    func prepareForReload() {
        guard contentState == .failed else { return }
        contentState = .idle
        error = nil
    }

    func forceRefresh() async {
        loadTask?.cancel()
        loadGeneration += 1
        let currentGeneration = loadGeneration
        let task = Task(name: "CurrentMonth.refresh") { await performRefresh() }
        loadTask = task
        await task.value
        if loadGeneration == currentGeneration { loadTask = nil }
    }

    private func performRefresh() async {
        let isFirstLoad = budget == nil
        if isFirstLoad {
            contentState = .loading
        }
        error = nil
        let loadStart = ContinuousClock.now

        do {
            guard let currentBudget = try await budgetService.getCurrentMonthBudget(
                payDayOfMonth: self.payDayOfMonth
            ) else {
                if isFirstLoad {
                    try await DesignTokens.Animation.ensureMinimumSkeletonTime(since: loadStart)
                }
                budget = nil
                budgetLines = []
                transactions = []
                recomputeMetrics()
                lastLoadTime = Date()
                contentState = .empty
                return
            }

            try Task.checkCancellation()
            let details = try await budgetService.getBudgetWithDetails(id: currentBudget.id)
            try Task.checkCancellation()

            if isFirstLoad {
                try await DesignTokens.Animation.ensureMinimumSkeletonTime(since: loadStart)
            }

            applyDetails(details)
        } catch where error.isCancellationOrURLCancellation {
            if contentState == .loading { contentState = .idle }
        } catch {
            self.error = (error as? APIError) ?? .networkError(error)
            if isFirstLoad { contentState = .failed }
        }
    }

    // MARK: - Widget Sync

    private func syncWidgetAfterChange() {
        widgetSyncTask?.cancel()

        widgetSyncTask = Task(name: "CurrentMonth.widgetSync") {
            try? await Task.sleep(for: .seconds(AppConfiguration.widgetSyncDebounceDelay))
            guard !Task.isCancelled else { return }
            guard budget != nil else { return }
            await widgetSyncService.syncAll(payDayOfMonth: payDayOfMonth)
        }
    }

    // MARK: - Computed Properties (cached to avoid recalculation)

    var metrics: BudgetFormulas.Metrics {
        cachedMetrics ?? BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    /// End-of-month balance from the budget alone, before known transactions adjust envelopes.
    var plannedRemaining: Decimal {
        cachedPlannedRemaining ?? computePlannedRemaining()
    }

    var realizedMetrics: BudgetFormulas.RealizedMetrics {
        cachedRealizedMetrics ?? BudgetFormulas.calculateRealizedMetrics(
            budgetLines: displayBudgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    /// Apply fetched details to local state, recompute metrics, and update cache.
    private func applyDetails(_ details: BudgetDetails) {
        apply(
            budget: details.budget,
            budgetLines: details.budgetLines,
            transactions: details.transactions,
            history: details.history
        )
        BudgetDetailCache.shared.store(
            budgetId: details.budget.id,
            budget: details.budget,
            budgetLines: details.budgetLines,
            transactions: details.transactions
        )
    }
}

// MARK: - Shared detail snapshot

extension CurrentMonthStore {
    /// In-memory apply shared by a server snapshot and an adopted cache entry. Kept apart
    /// from the cache write so adopting an entry never refreshes its `fetchedAt`.
    private func apply(
        budget: Budget,
        budgetLines: [BudgetLine],
        transactions: [Transaction],
        history: DriftHistory?
    ) {
        self.budget = budget
        self.budgetLines = budgetLines
        self.transactions = transactions
        self.history = history
        recomputeMetrics()
        lastLoadTime = Date()
        contentState = .loaded
    }

    /// Takes the shared detail entry of this month when it is fresh, instead of fetching.
    ///
    /// Every detail mutation ends in `BudgetDataStore.syncCache()`, so the entry is the
    /// latest truth. A fetch is wrong during the undo window of a soft delete: the server
    /// keeps the row until the toast commits, so the row would come back; and after the
    /// commit nothing reloads a visible accueil, so it would stay. Same 30 s cross-device
    /// lag as the budget page. The entry carries no `history`; the current one is kept.
    /// On a miss the store is marked stale, as it always was after a detail mutation.
    func adoptSharedSnapshotIfFresh() -> Bool {
        guard let budgetId = budget?.id,
              let entry = BudgetDetailCache.shared.get(budgetId: budgetId) else {
            invalidateCache()
            return false
        }
        apply(
            budget: entry.budget,
            budgetLines: entry.budgetLines,
            transactions: entry.transactions,
            history: history
        )
        return true
    }
}

#if DEBUG
extension CurrentMonthStore {
    /// Test-only: hold the dashboard on its production loading state.
    func prepareLoadingForTesting() {
        contentState = .loading
    }

    /// Test-only: populate store with data for unit testing
    func populateForTesting(
        budget: Budget? = nil,
        budgetLines: [BudgetLine] = [],
        transactions: [Transaction] = [],
        history: DriftHistory? = nil
    ) {
        self.budget = budget
        self.budgetLines = budgetLines
        self.transactions = transactions
        self.history = history
        contentState = budget != nil ? .loaded : .empty
        recomputeMetrics()
    }
}
#endif

// MARK: - Computed Properties

extension CurrentMonthStore {
    /// Recompute and cache metrics - call after data changes
    private func recomputeMetrics() {
        cachedMetrics = BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
        cachedRealizedMetrics = BudgetFormulas.calculateRealizedMetrics(
            budgetLines: displayBudgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
        cachedUncheckedItems = computeUncheckedItems()
        cachedSavingsSummary = computeSavingsSummary()
        cachedDriftLines = computeDriftLines()
        cachedBalanceTrajectory = computeBalanceTrajectory()
        cachedPlannedRemaining = computePlannedRemaining()
    }

    /// Days remaining in the current budget period, today included.
    /// Both ends are normalized to `startOfDay` — diffing a timestamped now against a
    /// midnight boundary makes `.day` truncate today away for most of the day, which
    /// inflated the daily allowance (÷8 instead of ÷9 while the hero says "Jour 23/31").
    func daysRemaining(now: Date = Date()) -> Int {
        let calendar = Calendar.current
        let today = calendar.startOfDay(for: now)

        if let payDay = payDayOfMonth, payDay > 1, let budget {
            let periodDates = BudgetPeriodCalculator.periodDates(
                month: budget.month, year: budget.year, payDayOfMonth: payDay
            )
            let end = calendar.startOfDay(for: periodDates.endDate)
            let remaining = calendar.dateComponents([.day], from: today, to: end).day ?? 0
            return max(remaining + 1, 1)
        }

        // Standard calendar month
        guard let range = calendar.range(of: .day, in: .month, for: now),
              let lastDay = calendar.date(from: DateComponents(
                year: calendar.component(.year, from: now),
                month: calendar.component(.month, from: now),
                day: range.count
              )) else { return 0 }

        let remaining = calendar.dateComponents(
            [.day], from: today, to: calendar.startOfDay(for: lastDay)
        ).day ?? 0
        return max(remaining + 1, 1) // Include today
    }

    /// Daily budget available (remaining / days left)
    func dailyBudget() -> Decimal {
        let days = daysRemaining()
        guard days > 0, metrics.remaining > 0 else { return 0 }
        return metrics.remaining / Decimal(days)
    }

    /// Expense envelopes consumed beyond their plan ("Ça dérive"), biggest overrun first.
    /// Cached like the sibling aggregates: a render reads this 4× (guard, card input,
    /// `driftTotal`, `conditionalBlocksState`) and each recompute walks lines × transactions.
    var driftLines: [(line: BudgetLine, consumption: BudgetFormulas.Consumption)] {
        cachedDriftLines ?? computeDriftLines()
    }

    /// Uses `available < 0` (not `isOverBudget`) so zero-amount envelopes with spending count too.
    private func computeDriftLines() -> [(line: BudgetLine, consumption: BudgetFormulas.Consumption)] {
        budgetLines
            .filter { $0.kind == .expense && !($0.isRollover ?? false) }
            .compactMap { line -> (BudgetLine, BudgetFormulas.Consumption)? in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                guard consumption.available < 0 else { return nil }
                return (line, consumption)
            }
            .sorted { $0.1.available < $1.1.available }
    }

    /// Total amount consumed beyond plan across drifting envelopes.
    var driftTotal: Decimal {
        driftLines.reduce(.zero) { $0 - $1.consumption.available }
    }

    /// Uncapped unchecked count for the "à pointer" header (`uncheckedItems` is capped at 5
    /// for display). Count only: a summed amount mixed inflows with outflows under one label
    /// and sat irreconcilable next to the hero's "Engagé" — the count is the actionable part.
    var uncheckedCount: Int {
        let uncheckedTransactions = transactions.filter { !$0.isChecked }
        let uncheckedLines = budgetLines.filter { !$0.isChecked && !($0.isRollover ?? false) }
        return uncheckedTransactions.count + uncheckedLines.count
    }

    /// 1-based day position within the current budget period (payDay-aware).
    func periodDayProgress(now: Date = Date()) -> (day: Int, totalDays: Int)? {
        guard let budget else { return nil }
        let dates = BudgetPeriodCalculator.periodDates(
            month: budget.month,
            year: budget.year,
            payDayOfMonth: payDayOfMonth
        )
        let calendar = Calendar.current
        let start = calendar.startOfDay(for: dates.startDate)
        let end = calendar.startOfDay(for: dates.endDate)
        let totalDays = (calendar.dateComponents([.day], from: start, to: end).day ?? 0) + 1
        let day = (calendar.dateComponents([.day], from: start, to: calendar.startOfDay(for: now)).day ?? 0) + 1
        return (min(max(day, 1), max(totalDays, 1)), max(totalDays, 1))
    }

    private static let maxDashboardItems = 5
    private static let kindSortOrder: [TransactionKind] = [.income, .expense, .saving]

    /// Unchecked items for dashboard "À pointer" card (max 5, cached).
    /// Priority: free transactions → allocated transactions → budget lines.
    var uncheckedItems: [CheckableItem] {
        cachedUncheckedItems ?? computeUncheckedItems()
    }

    var savingsSummary: SavingsSummary {
        cachedSavingsSummary ?? computeSavingsSummary()
    }

    private func computeUncheckedItems() -> [CheckableItem] {
        var items: [CheckableItem] = []

        // 1. Free transactions (unchecked, newest first)
        items += transactions
            .filter { $0.isFree && !$0.isChecked }
            .sorted { $0.transactionDate > $1.transactionDate }
            .map { .transaction($0) }

        // 2. Allocated transactions (unchecked, newest first) — pre-compute consumption for linked budget line
        items += transactions
            .filter { $0.isAllocated && !$0.isChecked }
            .sorted { $0.transactionDate > $1.transactionDate }
            .map { tx in
                let consumption = tx.budgetLineId
                    .flatMap { lineId in budgetLines.first { $0.id == lineId } }
                    .map { BudgetFormulas.calculateConsumption(for: $0, transactions: transactions) }
                return .transaction(tx, consumption: consumption)
            }

        // 3. Unchecked budget lines (income → expense → saving)
        items += budgetLines
            .filter { !$0.isChecked && !($0.isRollover ?? false) }
            .sorted {
                let lhs = Self.kindSortOrder.firstIndex(of: $0.kind) ?? Int.max
                let rhs = Self.kindSortOrder.firstIndex(of: $1.kind) ?? Int.max
                if lhs != rhs { return lhs < rhs }
                return $0.createdAt > $1.createdAt
            }
            .map { line in
                let consumption = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                return .budgetLine(line, consumption: consumption)
            }

        return Array(items.prefix(Self.maxDashboardItems))
    }

    private func computeSavingsSummary() -> SavingsSummary {
        let savingLines = budgetLines.filter { $0.kind == .saving && !($0.isRollover ?? false) }
        let totalPlanned = savingLines.reduce(Decimal.zero) { $0 + $1.amount }
        let checkedCount = savingLines.filter(\.isChecked).count
        return SavingsSummary(
            totalPlanned: totalPlanned,
            totalRealized: realizedMetrics.checkedSavingsAmount,
            checkedCount: checkedCount,
            totalCount: savingLines.count
        )
    }

    /// Read by the dashboard hero, so it is hit on every frame of a scroll.
    /// Both halves of the fallback are cheap when there is no budget: the cache
    /// holds `nil` and the recompute returns on its own guard.
    var balanceTrajectory: BudgetFormulas.BalanceTrajectory? {
        cachedBalanceTrajectory ?? computeBalanceTrajectory()
    }

    private func computeBalanceTrajectory() -> BudgetFormulas.BalanceTrajectory? {
        guard let budget else { return nil }
        return BudgetFormulas.calculateBalanceTrajectory(
            budgetLines: budgetLines,
            transactions: transactions,
            budget: budget,
            payDayOfMonth: payDayOfMonth,
            history: history
        )
    }

    private func computePlannedRemaining() -> Decimal {
        BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            rollover: budget?.rollover.orZero ?? 0
        ).remaining
    }

    var displayBudgetLines: [BudgetLine] {
        BudgetFormulas.displayBudgetLines(base: budgetLines, budget: budget)
    }
}

// MARK: - Mutations

extension CurrentMonthStore {
    /// - Returns: `false` when the toggle was rolled back — see `toggleTransaction`.
    @discardableResult
    func toggleBudgetLine(_ line: BudgetLine) async -> Bool {
        // Note: toggles don't fire `onMutation` — checking a line/transaction
        // never changes the sparse aggregates sibling stores display.
        // Skip virtual rollover lines
        guard !(line.isRollover ?? false) else { return true }

        // Skip if already syncing
        guard !syncingBudgetLineIds.contains(line.id) else { return true }

        // Mark as syncing
        _ = syncingBudgetLineIds.insert(line.id)

        // Optimistic update
        let originalLines = budgetLines
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line.toggled()
            recomputeMetrics()
        }

        var didSucceed = true
        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            // Trust optimistic update - only mark cache as fresh
            lastLoadTime = Date()
        } catch let apiError as APIError {
            // Only refresh on error to rollback
            budgetLines = originalLines
            self.error = apiError
            recomputeMetrics()
            await forceRefresh()
            didSucceed = false
        } catch {
            budgetLines = originalLines
            self.error = .networkError(error)
            recomputeMetrics()
            await forceRefresh()
            didSucceed = false
        }

        _ = syncingBudgetLineIds.remove(line.id)
        return didSucceed
    }

    /// - Returns: `false` when the toggle was rolled back, so the caller can surface it.
    ///   `error` alone isn't enough: it's only rendered by the `.failed` content state, and a
    ///   toggle failing from `.loaded` leaves the screen loaded — the rollback would be silent.
    @discardableResult
    func toggleTransaction(_ transaction: Transaction) async -> Bool {
        // Skip if already syncing
        guard !syncingTransactionIds.contains(transaction.id) else { return true }

        // Mark as syncing
        _ = syncingTransactionIds.insert(transaction.id)

        // Optimistic update
        let originalTransactions = transactions
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction.toggled()
            recomputeMetrics()
        }

        var didSucceed = true
        do {
            _ = try await transactionService.toggleCheck(id: transaction.id)
            // Trust optimistic update - only mark cache as fresh
            lastLoadTime = Date()
        } catch let apiError as APIError {
            // Only refresh on error to rollback
            transactions = originalTransactions
            self.error = apiError
            recomputeMetrics()
            await forceRefresh()
            didSucceed = false
        } catch {
            transactions = originalTransactions
            self.error = .networkError(error)
            recomputeMetrics()
            await forceRefresh()
            didSucceed = false
        }

        _ = syncingTransactionIds.remove(transaction.id)
        return didSucceed
    }

    func addTransaction(_ transaction: Transaction) {
        guard budget?.id == transaction.budgetId else {
            invalidateCache()
            onMutation?()
            return
        }
        transactions.removeAll { $0.id == transaction.id }
        transactions.append(transaction)
        recomputeMetrics()
        syncWidgetAfterChange()
        onMutation?()
    }

    func deleteBudgetLine(_ line: BudgetLine) async {
        // Skip virtual rollover lines
        guard !(line.isRollover ?? false) else { return }
        isSettling = true
        defer { isSettling = false }

        // Optimistic update
        let originalLines = budgetLines
        budgetLines.removeAll { $0.id == line.id }
        recomputeMetrics()
        onMutation?()

        do {
            try await budgetLineService.deleteBudgetLine(id: line.id)
        } catch let apiError as APIError {
            budgetLines = originalLines
            self.error = apiError
            recomputeMetrics()
        } catch {
            budgetLines = originalLines
            self.error = .networkError(error)
            recomputeMetrics()
        }
    }

    func updateBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }
        isSettling = true
        defer { isSettling = false }

        // Optimistic update
        if let index = budgetLines.firstIndex(where: { $0.id == line.id }) {
            budgetLines[index] = line
            recomputeMetrics()
        }
        onMutation?()

        // Refresh to get server state (needed for recalculations)
        await forceRefresh()
    }

    func updateTransaction(_ transaction: Transaction) async {
        isSettling = true
        defer { isSettling = false }
        // Optimistic update
        if let index = transactions.firstIndex(where: { $0.id == transaction.id }) {
            transactions[index] = transaction
            recomputeMetrics()
        }
        onMutation?()
        await forceRefresh()
    }
}
