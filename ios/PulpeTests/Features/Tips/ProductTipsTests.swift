@testable import Pulpe
import Testing

/// `ProductTips.isSheetPresented` gates every tip's rules and has exactly one
/// writer: a modal-presentation counter (`modalDidAppear`/`modalDidDisappear`)
/// driven by `.suppressesTips()` on every modal presenter. These tests exercise
/// the counter as plain shared state — no TipKit datastore involved.
///
/// `isSheetPresented` is static shared state, so the suite is serialized and
/// each test resets it via `resetAllTips()` before running.
@Suite(.serialized)
@MainActor
struct ProductTipsTests {
    init() {
        ProductTips.resetAllTips()
    }

    @Test func balancedAppearDisappear_isSheetPresentedFalse() {
        ProductTips.modalDidAppear()
        ProductTips.modalDidDisappear()

        let isPresented = ProductTips.isSheetPresented
        #expect(isPresented == false)
    }

    @Test func overlappingModals_staysTrueUntilBothDismiss() {
        ProductTips.modalDidAppear()
        ProductTips.modalDidAppear()
        ProductTips.modalDidDisappear()

        let afterFirstDisappear = ProductTips.isSheetPresented
        #expect(afterFirstDisappear)

        ProductTips.modalDidDisappear()

        let afterSecondDisappear = ProductTips.isSheetPresented
        #expect(afterSecondDisappear == false)
    }

    @Test func disappearWithoutAppear_staysFalse_noUnderflow() {
        ProductTips.modalDidDisappear()

        let isPresented = ProductTips.isSheetPresented
        #expect(isPresented == false)
    }

    @Test func resetAllTips_clearsCountEvenAfterStrayAppear() {
        ProductTips.modalDidAppear()

        ProductTips.resetAllTips()

        let isPresentedAfterReset = ProductTips.isSheetPresented
        #expect(isPresentedAfterReset == false)

        // A disappear after reset must not underflow the cleared count.
        ProductTips.modalDidDisappear()
        let isPresentedAfterStrayDisappear = ProductTips.isSheetPresented
        #expect(isPresentedAfterStrayDisappear == false)
    }
}
