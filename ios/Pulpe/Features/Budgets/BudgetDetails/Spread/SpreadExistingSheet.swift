import SwiftUI

/// PUL-17 v1.1 — "lisser une dépense existante" sheet (total-preserving).
///
/// The source total is LOCKED (read-only): the user picks the end month + the
/// months to skip, and `T` is redistributed into `T/N` via the calculator's
/// `SpreadSplit` (M0 included, drops to ~T/N). Mirrors the web
/// `SpreadExistingDialog`. On submit it awaits the caller's spread work behind a
/// blocking loading overlay and dismisses only once it completes (parity with the
/// additive `AddBudgetLineSheet` flow); the caller routes the chosen `periods` to
/// the coordinator (which deletes the source + fans out).
struct SpreadExistingSheet: View {
    let source: SpreadExistingSource
    let currency: SupportedCurrency
    /// M0 as the disponible reads it, for the impact block. `nil` hides the block.
    var ledger: MonthLedger?
    let onSpread: ([SpreadFromExistingPeriod]) async -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var calculator: SpreadExistingCalculator
    @State private var isPickingEnd = false
    @State private var isSubmitting = false

    init(
        source: SpreadExistingSource,
        currency: SupportedCurrency,
        ledger: MonthLedger? = nil,
        onSpread: @escaping ([SpreadFromExistingPeriod]) async -> Void
    ) {
        self.source = source
        self.currency = currency
        self.ledger = ledger
        self.onSpread = onSpread
        self._calculator = State(
            initialValue: SpreadExistingCalculator(anchorMonth: source.month, anchorYear: source.year)
        )
    }

