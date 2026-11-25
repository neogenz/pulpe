import SwiftUI

/// What one history line says, in the app language: the movement's name or « Valeur
/// enregistrée », its date, its signed amount (`nil` without an exchange rate) and, for a
/// movement an entry has taken over, the legend. VoiceOver reads the same words.
struct AssetHistoryLine: Equatable {
    let title: String
    let date: String
    let amount: String?
    let legend: String?
    let isSuperseded: Bool

    /// The amount is left out while amounts are hidden, as the blurred figure is.
    func accessibilityLabel(amountsHidden: Bool) -> String {
        [title, date, amountsHidden ? nil : amount, legend].compactMap(\.self).joined(separator: ", ")
    }

    init(
        _ entry: AssetHistoryEntry,
        currency: SupportedCurrency,
        now: Date = Date(),
        calendar: Calendar = .current,
        language: SupportedLocale = AppLocale.current
    ) {
        let locale = AppLocale.uiLocale(for: language)
        let day = { (date: Date) in Self.dayLabel(date, now: now, calendar: calendar, language: language) }
        switch entry.kind {
        case .snapshot(let value):
            title = AppLocale.string("Valeur enregistrée", locale: locale)
            date = day(entry.at)
            amount = value.netWorthSigned(currency, showsPlus: false)
            legend = nil
            isSuperseded = false
        case let .movement(name, effect, supersededAt):
            title = name
            date = day(entry.at)
            amount = effect?.netWorthSigned(currency, showsPlus: true)
            legend = supersededAt.map {
                AppLocale.string("Déjà compris dans ta saisie du \(day($0))", locale: locale)
            }
            isSuperseded = supersededAt != nil
        }
    }

    /// « 3 novembre » this year, « 3 novembre 2025 » before, as the row's last entry.
    static func dayLabel(_ date: Date, now: Date, calendar: Calendar, language: SupportedLocale) -> String {
        Formatters.dayMonthLabel(
            for: date,
            in: language,
            withYear: !calendar.isDate(date, equalTo: now, toGranularity: .year)
        )
    }
}

/// One history line. A movement an entry has taken over reads in the secondary ink with its
/// legend: it stays visible but no longer counts in the value. At accessibility sizes the amount
/// goes under the name, as on `NetWorthAssetRow`.
struct AssetHistoryRow: View {
    let line: AssetHistoryLine
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.amountsHidden) private var amountsHidden

    private var ink: Color { line.isSuperseded ? .textSecondary : .textPrimary }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    title
                    amount
                }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
                    title
                    Spacer(minLength: DesignTokens.Spacing.sm)
                    amount
                }
            }
            Text(line.date)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
            if let legend = line.legend {
                Text(legend)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, DesignTokens.Spacing.md)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(line.accessibilityLabel(amountsHidden: amountsHidden))
    }

    private var title: some View {
        Text(line.title)
            .font(line.isSuperseded ? PulpeTypography.rowTitleRegular : PulpeTypography.rowTitle)
            .foregroundStyle(ink)
    }

    private var amount: some View {
        Text(line.amount ?? "—")
            .font(PulpeTypography.rowAmount)
            .foregroundStyle(ink)
            .sensitiveAmount()
    }
}
