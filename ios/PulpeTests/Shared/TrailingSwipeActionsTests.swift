@testable import Pulpe
import SwiftUI
import Testing

/// Where a swiped row settles once the finger lifts.
struct TrailingSwipeActionsTests {
    private let width: CGFloat = 120

    @Test func closedRow_opensOnlyPastHalfTheButtons() {
        #expect(TrailingSwipeActions<EmptyView>.restingOffset(translation: -59, wasOpen: false, width: width) == 0)
        #expect(TrailingSwipeActions<EmptyView>.restingOffset(translation: -61, wasOpen: false, width: width) == -width)
    }

    @Test func openRow_closesOncePushedBackPastHalf() {
        #expect(TrailingSwipeActions<EmptyView>.restingOffset(translation: 59, wasOpen: true, width: width) == -width)
        #expect(TrailingSwipeActions<EmptyView>.restingOffset(translation: 61, wasOpen: true, width: width) == 0)
    }
}
