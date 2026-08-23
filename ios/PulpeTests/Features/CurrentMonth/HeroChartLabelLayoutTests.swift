import Charts
import CoreGraphics
@testable import Pulpe
import Testing

/// Where the home plot's pills land around today's dot: never on it, never on each other,
/// never past the hero's text inset.
struct HeroChartLabelLayoutTests {
    typealias Label = HeroChartLabelLayout.Label

    private let plot = CGRect(x: 0, y: 0, width: 390, height: 150)
    private let dot = CGRect(x: 344, y: 89, width: 12, height: 12)
    private let sizes: [Label: CGSize] = [
        .today: CGSize(width: 70, height: 20),
        .trend: CGSize(width: 130, height: 20),
        .plan: CGSize(width: 42, height: 20),
    ]
    private let spacing: CGFloat = 4
    private let inset: CGFloat = 24

    private func resolve(
        anchors: [Label: CGPoint],
        preferredSide: [Label: AnnotationPosition]
    ) -> [Label: CGRect] {
        HeroChartLabelLayout(plot: plot, dot: dot, spacing: spacing, inset: inset)
            .resolve(anchors: anchors, sizes: sizes, preferredSide: preferredSide)
    }

    private func assertClean(_ rects: [Label: CGRect], count: Int) {
        #expect(rects.count == count)
        let bounds = plot.insetBy(dx: inset, dy: 0)
        for (label, rect) in rects {
            #expect(!rect.intersects(dot), "\(label) covers the dot")
            #expect(bounds.contains(rect), "\(label) leaves the inset plot")
            for (other, otherRect) in rects where other != label {
                #expect(!rect.intersects(otherRect), "\(label) overlaps \(other)")
            }
        }
    }

    // The 2026-08-23 screenshot: day 27 of 31, plan's end one pill above the dot, trend
    // far below. « Prévu » preferred the bottom, which is exactly the dot.
    @Test func lateMonth_planPillClearsTheDot() {
        let rects = resolve(
            anchors: [.today: CGPoint(x: 350, y: 95), .plan: CGPoint(x: 390, y: 71), .trend: CGPoint(x: 390, y: 130)],
            preferredSide: [.today: .top, .plan: .bottom, .trend: .bottom]
        )
        assertClean(rects, count: 3)
    }

    @Test func heldMonth_twoPillsStayApart() {
        let rects = resolve(
            anchors: [.today: CGPoint(x: 350, y: 95), .plan: CGPoint(x: 390, y: 92)],
            preferredSide: [.today: .bottom, .plan: .bottom]
        )
        assertClean(rects, count: 2)
    }

    @Test func freeSide_keepsThePreferredSideAtSpacing() throws {
        let anchor = CGPoint(x: 200, y: 40)
        let rects = resolve(anchors: [.plan: anchor], preferredSide: [.plan: .bottom])
        let rect = try #require(rects[.plan])
        #expect(rect.minY == anchor.y + spacing)
        #expect(rect.maxX == anchor.x)

        let above = try #require(resolve(anchors: [.plan: anchor], preferredSide: [.plan: .top])[.plan])
        #expect(above.maxY == anchor.y - spacing)
    }
}
