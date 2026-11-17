@testable import Pulpe
import Testing

/// The explainer opens once, and only on a settled page (empty or with figures).
struct NetWorthIntroGateTests {
    @Test func presentsWhenUnseenAndLoaded() {
        #expect(NetWorthIntroGate.shouldPresentIntro(hasSeen: false, isLoaded: true))
    }

    @Test(arguments: [
        (hasSeen: false, isLoaded: false),
        (hasSeen: true, isLoaded: true),
        (hasSeen: true, isLoaded: false)
    ])
    func staysClosedOtherwise(_ input: (hasSeen: Bool, isLoaded: Bool)) {
        #expect(!NetWorthIntroGate.shouldPresentIntro(hasSeen: input.hasSeen, isLoaded: input.isLoaded))
    }
}
