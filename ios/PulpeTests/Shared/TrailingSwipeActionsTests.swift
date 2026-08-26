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

    // MARK: - Velocity handed to the settle spring

    /// A finger already heading where the row is going launches the spring forwards.
    @Test func flickTowardsTheTarget_launchesForwards() {
        let launch = TrailingSwipeActions<EmptyView>
            .normalizedVelocity(releasedAt: -600, from: 0, to: -120)
        #expect(launch == 5)
    }

    /// Let go pulling the other way and the spring has to turn the row around first.
    @Test func flickAwayFromTheTarget_launchesBackwards() {
        let launch = TrailingSwipeActions<EmptyView>
            .normalizedVelocity(releasedAt: -600, from: -60, to: 0)
        #expect(launch == -10)
    }

    /// A hard flick with almost nothing left to cover normalises to a number that would
    /// cross the whole travel in a frame, so it is capped.
    @Test func hardFlickNearTheTarget_isCapped() {
        let launch = TrailingSwipeActions<EmptyView>
            .normalizedVelocity(releasedAt: -4000, from: -118, to: -120)
        #expect(launch == DesignTokens.Animation.swipeSettleMaxVelocity)
    }

    /// A row released where it already rests has no range to normalise against.
    @Test func releaseAtRest_launchesAtZero() {
        let launch = TrailingSwipeActions<EmptyView>
            .normalizedVelocity(releasedAt: -900, from: -120, to: -120)
        #expect(launch == 0)
    }
}
