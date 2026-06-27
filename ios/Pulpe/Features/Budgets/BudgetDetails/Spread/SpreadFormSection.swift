import SwiftUI

/// The "Lisser sur plusieurs mois" block of the add-budget-line sheet (PUL-17).
///
/// Owns the De/À month pickers, the help text, the deselectable months grid, the
/// total/per-month echo and inline validation. All window/selection state lives in
/// the injected `SpreadCalculator` (the tested B-only engine) — this view only
/// renders it and routes taps back. The echo reads the amount entered in the hero
/// field above and its `amountMode`: in `.perMonth` it shows `amount × N`; in
/// `.total` it previews the cents-preserving per-month split.
struct SpreadFormSection: View {
    let calculator: SpreadCalculator
    let amount: Decimal?
    let amountMode: SpreadAmountMode
    let currency: SupportedCurrency
    let accentColor: Color

    @State private var activePicker: SpreadPicker?

    private enum SpreadPicker: Identifiable {
        case start
        case end
        var id: String { self == .start ? "start" : "end" }
    }

    /// Adaptive grid — chips wrap across rows, sized to fit up to 36 months.
    private let columns = [
        GridItem(.adaptive(minimum: 96), spacing: DesignTokens.Spacing.sm),
    ]

    /// Picker year span: the anchor year through the cap (36 months ≈ 3 years ahead).
    private var yearRange: ClosedRange<Int> {
        let lower = calculator.start.year
        return lower...(lower + 4)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
            monthRangeRow

            Text("On répartit cette dépense sur les mois que tu choisis. Désélectionne ceux à sauter.")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.onSurfaceVariant)
                .fixedSize(horizontal: false, vertical: true)

            monthsGrid

            totalEcho

            if let message = calculator.validationMessage {
                ErrorBanner(message: message)
            }
        }
        .animation(.snappy(duration: DesignTokens.Animation.fast), value: calculator.windowMonths)
        .sheet(item: $activePicker) { picker in
            pickerSheet(for: picker)
        }
    }

    // MARK: - De → À row

    private var monthRangeRow: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            monthPickerButton(label: "De", value: calculator.start.longName) { activePicker = .start }
            monthPickerButton(label: "À", value: calculator.end.longName) { activePicker = .end }
        }
    }

    private func monthPickerButton(label: String, value: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(label)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
                HStack {
                    Text(value)
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
        .accessibilityLabel("\(label) : \(value)")
    }

    // MARK: - Months grid

    @ViewBuilder
    private var monthsGrid: some View {
        let months = calculator.windowMonths
        if !months.isEmpty {
            LazyVGrid(columns: columns, alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                ForEach(months) { month in
                    monthChip(month)
                }
            }
        }
    }

    private func monthChip(_ month: SpreadMonth) -> some View {
        let isOn = calculator.isSelected(month)
        return Button {
            withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                calculator.toggle(month)
            }
        } label: {
            PulpeChip(label: month.name, style: isOn ? .solid : .outlined)
                .strikethrough(!isOn, color: Color.onSurfaceVariant)
        }
        .plainPressedButtonStyle()
        .accessibilityLabel(month.longName)
        .accessibilityValue(isOn ? "Sélectionné" : "Désélectionné")
        .accessibilityAddTraits(isOn ? .isSelected : [])
    }

    // MARK: - Total / per-month echo

    private var totalEcho: some View {
        HStack {
            Text(echoLabel)
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
            Spacer()
            Text(echoAmount.asCurrency(currency))
                .font(PulpeTypography.headline)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity)
        .background(Color.surfaceContainerHigh, in: .rect(cornerRadius: DesignTokens.CornerRadius.button))
        .accessibilityElement(children: .combine)
    }

    /// `.perMonth`: "Total · N mois" — the right side is `amount × N`.
    /// `.total`: "≈ {part}/mois · N mois" — the right side is the exact total typed,
    /// the label previews the first cents-preserving part (server is authoritative).
    private var echoLabel: String {
        let count = calculator.selectedCount
        switch amountMode {
        case .perMonth:
            return "Total · \(count) mois"
        case .total:
            let firstPart = SpreadSplit
                .splitTotalPreserving(total: amount ?? 0, partCount: count)
                .first ?? 0
            return "≈ \(firstPart.asCurrency(currency))/mois · \(count) mois"
        }
    }

    /// `.perMonth`: `amount × N`. `.total`: the exact amount typed (the total).
    private var echoAmount: Decimal {
        switch amountMode {
        case .perMonth:
            return calculator.total(amountPerMonth: amount ?? 0)
        case .total:
            return amount ?? 0
        }
    }

    // MARK: - Picker sheet

    @ViewBuilder
    private func pickerSheet(for picker: SpreadPicker) -> some View {
        switch picker {
        case .start:
            SpreadMonthPickerSheet(
                title: "Premier mois",
                initial: calculator.start,
                yearRange: yearRange,
                accentColor: accentColor
            ) { calculator.setStart($0) }
        case .end:
            SpreadMonthPickerSheet(
                title: "Dernier mois",
                initial: calculator.end,
                yearRange: yearRange,
                accentColor: accentColor
            ) { calculator.setEnd($0) }
        }
    }
}

#Preview {
    @Previewable @State var calculator = SpreadCalculator(anchorMonth: 6, anchorYear: 2026)
    ScrollView {
        SpreadFormSection(
            calculator: calculator,
            amount: 1200,
            amountMode: .total,
            currency: .chf,
            accentColor: .financialExpense
        )
        .padding()
    }
}
