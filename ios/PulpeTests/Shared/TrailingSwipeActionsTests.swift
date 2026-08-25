@testable import Pulpe
import SwiftUI
import Testing

/// Where a swiped row settles once the finger lifts.
struct TrailingSwipeActionsTests {
    private let width: CGFloat = 120

    @Test func closedRow_opensOnlyPastHalfTheButtons() {
        #expect(
            TrailingSwipeActions<EmptyView>
                .restingOffset(translation: -59, velocity: 0, wasOpen: false, width: width) == 0
        )
        #expect(
            TrailingSwipeActions<EmptyView>
                .restingOffset(translation: -61, velocity: 0, wasOpen: false, width: width) == -width
        )
    }

    @Test func openRow_closesOncePushedBackPastHalf() {
        #expect(
            TrailingSwipeActions<EmptyView>
                .restingOffset(translation: 59, velocity: 0, wasOpen: true, width: width) == -width
        )
        #expect(
            TrailingSwipeActions<EmptyView>
                .restingOffset(translation: 61, velocity: 0, wasOpen: true, width: width) == 0
        )
    }

    /// A flick that covers too little ground still opens the row, because the point compared
    /// is the one it was heading for.
    @Test func shortLeftwardFlick_opensTheRow() {
        #expect(
            TrailingSwipeActions<EmptyView>
                .restingOffset(translation: -40, velocity: -900, wasOpen: false, width: width) == -width
        )
    }

    @Test func shortRightwardFlick_closesAnOpenRow() {
        #expect(
            TrailingSwipeActions<EmptyView>
                .restingOffset(translation: 40, velocity: 900, wasOpen: true, width: width) == 0
        )
    }
}
