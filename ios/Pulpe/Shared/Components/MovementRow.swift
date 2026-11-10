import SwiftUI

/// What a movement row says under its name. Pure, so the three screens that list movements
/// (Accueil, Mouvements, À pointer) speak the same way.
enum MovementRowPresentation {
    /// The prévision the movement was counted in, then its pointed state. A free movement
    /// names where it sits instead, in the same quiet line: "Hors prévision", or "Épargne".
    /// `pointedNote` replaces "pointé" while a row that was just pointed stays on a list.
    static func subtitle(
        for transaction: Transaction,
        lineName: String?,
        pointedNote: String? = nil
    ) -> String? {
        let pointed = transaction.isChecked ? (pointedNote ?? AppLocale.string("pointé")) : nil
        let place = lineName ?? (transaction.isFree
            ? (transaction.kind == .saving ? AppLocale.string("Épargne") : PendingWording.unplanned) : nil)
        return [place, pointed].compactMap { $0 }.joined(separator: " · ").nilIfEmpty
    }

    /// Plain amount, ink only; an income keeps its `+` because nothing else tells it apart.
    static func amountText(for transaction: Transaction, in currency: SupportedCurrency) -> String {
        let amount = transaction.amount.asAmount(for: currency)
        return transaction.kind == .income ? "+\(amount)" : amount
    }
}

private extension String {
    var nilIfEmpty: String? { isEmpty ? nil : self }
}

/// The V2 ledger row of a movement: the pointing circle, the name over its prévision, the
/// amount. The circle and the rest of the row are two separate targets (point / open).
struct MovementRow: View {
    let transaction: Transaction
    let lineName: String?
    let currency: SupportedCurrency
    var isSyncing = false
    var showsChevron = false
    var pointedNote: String?
    let onToggle: () -> Void
    let onOpen: () -> Void

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            PointCircle(isPointed: transaction.isChecked, isSyncing: isSyncing, onToggle: onToggle)
                .accessibilityIdentifier("movementPointCircle-\(transaction.id)")

            Button(action: onOpen) {
                HStack(spacing: DesignTokens.Spacing.md) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                        Text(transaction.name)
                            .font(PulpeTypography.rowTitle)
                            .foregroundStyle(Color.textPrimary)
                            .lineLimit(1)
                            .truncationMode(.tail)
                        subtitleLine
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)

                    amountColumn

                    if showsChevron { RowChevron() }
                }
                .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
                .frame(minHeight: DesignTokens.ListRow.minHeight)
                .contentShape(Rectangle())
            }
            .plainPressedButtonStyle()
            .accessibilityHint("Touche pour modifier")
            // On the open button, not the row: there it would overwrite the point circle's id.
            .accessibilityIdentifier("movementRow-\(transaction.id)")
        }
        .padding(.leading, DesignTokens.Spacing.xs)
        .padding(.trailing, DesignTokens.Spacing.lg)
    }

    @ViewBuilder
    private var subtitleLine: some View {
        if let subtitle = MovementRowPresentation.subtitle(
            for: transaction, lineName: lineName, pointedNote: pointedNote
        ) {
            Text(subtitle)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .lineLimit(1)
                .truncationMode(.tail)
        }
    }

    private var amountColumn: some View {
        VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
            Text(MovementRowPresentation.amountText(for: transaction, in: currency))
                .font(PulpeTypography.rowAmount)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
            if let secondary = TransactionAmountView.secondaryText(for: transaction, in: currency) {
                Text(secondary)
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .accessibilityLabel("saisi en \(secondary)")
            }
        }
        .sensitiveAmount()
    }
}

// MARK: - Day groups

/// A day of movements, newest first. Shared by the Accueil list and the Mouvements page.
struct MovementDayGroup: Identifiable, Equatable {
    let id: Date
    let transactions: [Transaction]

    /// Newest day first; inside a day, the order of `transactions` (already newest first).
    static func groups(of transactions: [Transaction], calendar: Calendar = .current) -> [MovementDayGroup] {
        let sorted = transactions.sorted { $0.transactionDate > $1.transactionDate }
        var order: [Date] = []
        var byDay: [Date: [Transaction]] = [:]
        for transaction in sorted {
            let day = calendar.startOfDay(for: transaction.transactionDate)
            if byDay[day] == nil { order.append(day) }
            byDay[day, default: []].append(transaction)
        }
        return order.map { MovementDayGroup(id: $0, transactions: byDay[$0] ?? []) }
    }

    /// "Aujourd'hui", "Hier", then the weekday of the week.
    var shortLabel: String { id.relativeFormatted }

    /// "Aujourd'hui · 3 nov." / "Hier · 2 nov." / "Samedi 1 nov.": the page that lists the whole month.
    var fullLabel: String {
        let calendar = Calendar.current
        let day = Formatters.dayMonthLabel(for: id)
        if calendar.isDateInToday(id) || calendar.isDateInYesterday(id) {
            return "\(id.relativeFormatted) · \(day)"
        }
        return "\(Formatters.weekday.string(from: id).capitalized) \(day)"
    }
}

/// A white card holding the rows of one day, hairlines between them.
struct MovementCard<Content: View>: View {
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.none) { content }
            .pulpeSurfaceCard()
    }
}
