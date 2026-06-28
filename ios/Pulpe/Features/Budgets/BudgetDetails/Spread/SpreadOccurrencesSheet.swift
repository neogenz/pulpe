import SwiftUI

// MARK: - ViewModel

/// Loads the read-only occurrences of a "Lisser" expense (PUL-17 Lot C) and
/// derives the realized progress (tracker + per-occurrence display flags) via
/// the pure `SpreadProgress` formula.
///
/// Two reference frames are threaded in: `referencePeriod` (the VIEWED budget)
/// drives the display axis (past/current/marker), and `livePeriod` (today,
/// payDay-aware) drives the realization axis (`isClosed` → the tracker cumulé).
/// `isCurrentPeriod` distinguishes "Ce mois" (viewed IS the live period) from
/// "Ici" (just the month being looked at).
@Observable @MainActor
final class SpreadOccurrencesSheetViewModel {
    private(set) var items: [SpreadOccurrenceItem] = []
    private(set) var tracker: SpreadTracker?
    private(set) var isLoading = true
    private(set) var error: Error?

    let isCurrentPeriod: Bool

    private let spreadGroupId: String
    private let service: any BudgetLineServicing
    private let referencePeriod: BudgetPeriod
    private let livePeriod: BudgetPeriod

    init(
        spreadGroupId: String,
        referencePeriod: BudgetPeriod,
        payDayOfMonth: Int?,
        service: any BudgetLineServicing = BudgetLineService.shared,
        now: Date = Date()
    ) {
        self.spreadGroupId = spreadGroupId
        self.service = service
        self.referencePeriod = referencePeriod
        self.livePeriod = BudgetPeriodCalculator.periodForDate(now, payDayOfMonth: payDayOfMonth)
        self.isCurrentPeriod = BudgetPeriodCalculator.comparePeriods(referencePeriod, livePeriod) == 0
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let fetched = try await service.getSpreadOccurrences(spreadGroupId: spreadGroupId)
            items = SpreadProgress.buildItems(
                occurrences: fetched,
                referencePeriod: referencePeriod,
                livePeriod: livePeriod
            )
            tracker = SpreadProgress.buildTracker(from: items)
        } catch is CancellationError {
            // Task cancelled — keep current state.
        } catch {
            self.error = error
        }
    }
}

// MARK: - View

/// Read-only month-by-month timeline of a "Lisser" expense (PUL-17 Lot C),
/// fronted by the realized progress tracker. Clones the `PreviousBudgetSheet`
/// scaffolding: NavigationStack + List + close button + standard presentation.
struct SpreadOccurrencesSheet: View {
    @State private var viewModel: SpreadOccurrencesSheetViewModel
    let currency: SupportedCurrency

    init(
        spreadGroupId: String,
        referencePeriod: BudgetPeriod,
        payDayOfMonth: Int?,
        currency: SupportedCurrency
    ) {
        self._viewModel = State(
            initialValue: SpreadOccurrencesSheetViewModel(
                spreadGroupId: spreadGroupId,
                referencePeriod: referencePeriod,
                payDayOfMonth: payDayOfMonth
            )
        )
        self.currency = currency
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.items.isEmpty {
                    LoadingView(message: "Chargement...")
                } else if let error = viewModel.error, viewModel.items.isEmpty {
                    ErrorView(error: error) { await viewModel.load() }
                } else {
                    content
                }
            }
            .navigationTitle("Dépense lissée")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
        }
        .standardSheetPresentation(detents: [.medium, .large])
        .task { await viewModel.load() }
    }

    private var content: some View {
        List {
            if let tracker = viewModel.tracker {
                Section {
                    SpreadTrackerHeader(tracker: tracker, currency: currency)
                        .listRowBackground(Color.clear)
                }
            }

            Section {
                ForEach(viewModel.items) { item in
                    SpreadOccurrenceRow(
                        item: item,
                        currency: currency,
                        isCurrentPeriod: viewModel.isCurrentPeriod
                    )
                    .listRowBackground(Color.clear)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .pulpeBackground()
    }
}

#Preview {
    SpreadOccurrencesSheet(
        spreadGroupId: "preview-group",
        referencePeriod: BudgetPeriod(month: 6, year: 2026),
        payDayOfMonth: nil,
        currency: .chf
    )
}
