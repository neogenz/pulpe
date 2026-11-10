import Foundation
@testable import Pulpe
import Testing

@MainActor @Suite("GoalProjectionChart accessibility summary")
struct GoalProjectionChartTests {
    private func series(target: Double?) -> GoalProjectionSeries {
        GoalProjectionSeries(
            confirmed: [.init(index: 0, value: 1234), .init(index: 1, value: 2345)],
            projection: [.init(index: 1, value: 2345), .init(index: 2, value: 3456)],
            target: target,
            ticks: []
        )
    }

    @Test("hidden amounts speak only « Montant masqué »")
    func hiddenSpeaksNoAmount() {
        let summary = GoalProjectionChart.accessibilitySummary(
            series: series(target: 5678), currency: .chf, amountsHidden: true
        )

        #expect(summary == AppLocale.string("Montant masqué"))
    }

    @Test("visible amounts with a target speak saved, projection and target")
    func visibleWithTarget() {
        let summary = GoalProjectionChart.accessibilitySummary(
            series: series(target: 5678), currency: .chf, amountsHidden: false
        )

        let (saved, projected, target) = (
            Decimal(2345).asCompactCurrency(.chf),
            Decimal(3456).asCompactCurrency(.chf),
            Decimal(5678).asCompactCurrency(.chf)
        )
        #expect(summary == AppLocale.string(
            "Épargné \(saved), projection planifiée \(projected), cible \(target)"
        ))
    }

    @Test("visible amounts without a target omit the target")
    func visibleWithoutTarget() {
        let summary = GoalProjectionChart.accessibilitySummary(
            series: series(target: nil), currency: .chf, amountsHidden: false
        )

        let (saved, projected) = (Decimal(2345).asCompactCurrency(.chf), Decimal(3456).asCompactCurrency(.chf))
        #expect(summary == AppLocale.string("Épargné \(saved), projection planifiée \(projected)"))
    }
}
