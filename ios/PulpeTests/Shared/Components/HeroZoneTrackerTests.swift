import Foundation
import Observation
@testable import Pulpe
import Testing

@MainActor
struct HeroZoneTrackerTests {
    @Test func update_newHeight_publishesThatValue() {
        let tracker = HeroZoneTracker()
        tracker.update(240)
        #expect(tracker.height == 240)
    }

    @Test func update_sameHeight_doesNotNotify() {
        let tracker = HeroZoneTracker()
        tracker.update(120)

        let probe = ObservationProbe()
        withObservationTracking {
            _ = tracker.height
        } onChange: {
            probe.didNotify = true
        }

        tracker.update(120)
        #expect(!probe.didNotify)
        #expect(tracker.height == 120)
    }

    @Test func update_negativeHeight_clampsToZero() {
        let tracker = HeroZoneTracker()
        tracker.update(-40)
        #expect(tracker.height == 0)
    }
}

/// `withObservationTracking` `onChange` is `@Sendable`; a class box is the
/// smallest way to record a notification without a Swift 6 capture error.
private final class ObservationProbe: @unchecked Sendable {
    var didNotify = false
}
