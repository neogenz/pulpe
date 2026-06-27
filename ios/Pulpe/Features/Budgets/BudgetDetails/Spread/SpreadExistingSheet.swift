import SwiftUI

/// PUL-17 v1.1 — "lisser une dépense existante" sheet (total-preserving).
///
/// The source total is LOCKED (read-only): the user picks the end month + the
/// months to skip, and `T` is redistributed into `T/N` via the calculator's
/// `SpreadSplit` (M0 included, drops to ~T/N). Mirrors the web
/// `SpreadExistingDialog`. On submit it emits the chosen `periods` and dismisses;
/// the caller routes them to the coordinator (which deletes the source + fans out).
struct SpreadExistingSheet: View {
    let source: SpreadExistingSource
    let currency: SupportedCurrency
    let onSpread: ([SpreadFromExistingPeriod]) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var calculator: SpreadExistingCalculator
    @State private var isPickingEnd = false

    init(
        source: SpreadExistingSource,
        currency: SupportedCurrency,
        onSpread: @escaping ([SpreadFromExistingPeriod]) -> Void
    ) {
        self.source = source
        self.currency = currency
        self.onSpread = onSpread
        self._calculator = State(
            initialValue: SpreadExistingCalculator(anchorMonth: source.month, anchorYear: source.year)
        )
    }

    private var accentColor: Color { Color.financialColor(for: source.kind) }
    // Source kind drives the noun — a spread saving must read "épargne", not
    // "dépense" (same accord as the `disclosure` body and the additive flow).
    private var spreadTitle: String {
        source.kind == .saving ? "Lisser l'épargne" : "Lisser la dépense"
    }
    // M0 is locked, so the window is [M0, M0+35] at most (36-month cap). The
    // worst case (M0 = December) ends in `start.year + 3`; +4 over-exposed a year
    // of months the validation would reject.
    private var yearRange: ClosedRange<Int> { calculator.start.year...(calculator.start.year + 3) }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    lockedTotalCard
                    helpText
                    monthRangeRow
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
                ToolbarItem(placement: .cancellationAction) { SheetCloseButton() }
            }
            .sheet(isPresented: $isPickingEnd) {
                SpreadMonthPickerSheet(
                    title: "Dernier mois",
                    initial: calculator.end,
                    yearRange: yearRange,
                    accentColor: accentColor
                ) { calculator.setEnd($0) }
            }
        }
        .standardSheetPresentation(detents: [.medium, .large])
    }

    // MARK: - Locked total

    private var lockedTotalCard: some View {
        HStack {
            Label("Montant total", systemImage: "lock.fill")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.onSurfaceVariant)
            Spacer()
            Text(source.total.asCurrency(currency))
                .font(PulpeTypography.headline)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity)
        .background(Color.surfaceContainer, in: .rect(cornerRadius: DesignTokens.CornerRadius.button))
        .accessibilityElement(children: .combine)
    }

    private var helpText: some View {
        Text(
            "On répartit ce montant à parts égales sur les mois que tu choisis, "
                + "à partir de ce mois-ci. Désélectionne ceux à sauter."
        )
            .font(PulpeTypography.caption)
            .foregroundStyle(Color.onSurfaceVariant)
            .fixedSize(horizontal: false, vertical: true)
    }

    // MARK: - De (locked) → À (picker)

    private var monthRangeRow: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            lockedFromField
            endPickerButton
        }
    }

    private var lockedFromField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text("De")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.onSurfaceVariant)
            Text(calculator.start.longName)
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.surfaceContainer, in: .rect(cornerRadius: DesignTokens.CornerRadius.button))
        .accessibilityLabel("De : \(calculator.start.longName)")
    }

    private var endPickerButton: some View {
        Button { isPickingEnd = true } label: {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text("À")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                HStack {
                    Text(calculator.end.longName)
                        .font(PulpeTypography.subheadline)
                        .foregroundStyle(Color.textPrimary)
                    Spacer(minLength: 0)
                    Image(systemName: "chevron.up.chevron.down")
                        .font(PulpeTypography.metricMini)
                        .foregroundStyle(Color.textTertiary)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surfaceContainerHigh, in: .rect(cornerRadius: DesignTokens.CornerRadius.button))
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .contentShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
        .plainPressedButtonStyle()
        .accessibilityLabel("À : \(calculator.end.longName)")
    }

    // MARK: - Months grid

    private let columns = [GridItem(.adaptive(minimum: 96), spacing: DesignTokens.Spacing.sm)]

    @ViewBuilder
    private var monthsGrid: some View {
        let months = calculator.windowMonths
        if !months.isEmpty {
            LazyVGrid(columns: columns, alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                ForEach(months) { month in
                    monthChip(month)
                }
            }
            .animation(.snappy(duration: DesignTokens.Animation.fast), value: calculator.windowMonths)
        }
    }

    private func monthChip(_ month: SpreadMonth) -> some View {
        let isOn = calculator.isSelected(month)
        return Button {
            withAnimation(.snappy(duration: DesignTokens.Animation.fast)) { calculator.toggle(month) }
        } label: {
            PulpeChip(label: month.name, style: isOn ? .solid : .outlined)
                .strikethrough(!isOn, color: Color.onSurfaceVariant)
        }
        .disabled(calculator.isLocked(month))
        .plainPressedButtonStyle()
        .accessibilityLabel(month.longName)
        .accessibilityValue(isOn ? "Sélectionné" : "Désélectionné")
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }

    // MARK: - Echo

    @ViewBuilder
    private var echo: some View {
        if let message = calculator.validationMessage {
            ErrorBanner(message: message)
        } else {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text(disclosure)
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                    .sensitiveAmount()

                if let remainder = calculator.remainderMonthName(total: source.total) {
                    Text("Le mois de \(remainder) porte quelques centimes de plus.")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.onSurfaceVariant)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.surfaceContainerLow, in: .rect(cornerRadius: DesignTokens.CornerRadius.button))
        }
    }

    private var disclosure: String {
        let count = calculator.selectedCount
        let perMonth = calculator.perMonth(total: source.total).asCurrency(currency)
        let total = source.total.asCurrency(currency)
        switch source.sourceType {
        case .transaction:
            // Source kind drives the noun — a spread saving must read "épargne",
            // not "dépense" (same accord as the additive successMessage).
            let noun = source.kind == .saving ? "épargne" : "dépense"
            return "On transforme cette \(noun) de \(total) en un plan lissé : "
                + "\(perMonth) par mois sur \(count) mois. Le réel est remplacé par le plan."
        case .budgetLine:
            return "On répartit cette prévision de \(total) en \(perMonth) par mois sur \(count) mois."
        }
    }

    // MARK: - Submit

    private var submitButton: some View {
        Button {
            onSpread(calculator.periods())
            dismiss()
        } label: {
            Text(spreadTitle)
        }
        .disabled(!calculator.isValid)
        .primaryButtonStyle(isEnabled: calculator.isValid)
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
