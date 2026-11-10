import SwiftUI

struct GoalPlanTimelinePresentation {
    private static let openMonthsWindow = 3

    let months: [SavingsGoalPlanMonth]
    let isExpanded: Bool

    private var currentIndex: Int {
        months.firstIndex { $0.state == .current } ?? 0
    }

    private var collapsedMonths: [SavingsGoalPlanMonth] {
        guard !months.isEmpty else { return [] }
        let end = min(months.count, currentIndex + Self.openMonthsWindow + 1)
        return Array(months[currentIndex..<end])
    }

    var visibleMonths: [SavingsGoalPlanMonth] {
        isExpanded ? months : collapsedMonths
    }

    var hiddenCount: Int {
        max(0, months.count - visibleMonths.count)
    }

    var canToggle: Bool {
        collapsedMonths.count < months.count
    }

    var repairableMonths: [SavingsGoalPlanMonth] {
        months.filter(\.isRepairable)
    }

    /// A realised plan withdrawal is editable from the budget line that the
    /// plan created. Period matching alone is not enough: the same month may
    /// contain another income linked to the goal, including a legacy row whose
    /// origin is absent.
    static func budgetId(
        forFrozenMonth month: SavingsGoalPlanMonth,
        plannedWithdrawals: [SavingsGoalPlannedWithdrawal]
    ) -> String? {
        guard month.planWithdrawalConsumedAmount.rounded(2) > 0 else {
            return nil
        }
        return plannedWithdrawals.first {
            $0.month == month.month
                && $0.year == month.year
                && $0.origin == .planLinked
        }?.budgetId
    }
}

/// The plan read as a few ranges instead of one row per month. The
/// closed months fold into one range, the current month stands alone, and the months
/// ahead group into runs that either carry a prévision or carry none (« Rien de prévu »).
struct GoalMonthByMonthPresentation: Equatable {
    struct Segment: Identifiable, Equatable {
        enum Kind: Equatable { case past, current, planned, empty }

        let kind: Kind
        let months: [SavingsGoalPlanMonth]
        let title: String
        let subtitle: String
        let amount: Decimal?

        var id: Int { months.first?.id ?? 0 }
    }

    let segments: [Segment]

    init(months: [SavingsGoalPlanMonth], initialAmount: Decimal, currency: SupportedCurrency) {
        var segments: [Segment] = []
        let past = months.filter { $0.state == .past }
        if !past.isEmpty {
            segments.append(Self.pastSegment(past, initialAmount: initialAmount, currency: currency))
        }
        if let current = months.first(where: { $0.state == .current }) {
            segments.append(current.lines.isEmpty
                ? Self.runSegment([current], currency: currency)
                : Self.currentSegment(current, currency: currency))
        }
        var run: [SavingsGoalPlanMonth] = []
        for month in months where month.state == .future || month.state == .gap {
            if let last = run.last, last.lines.isEmpty != month.lines.isEmpty {
                segments.append(Self.runSegment(run, currency: currency))
                run = []
            }
            run.append(month)
        }
        if !run.isEmpty { segments.append(Self.runSegment(run, currency: currency)) }
        self.segments = segments
    }

    /// The first run with nothing planned: what « Planifier … » fills.
    var firstEmptyRun: Segment? {
        segments.first { $0.kind == .empty && $0.months.first?.state != .current }
    }

    /// « Planifier décembre à juin ».
    var planTitle: String? {
        firstEmptyRun.map { AppLocale.string("Planifier \(Self.rangeTitle($0.months, capitalized: false))") }
    }

    /// « Planifier … » on the repair path: exactly the months the repair writes.
    /// An unbroken run, or two months of the same year, read as « mars à mai »; a gap
    /// reads as a count, so the title never names a month the repair skips.
    static func repairTitle(_ months: [SavingsGoalPlanMonth]) -> String? {
        let repairable = months.filter(\.isRepairable)
        guard !repairable.isEmpty else { return nil }
        let isContiguous = zip(repairable, repairable.dropFirst()).allSatisfy {
            $1.year * 12 + $1.month == $0.year * 12 + $0.month + 1
        }
        let isSameYearPair = repairable.count <= 2 && repairable.first?.year == repairable.last?.year
        guard isSameYearPair || isContiguous else {
            return AppLocale.string("Planifier \(repairable.count) mois")
        }
        return AppLocale.string("Planifier \(rangeTitle(repairable, capitalized: false))")
    }

    /// « Mars à octobre », « Août et septembre », « Mars 2025 à septembre », « Novembre ».
    static func rangeTitle(_ months: [SavingsGoalPlanMonth], capitalized: Bool = true) -> String {
        guard let first = months.first, let last = months.last else { return "" }
        let firstName = capitalized
            ? Formatters.monthName(for: first.month)
            : Formatters.monthNameInText(for: first.month)
        guard months.count > 1 else { return firstName }
        let lastName = Formatters.monthNameInText(for: last.month)
        if first.year != last.year {
            return AppLocale.string("\("\(firstName) \(first.year)") à \(lastName)")
        }
        return months.count == 2
            ? AppLocale.string("\(firstName) et \(lastName)")
            : AppLocale.string("\(firstName) à \(lastName)")
    }

    private static func pastSegment(
        _ months: [SavingsGoalPlanMonth],
        initialAmount: Decimal,
        currency: SupportedCurrency
    ) -> Segment {
        let pointed = months.count { $0.confirmedAmount > 0 }
        let pointedCopy = AppLocale.string("\(pointed) mois pointés")
        let subtitle = initialAmount > 0
            ? AppLocale.string("Départ \(initialAmount.asAmount(for: currency)) + \(pointedCopy)")
            : pointedCopy
        return Segment(
            kind: .past,
            months: months,
            title: rangeTitle(months),
            subtitle: subtitle,
            amount: months.last?.confirmedCumulative
        )
    }

    private static func currentSegment(_ month: SavingsGoalPlanMonth, currency: SupportedCurrency) -> Segment {
        let checked = month.lines.compactMap { $0.checkedAt.flatMap(GoalHeroPresentation.parseTimestamp) }.max()
        let subtitle = checked.map { date -> String in
            let cumul = month.confirmedCumulative.asAmount(for: currency)
            return AppLocale.string("Pointé le \(date.dayMonthFormatted) · cumul \(cumul)")
        } ?? AppLocale.string("À pointer · cumul \(month.plannedCumulative.asAmount(for: currency))")
        return Segment(
            kind: .current,
            months: [month],
            title: Formatters.monthName(for: month.month),
            subtitle: subtitle,
            amount: month.plannedAmount
        )
    }

    private static func runSegment(_ months: [SavingsGoalPlanMonth], currency: SupportedCurrency) -> Segment {
        guard months.first?.lines.isEmpty == false else {
            let subtitle = months.allSatisfy { !$0.hasBudget }
                ? AppLocale.string("Pas encore de budget")
                : AppLocale.string("Aucune prévision liée")
            return Segment(kind: .empty, months: months, title: rangeTitle(months), subtitle: subtitle, amount: nil)
        }
        let amounts = Set(months.map(\.plannedAmount))
        let subtitle = amounts.count == 1
            ? AppLocale.string("\(months.count) mois à \(months[0].plannedAmount.asAmount(for: currency))")
            : AppLocale.string("\(months.count) mois prévus")
        return Segment(
            kind: .planned,
            months: months,
            title: rangeTitle(months),
            subtitle: subtitle,
            amount: months.reduce(Decimal.zero) { $0 + $1.plannedAmount }
        )
    }
}
