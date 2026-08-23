import Charts
import SwiftUI

// MARK: - Scrub

extension HomeHeroCard {
    /// What the plot knows about one day: what the plan expected, what was really left
    /// (up to today), where the estimate passes (after today).
    struct ScrubReading {
        let day: Int
        let date: Date?
        let real: Decimal?
        let plan: Decimal
        let estimate: Decimal?
    }

    /// The reading under the finger. Plan and estimate are straight lines, so they are
    /// interpolated; the real stroke is read point by point.
    static func scrubReading(
        at rawDay: Int,
        in trajectory: BudgetFormulas.BalanceTrajectory
    ) -> ScrubReading {
        let day = min(max(rawDay, 0), trajectory.totalDays)
        let plan = interpolate(plan(for: trajectory), at: day)
        let real = trajectory.real.first { $0.day == day }?.balance
        let estimate = day > trajectory.today ? interpolate(projection(for: trajectory), at: day) : nil
        // Day 1 is pay day: the chart's day 0 has no date of its own and reads as pay day too.
        let date = trajectory.periodStart.flatMap {
            Calendar.current.date(byAdding: .day, value: max(day - 1, 0), to: $0)
        }
        return ScrubReading(day: day, date: date, real: real, plan: plan, estimate: estimate)
    }

    /// « 12 août · Réel 6’900 CHF · Prévu 7’400 CHF », or the estimate once the day is
    /// still to come. Three self-contained pieces joined by the separator the app uses.
    static func scrubBubbleText(_ reading: ScrubReading, currency: SupportedCurrency) -> String {
        var parts: [String] = []
        if let date = reading.date { parts.append(Formatters.dayMonthLabel(for: date)) }
        if let real = reading.real {
            parts.append(AppLocale.string("Réel \(real.asCompactCurrency(currency))"))
        } else if let estimate = reading.estimate {
            parts.append(AppLocale.string("Estimé \(estimate.asCompactCurrency(currency))"))
        }
        parts.append(AppLocale.string("Prévu \(reading.plan.asCompactCurrency(currency))"))
        return parts.joined(separator: " · ")
    }

    /// A short hold, then the finger drives the rule. A bare drag would take the page's
    /// vertical scroll with it; a hold first keeps the two apart.
    func scrubOverlay(proxy: ChartProxy) -> some View {
        GeometryReader { geometry in
            Rectangle()
                .fill(.clear)
                .contentShape(Rectangle())
                .gesture(
                    LongPressGesture(minimumDuration: DesignTokens.Chart.scrubHoldDuration)
                        .sequenced(before: DragGesture(minimumDistance: 0))
                        .onChanged { value in
                            // The sequence reports the hold's success once with no drag yet;
                            // reading a position there would flash the rule on pay day.
                            guard case .second(true, .some(let drag)) = value,
                                  let frame = proxy.plotFrame else { return }
                            let x = drag.location.x - geometry[frame].origin.x
                            guard let day: Int = proxy.value(atX: x) else { return }
                            scrubDay = day
                        }
                        .onEnded { _ in scrubDay = nil }
                )
                // A sequence cut short (a cancelled touch, the page scrolling) never reaches
                // `onEnded`; the rule must not stay latched and the labels hidden.
                .onChange(of: scenePhase) { _, phase in
                    if phase != .active { scrubDay = nil }
                }
                .onDisappear { scrubDay = nil }
        }
    }

    private static func interpolate(
        _ points: [BudgetFormulas.BalanceTrajectory.Point],
        at day: Int
    ) -> Decimal {
        guard let first = points.first, let last = points.last else { return 0 }
        guard last.day > first.day else { return last.balance }
        let ratio = Decimal(min(max(day, first.day), last.day) - first.day) / Decimal(last.day - first.day)
        return (first.balance + (last.balance - first.balance) * ratio).rounded(2)
    }
}
