import Foundation

/// Everything the goal hero card shows, resolved once from the server-computed
/// progression. A pure value on purpose: every line of the card is conditional,
/// and conditions buried in a `body` can only be checked by launching the app.
///
/// The card answers one question, « où j'en suis »: the saved figure against the
/// cible and the bar. The pace sentence is resolved here too, for « Ce mois-ci ». The
/// derived states (atteint, retard, en pause) speak in their own card below, so the
/// sentence stays quiet for them.
struct GoalHeroPresentation: Equatable {
    struct Bar: Equatable {
        let fraction: Double
        let percent: String
        /// « il reste X », « il manque X » or « cible atteinte le … ».
        let trailing: String?
        /// A paused goal draws its bar in grey.
        let isMuted: Bool
        let accessibilityLabel: String
    }

    /// The page subtitle under the goal name; keeps the identifier the detail UI
    /// tests read to tell which date variant a goal renders.
    struct DateLine: Equatable {
        let text: String
        let identifier: String?
    }

    let confirmedAmount: Decimal
    /// « sur 6'000.00 · dont 400.00 de départ ».
    let caption: String?
    let dateLine: DateLine?
    let bar: Bar?
    let sentence: String?

    init(
        progress: SavingsGoalProgress,
        status: SavingsGoalStatus,
        currency: SupportedCurrency
    ) {
        confirmedAmount = progress.confirmed
        caption = Self.makeCaption(progress, currency: currency)
        dateLine = Self.makeDateLine(progress)
        bar = Self.makeBar(progress, status: status, currency: currency)

        // The pace sentence belongs to the ordinary state only: a derived-state card
        // already says what to do when the goal is reached, late or paused.
        let isOrdinary = status == .active && !progress.isOverdue && progress.suggestCompletion != true
        sentence = isOrdinary ? Self.makeSentence(progress, currency: currency) : nil
    }

    /// « Juin 2027 », or « juin 2027 » inside a sentence.
    static func monthYear(month: Int, year: Int, capitalized: Bool) -> String {
        let name = capitalized ? Formatters.monthName(for: month) : Formatters.monthNameInText(for: month)
        return "\(name) \(year)"
    }

    private static func components(_ date: Date) -> (month: Int, year: Int) {
        let parts = Calendar.current.dateComponents([.month, .year], from: date)
        return (parts.month ?? 1, parts.year ?? 0)
    }

    private static func makeCaption(_ progress: SavingsGoalProgress, currency: SupportedCurrency) -> String? {
        let initial = progress.initialAmount > 0 ? progress.initialAmount.asAmount(for: currency) : nil
        switch (progress.targetAmount.map { $0.asAmount(for: currency) }, initial) {
        case let (target?, initial?): return AppLocale.string("sur \(target) · dont \(initial) de départ")
        case let (target?, nil): return AppLocale.string("sur \(target)")
        case let (nil, initial?): return AppLocale.string("Dont \(initial) de départ")
        case (nil, nil): return nil
        }
    }

    private static func makeDateLine(_ progress: SavingsGoalProgress) -> DateLine? {
        let start = progress.startDateValue.map(components)
        let end = progress.targetDateValue.map(components)
        if let start, let end {
            // Two dates and an arrow: nothing to translate, so no catalog key.
            return DateLine(
                text: "\(monthYear(month: start.month, year: start.year, capitalized: true))"
                    + " → \(monthYear(month: end.month, year: end.year, capitalized: false))",
                identifier: "savingsGoalDeadlineRange"
            )
        }
        if let end {
            let date = monthYear(month: end.month, year: end.year, capitalized: false)
            return DateLine(text: AppLocale.string("Échéance \(date)"), identifier: "savingsGoalDeadlineDate")
        }
        if let start {
            let date = monthYear(month: start.month, year: start.year, capitalized: false)
            return DateLine(text: AppLocale.string("Depuis \(date)"), identifier: nil)
        }
        return nil
    }

    private static func makeBar(
        _ progress: SavingsGoalProgress,
        status: SavingsGoalStatus,
        currency: SupportedCurrency
    ) -> Bar? {
        guard let target = progress.targetAmount, target > 0 else { return nil }
        let percent = Decimal(progress.achievementPercent ?? 0).asPercentage()
        let left = target - progress.confirmed
        let trailing: String?
        if left <= 0 {
            trailing = lastCheckedDate(progress).map {
                AppLocale.string("cible atteinte le \($0.dayMonthFormatted)")
            } ?? AppLocale.string("cible atteinte")
        } else if progress.isOverdue {
            trailing = AppLocale.string("il manque \(left.asAmount(for: currency))")
        } else {
            trailing = AppLocale.string("il reste \(left.asAmount(for: currency))")
        }
        return Bar(
            fraction: progress.confirmedFraction ?? 0,
            percent: percent,
            trailing: trailing,
            isMuted: status == .paused,
            accessibilityLabel: AppLocale.string("\(percent) de la cible épargné")
        )
    }

    /// The day the last linked prévision was pointed: the day the cible was reached
    /// when the goal stands at or past it.
    static func lastCheckedDate(_ progress: SavingsGoalProgress) -> Date? {
        progress.months
            .flatMap(\.lines)
            .compactMap { $0.checkedAt.flatMap(parseTimestamp) }
            .max()
    }

    static func parseTimestamp(_ value: String) -> Date? {
        let withFraction = ISO8601DateFormatter()
        withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return withFraction.date(from: value) ?? ISO8601DateFormatter().date(from: value)
    }

    /// « Vise X par mois pour finir en juin. Depuis août, tu mets Y par mois. »
    /// The second half needs a closed month to have a rhythm to quote.
    private static func makeSentence(
        _ progress: SavingsGoalProgress,
        currency: SupportedCurrency
    ) -> String? {
        var parts: [String] = []
        if let required = progress.required, required > 0, let deadline = progress.targetDateValue {
            let month = Formatters.monthNameInText(for: components(deadline).month)
            let amount = required.rounded(2, .up).asAmount(for: currency)
            parts.append(AppLocale.string("Vise \(amount) par mois pour finir en \(month)."))
        }
        if progress.hasClosedPlanMonth, progress.confirmedPace > 0, let start = progress.startDateValue {
            let month = Formatters.monthNameInText(for: components(start).month)
            let pace = progress.confirmedPace.asAmount(for: currency)
            parts.append(AppLocale.string("Depuis \(month), tu mets \(pace) par mois."))
        }
        return parts.isEmpty ? nil : parts.joined(separator: " ")
    }
}