    private var accentColor: Color { Color.financialColor(for: source.kind) }
    // Source kind drives the noun — a spread saving must read "épargne", not
    // "dépense" (same accord as the `disclosure` body and the additive flow).
    private var spreadTitle: String {
        source.kind == .saving ? AppLocale.string("Lisser l’épargne") : AppLocale.string("Lisser la dépense")
    }
    // M0 is locked, so the window is [M0, M0+35] at most (36-month cap). The
    // worst case (M0 = December) ends in `start.year + 3`; +4 over-exposed a year
    // of months the validation would reject.
    private var yearRange: ClosedRange<Int> { calculator.start.year...(calculator.start.year + 3) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    totalHero
                    monthRangeCard
                    monthsGrid
                    echo
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.lg)
            }
            .scrollBounceBehavior(.basedOnSize)
            .pulpeBackground()
            .pulpeStickyBottomCTA { submitButton }
            .navigationTitle(spreadTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // Disabled during submit: the loading overlay covers SwiftUI
                // content but not the UIKit nav bar, so without this the user
                // could dismiss mid-spread while the fan-out keeps running.
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton().disabled(isSubmitting)
                }
            }
            // Blocking overlay while the spread runs server-side (delete source +
            // fan out N tranches) — parity with the additive flow. The message
            // matters: a bare spinner on a multi-month fan-out reads as frozen.
            .loadingOverlay(isSubmitting, message: AppLocale.string("Lissage en cours…"))
            .sheet(isPresented: $isPickingEnd) {
                MonthYearPickerSheet(
                    title: AppLocale.string("Dernier mois"),
                    initial: BudgetPeriod(month: calculator.end.month, year: calculator.end.year),
                    yearRange: yearRange,
                    accentColor: accentColor
                ) { calculator.setEnd(SpreadMonth(year: $0.year, month: $0.month)) }
            }
        }
        .standardSheetPresentation(detents: [.medium, .large])
        // Block swipe-to-dismiss while the spread runs — same guard as the
        // disabled cancel button, closing the other path that could dismiss the
        // sheet mid-fan-out (parity with ConfirmPasswordSheet).
        .interactiveDismissDisabled(isSubmitting)
    }

    // MARK: - Locked total

    private var sourceLabel: String {
        source.sourceType == .budgetLine ? AppLocale.string("\(source.name) · une fois") : source.name
    }

    private var totalHero: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Text(sourceLabel)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xs) {
                Text(source.total.asAmount(for: currency))
                    .font(PulpeTypography.heroAmount)
                    .foregroundStyle(Color.textPrimary)
                    .minimumScaleFactor(DesignTokens.TextScale.floor)
                    .lineLimit(1)
                    .sensitiveAmount()
                Text(currency.rawValue)
                    .font(PulpeTypography.heroCurrencySuffix)
                    .foregroundStyle(Color.textSecondary)
            }
            Text("Le total ne change pas, il est réparti")
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(maxWidth: .infinity)
        .multilineTextAlignment(.center)
        .accessibilityElement(children: .combine)
    }

    // MARK: - De (locked) → À (picker)

    private var monthRangeCard: some View {
        FormCard {
            HStack {
                Text("De")
                Spacer()
                Text(calculator.start.longName)
                    .foregroundStyle(Color.textSecondary)
                Image(systemName: "lock.fill")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            }
            .frame(minHeight: DesignTokens.ListRow.minHeight)
            .accessibilityElement(children: .combine)
            .accessibilityLabel("De : \(calculator.start.longName)")
            FormRowDivider()
            Button { isPickingEnd = true } label: {
                HStack {
                    Text("À")
                    Spacer()
                    Text(calculator.end.longName)
                        .font(PulpeTypography.rowTitle)
                    RowChevron()
                }
                .foregroundStyle(Color.textPrimary)
                .frame(minHeight: DesignTokens.ListRow.minHeight)
                .contentShape(.rect)
            }
            .plainPressedButtonStyle()
            .accessibilityLabel("À : \(calculator.end.longName)")
        }
        .font(PulpeTypography.rowTitleRegular)
    }

    // MARK: - Months grid

    private let columns = Array(
        repeating: GridItem(.flexible(), spacing: DesignTokens.Spacing.sm),
        count: 4
    )

    @ViewBuilder
    private var monthsGrid: some View {
        let months = calculator.windowMonths
        if !months.isEmpty {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                if calculator.isValid {
                    Text(AppLocale.string(
                        "\(calculator.selectedCount) mois · \(perMonthText) par mois"
                    ))
                    .font(PulpeTypography.metricLabel)
                    .foregroundStyle(Color.textSecondary)
                    .sensitiveAmount()
                }
                LazyVGrid(columns: columns, spacing: DesignTokens.Spacing.sm) {
                    ForEach(months) { month in
                        monthTile(month)
                    }
                }
                .animation(.snappy(duration: DesignTokens.Animation.fast), value: calculator.windowMonths)
                Text("Touche un mois pour l'enlever. \(calculator.start.name) reste : c'est le départ.")
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private var perMonthText: String { calculator.perMonth(total: source.total).asAmount(for: currency) }

    private func monthTile(_ month: SpreadMonth) -> some View {
        let isOn = calculator.isSelected(month)
        return Button {
            withAnimation(.snappy(duration: DesignTokens.Animation.fast)) { calculator.toggle(month) }
        } label: {
            MonthAmountTile(
                label: month.shortLabel,
                amount: isOn ? calculator.amount(for: month, total: source.total) ?? 0 : nil,
                currency: currency
            )
        }
        .disabled(calculator.isLocked(month))
        .contentShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
        .plainPressedButtonStyle()
        .accessibilityLabel(month.longName)
        .accessibilityValue(isOn ? Text("Sélectionné") : Text("Désélectionné"))
        .accessibilityHint(
            calculator.isLocked(month) ? Text("Mois de départ, non modifiable") : Text(verbatim: "")
        )
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }

    // MARK: - Echo

    @ViewBuilder
    private var echo: some View {
        if let message = calculator.validationMessage {
            ErrorBanner(message: message)
        } else {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                if let ledger, let share = calculator.split(total: source.total).first {
                    ImpactBlock(
                        title: AppLocale.string(
                            "Ton disponible de \(Formatters.monthNameInText(for: calculator.start.month))"
                        ),
                        impact: source.impact(share: share, on: ledger),
                        currency: currency,
                        note: impactNote
                    )
                }
                if source.sourceType == .transaction {
                    Text("Le réel est remplacé par le plan.")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                }
                if let remainder = calculator.remainderMonthName(total: source.total) {
                    Text("Le mois de \(remainder) porte quelques centimes de plus.")
                        .font(PulpeTypography.captionRegular)
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    /// « Les 11 mois suivants prennent 120.00 chacun. Ceux qui manquent sont créés avec ton modèle. »
    private var impactNote: String {
        AppLocale.string("""
            Les \(calculator.selectedCount - 1) mois suivants prennent \(perMonthText) chacun. \
            Ceux qui manquent sont créés avec ton modèle.
            """)
    }

    // MARK: - Submit

    private var submitButton: some View {
        Button {
            Task {
                // `isSubmitting` guards against a double-tap (the button is also
                // disabled while it's true) AND drives the blocking overlay. We
                // await the caller's spread work and dismiss only once it
                // completes, so the user gets in-progress feedback instead of an
                // instant close (parity with the additive `AddBudgetLineSheet`).
                guard !isSubmitting else { return }
                isSubmitting = true
                // Reset on every exit path so the sheet can never lock with the
                // overlay up + cancel/swipe disabled — same escape hatch as every
                // other submit handler (e.g. `AddBudgetLineSheet`). In the normal
                // path `dismiss()` tears the view down anyway; this only matters if
                // `dismiss()` no-ops or `onSpread` ever becomes throwing.
                defer { isSubmitting = false }
                await onSpread(calculator.periods())
                dismiss()
            }
        } label: {
            Text(AppLocale.string("Lisser sur \(calculator.selectedCount) mois"))
        }
        .disabled(!calculator.isValid || isSubmitting)
        .primaryButtonStyle(isEnabled: calculator.isValid && !isSubmitting)
    }
}

#Preview {
    SpreadExistingSheet(
        source: SpreadExistingSource(
            id: "line-1",
            sourceType: .budgetLine,
            kind: .expense,
            name: "Assurance auto",
            total: 1200,
            month: 6,
            year: 2026
        ),
        currency: .chf
    ) { _ in }
}
