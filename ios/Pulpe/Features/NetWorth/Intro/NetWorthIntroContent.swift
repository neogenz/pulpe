import Foundation

/// The three pages of the explainer, in order.
enum NetWorthIntroStep: Int, CaseIterable {
    case overview, netWorth, update

    var next: NetWorthIntroStep? { Self(rawValue: rawValue + 1) }
}

/// Where the explainer was opened from, sent with every intro event.
enum NetWorthIntroSource: String, Identifiable {
    case auto, help

    var id: String { rawValue }
}

/// What the primary button does.
enum NetWorthIntroAction: Equatable {
    case next, done, add

    /// « Suivant » until the last page; there, an empty net worth gets « Ajouter mon premier compte ».
    static func primaryAction(step: NetWorthIntroStep, isEmpty: Bool) -> NetWorthIntroAction {
        guard step.next == nil else { return .next }
        return isEmpty ? .add : .done
    }
}

/// How one opening of the explainer ended.
enum NetWorthIntroOutcome: Equatable {
    case completed(NetWorthIntroAction)
    case skipped(NetWorthIntroStep)

    var event: AnalyticsEvent {
        switch self {
        case .completed: .netWorthIntroCompleted
        case .skipped: .netWorthIntroSkipped
        }
    }

    /// Contract in `ANALYTICS_EVENTS` (shared/src/feature-flags.ts).
    func properties(source: NetWorthIntroSource) -> [String: Any] {
        switch self {
        case .completed(let action):
            ["source": source.rawValue, "action": action == .add ? "add_asset" : "close"]
        case .skipped(let step):
            ["source": source.rawValue, "step": step.rawValue]
        }
    }
}

/// Lets exactly one end event out per opening: the final button and the sheet's disappearance
/// both report, only the first one counts.
struct NetWorthIntroCompletion {
    private var hasFinished = false

    mutating func finish(_ outcome: NetWorthIntroOutcome) -> NetWorthIntroOutcome? {
        guard !hasFinished else { return nil }
        hasFinished = true
        return outcome
    }
}

/// The example figures every platform tells the same story with. Totals are computed from the
/// lines, so the scene can never show numbers that contradict each other.
enum NetWorthIntroSample {
    struct Line: Identifiable {
        let name: String
        let systemImage: String
        let value: Decimal

        var id: String { systemImage }
    }

    static var assets: [Line] {
        [
            Line(name: AppLocale.string("Compte courant"), systemImage: "building.columns", value: 3200),
            Line(name: AppLocale.string("Épargne"), systemImage: "cylinder.split.1x2", value: savingsBefore),
            Line(name: AppLocale.string("Placements"), systemImage: "chart.line.uptrend.xyaxis", value: 8000),
            Line(name: AppLocale.string("Voiture"), systemImage: "car", value: 9000)
        ]
    }

    static let debt: Decimal = 6000
    static let savingsBefore: Decimal = 12000
    static let savingsAfter: Decimal = 12500
    static let budgetSuggestion: Decimal = 500

    static var gross: Decimal { assets.reduce(0) { $0 + $1.value } }
    static var netBefore: Decimal { gross - debt }
    static var netAfter: Decimal { netBefore - savingsBefore + savingsAfter }
}
