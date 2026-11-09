import SwiftUI

/// « Rattraper » (V2 `Rattraper`): take this month's overrun back on a dépense that still has
/// margin. Saving lowers that prévision and raises the overrun ones by the same share; the
/// movements stay where they are.
struct CatchUpSheet: View {
    let month: Int
    let currency: SupportedCurrency
    let onUpdate: (BudgetLine) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(ToastManager.self) private var toastManager
    @FocusState private var focus: AmountDescriptionField?
    @State private var selectedId: String?
    @State private var isLoading = false
    @State private var error: Error?
    @State private var submitSuccessTrigger = false

    // Frozen at open: the first update reloads the month under the sheet, which would
    // recompute the plan from the half-applied state while the rest is still saving.
    @State private var ledger: MonthLedger
    @State private var plan: CatchUpPlan
    private let dependencies: EditBudgetLineDependencies

    init(
        ledger: MonthLedger,
        focusLineId: String?,
        month: Int,
        currency: SupportedCurrency,
        dependencies: EditBudgetLineDependencies = .live,
        onUpdate: @escaping (BudgetLine) -> Void
    ) {
        _ledger = State(initialValue: ledger)
        self.month = month
        self.currency = currency
        self.dependencies = dependencies
        self.onUpdate = onUpdate
        let plan = CatchUpPlan.make(ledger: ledger, focusLineId: focusLineId, userCurrency: currency)
        _plan = State(initialValue: plan)
        _selectedId = State(initialValue: plan.defaultChoiceId)
    }

    private var selected: CatchUpPlan.Choice? {
        plan.choices.first { $0.id == selectedId }
    }

    var body: some View {
        SheetFormContainer(
            title: AppLocale.string("Rattraper"), isLoading: isLoading, focus: $focus, focusOrder: []
        ) {
            if plan.overruns.isEmpty {
                InfoBanner(
                    .ok, systemImage: "checkmark.circle", text: AppLocale.string("Plus rien ne dépasse ce mois-ci.")
                )
            } else {
                InfoBanner(.over, systemImage: "chart.line.uptrend.xyaxis", text: bannerText)
                    .sensitiveAmount()
                totalCard
                choicesCard
                if let selected {
                    ImpactBlock(
                        title: ReportWording.availableTitle(of: month),
                        impact: plan.impact(of: selected, in: ledger),
                        currency: currency,
                        note: impactNote(for: selected)
                    )
                    .sensitiveAmount()
                }
                if let error {
                    ErrorBanner(message: DomainErrorLocalizer.localize(error)) { self.error = nil }
                }
                if let selected {
                    Button(AppLocale.string("Reprendre sur \(selected.line.name)")) {
                        Task { await submit(selected) }
                    }
                    .primaryButtonStyle(isEnabled: !isLoading)
                    .disabled(isLoading)
                    .accessibilityIdentifier("catchUpSubmit")
                }
            }
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    private var totalCard: some View {
        FormCard {
            HStack {
                Text("À reprendre")
                    .font(PulpeTypography.body)
                Spacer()
                Text(plan.total.asAmount(for: currency))
                    .font(PulpeTypography.rowAmount)
            }
            .foregroundStyle(Color.textPrimary)
            .frame(minHeight: DesignTokens.ListRow.minHeight)
            if plan.overruns.count > 1 {
                FormRowDivider()
                Text(breakdown)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
            }
        }
        .monospacedDigit()
        .sensitiveAmount()
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var choicesCard: some View {
        if plan.choices.isEmpty {
            Text("Aucune prévision ne peut reprendre ce dépassement ce mois-ci.")
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        } else {
            FormCard(title: "Sur quelle prévision ?") {
                ForEach(plan.choices) { choice in
                    if choice.id != plan.choices.first?.id { FormRowDivider() }
                    Button { selectedId = choice.id } label: {
                        PulpeListRow(title: choice.line.name, subtitle: subtitle(for: choice), showsChevron: false) {
                            Image(systemName: "checkmark")
                                .font(PulpeTypography.metricMini)
                                .foregroundStyle(Color.pulpePrimary)
                                .opacity(choice.id == selectedId ? 1 : 0)
                                .accessibilityHidden(true)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityAddTraits(choice.id == selectedId ? .isSelected : [])
                }
            }
            .sensitiveAmount()
        }
    }

    // MARK: - Copy

    /// « Courses et Sorties dépassent de 102.20. Reprends-les sur une prévision… »
    private var bannerText: String {
        let total = plan.total.asAmount(for: currency)
        let names = plan.overruns.map(\.name)
        let head = switch names.count {
        case 1: AppLocale.string("\(names[0]) dépasse de \(total).")
        case 2: AppLocale.string("\(names[0]) et \(names[1]) dépassent de \(total).")
        default: AppLocale.string("\(names.count) prévisions dépassent de \(total).")
        }
        let invite = names.count == 1
            ? AppLocale.string("Reprends-le sur une prévision où il reste de la marge ce mois-ci.")
            : AppLocale.string("Reprends-les sur une prévision où il reste de la marge ce mois-ci.")
        return head + " " + invite
    }

    /// « Courses 64.20 · Sorties 38.00 »
    private var breakdown: String {
        plan.overruns.map { "\($0.name) \($0.amount.asAmount(for: currency))" }.joined(separator: " · ")
    }

    private func subtitle(for choice: CatchUpPlan.Choice) -> String {
        let remaining = choice.remaining.asAmount(for: currency)
        guard choice.coversAll else { return AppLocale.string("Reste \(remaining) · couvre une partie") }
        return AppLocale.string("Reste \(remaining) · passe à \(choice.newAmount.asAmount(for: currency))")
    }

    /// « Loisirs & sport passe de 150.00 à 47.80 prévus pour novembre. »
    private func impactNote(for choice: CatchUpPlan.Choice) -> String {
        let from = choice.line.amount.asAmount(for: currency)
        let to = choice.newAmount.asAmount(for: currency)
        let monthName = Formatters.monthNameInText(for: month)
        return AppLocale.string("\(choice.line.name) passe de \(from) à \(to) prévus pour \(monthName).")
    }

    // MARK: - Submit

    private func submit(_ choice: CatchUpPlan.Choice) async {
        isLoading = true
        defer { isLoading = false }
        error = nil
        do {
            // The lowered prévision first: if a raise then fails, the disponible is already right.
            let raises = plan.raises(for: choice).map { ($0.line.id, $0.newAmount) }
            let updates = [(choice.line.id, choice.newAmount)] + raises
            for (id, amount) in updates {
                let update = BudgetLineUpdate(id: id, amount: amount, isManuallyAdjusted: true)
                onUpdate(try await dependencies.updateBudgetLine(id, update))
            }
            submitSuccessTrigger.toggle()
            toastManager.show(AppLocale.string("Prévision modifiée"))
            dismiss()
        } catch {
            self.error = error
        }
    }
}
