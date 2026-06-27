import SwiftUI

// MARK: - ViewModel

/// Loads the read-only occurrences of a "Lisser" expense (PUL-17 Lot C).
///
/// Mirrors `PreviousBudgetSheetViewModel`: fetches once via the service, exposes
/// loading / error / data, and pre-computes which occurrences are past vs current
/// using the payDay-aware `BudgetPeriodCalculator`. Past/current is resolved
/// client-side (not a naive calendar compare) so a custom pay day shifts the
/// "Ce mois" marker exactly like the rest of the app.
@Observable @MainActor
final class SpreadOccurrencesSheetViewModel {
    private(set) var occurrences: [SpreadOccurrence] = []
    private(set) var isLoading = true
    private(set) var error: Error?

    let spreadGroupId: String
    private let service: any BudgetLineServicing
    private let currentPeriod: BudgetPeriod

    init(
        spreadGroupId: String,
        payDayOfMonth: Int?,
        service: any BudgetLineServicing = BudgetLineService.shared,
        now: Date = Date()
    ) {
        self.spreadGroupId = spreadGroupId
        self.service = service
        self.currentPeriod = BudgetPeriodCalculator.periodForDate(now, payDayOfMonth: payDayOfMonth)
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let fetched = try await service.getSpreadOccurrences(spreadGroupId: spreadGroupId)
            occurrences = fetched.sorted { lhs, rhs in
                BudgetPeriodCalculator.comparePeriods(lhs.period, rhs.period) < 0
            }
        } catch is CancellationError {
            // Task cancelled — keep current state.
        } catch {
            self.error = error
        }
    }

    /// `true` when the occurrence's period precedes the current budget period
    /// (payDay-aware). Past occurrences are dimmed and non-interactive.
    func isPast(_ occurrence: SpreadOccurrence) -> Bool {
        BudgetPeriodCalculator.comparePeriods(occurrence.period, currentPeriod) < 0
    }

    /// `true` for the occurrence living in the current budget period.
    func isCurrent(_ occurrence: SpreadOccurrence) -> Bool {
        BudgetPeriodCalculator.comparePeriods(occurrence.period, currentPeriod) == 0
    }

    func monthLabel(_ occurrence: SpreadOccurrence) -> String {
        "\(Formatters.monthName(for: occurrence.month)) \(occurrence.year)"
    }
}

// MARK: - View

/// Read-only month-by-month timeline of a "Lisser" expense (PUL-17 Lot C).
/// Clones the `PreviousBudgetSheet` scaffolding: NavigationStack + List + close
/// button + `.standardSheetPresentation(detents:)`.
struct SpreadOccurrencesSheet: View {
    @State private var viewModel: SpreadOccurrencesSheetViewModel
    let currency: SupportedCurrency

    init(spreadGroupId: String, payDayOfMonth: Int?, currency: SupportedCurrency) {
        self._viewModel = State(
            initialValue: SpreadOccurrencesSheetViewModel(
                spreadGroupId: spreadGroupId,
                payDayOfMonth: payDayOfMonth
            )
        )
        self.currency = currency
    }

    var body: some View {
        NavigationStack {
            Group {
                if viewModel.isLoading && viewModel.occurrences.isEmpty {
                    LoadingView(message: "Chargement...")
                } else if let error = viewModel.error, viewModel.occurrences.isEmpty {
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
            Section {
                ForEach(viewModel.occurrences) { occurrence in
                    SpreadOccurrenceRow(
                        monthLabel: viewModel.monthLabel(occurrence),
                        amount: occurrence.amount,
                        currency: currency,
                        isPast: viewModel.isPast(occurrence),
                        isChecked: occurrence.isChecked,
                        isCurrent: viewModel.isCurrent(occurrence)
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

// MARK: - Row

/// One occurrence row — month label + amount. Display-only.
/// Past = dimmed + non-interactive; checked = struck-through + secondary; the two
/// compose. The current period carries a "Ce mois" marker.
private struct SpreadOccurrenceRow: View {
    let monthLabel: String
    let amount: Decimal
    let currency: SupportedCurrency
    let isPast: Bool
    let isChecked: Bool
    let isCurrent: Bool

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(monthLabel)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(isChecked ? Color.secondary : Color.textPrimary)
                    .strikethrough(isChecked, color: .secondary)

                if isCurrent {
                    Text("Ce mois")
                        .font(PulpeTypography.metricMini)
                        .foregroundStyle(Color.pulpePrimary)
                }
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            Text(amount.asCurrency(currency))
                .font(PulpeTypography.amountCard)
                .monospacedDigit()
                .foregroundStyle(isChecked ? Color.secondary : Color.textPrimary)
                .strikethrough(isChecked, color: .secondary)
                .sensitiveAmount()
        }
        .padding(.vertical, DesignTokens.Spacing.xs)
        .opacity(isPast ? DesignTokens.Opacity.disabled : 1)
        .allowsHitTesting(!isPast)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(accessibilityLabel)
    }

    private var accessibilityLabel: String {
        var parts = [monthLabel, amount.asCurrency(currency)]
        if isCurrent { parts.append("ce mois") }
        if isChecked { parts.append("pointé") }
        if isPast { parts.append("passé") }
        return parts.joined(separator: ", ")
    }
}

#Preview {
    SpreadOccurrencesSheet(
        spreadGroupId: "preview-group",
        payDayOfMonth: nil,
        currency: .chf
    )
}
