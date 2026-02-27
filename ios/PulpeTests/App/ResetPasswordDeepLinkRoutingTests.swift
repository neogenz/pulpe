import Foundation
@testable import Pulpe
import Testing

@Suite(.serialized)
@MainActor
struct ResetPasswordDeepLinkRoutingTests {
    private let testURL = URL(string: "pulpe://reset-password?token=abc123") ?? URL(fileURLWithPath: "/")

    // MARK: - Disposition Policy Tests

    @Test func disposition_whenLoading_isDefer() {
        let disposition = ResetPasswordDeepLinkPolicy.disposition(for: .loading)
        #expect(disposition == .defer)
    }

    @Test func disposition_whenUnauthenticated_isPresent() {
        let disposition = ResetPasswordDeepLinkPolicy.disposition(for: .unauthenticated)
        #expect(disposition == .present)
    }

    @Test func disposition_whenAuthenticated_isDrop() {
        let disposition = ResetPasswordDeepLinkPolicy.disposition(for: .authenticated)
        #expect(disposition == .drop)
    }

    @Test func disposition_whenNeedsPinSetup_isDrop() {
        let disposition = ResetPasswordDeepLinkPolicy.disposition(for: .needsPinSetup)
        #expect(disposition == .drop)
    }

    @Test func disposition_whenNeedsPinEntry_isDrop() {
        let disposition = ResetPasswordDeepLinkPolicy.disposition(for: .needsPinEntry)
        #expect(disposition == .drop)
    }

    @Test func disposition_whenNeedsPinRecovery_isDrop() {
        let disposition = ResetPasswordDeepLinkPolicy.disposition(for: .needsPinRecovery)
        #expect(disposition == .drop)
    }

    // MARK: - Integration with AppState

    @Test func deepLinkDuringLoading_isNotConsumed() async {
        let sut = AppState()
        #expect(sut.authState == .loading)

        // Simulate deep link arriving during loading
        let handler = DeepLinkHandler()
        handler.setPending(.resetPassword(url: testURL))

        let result = handler.processResetPassword(authState: sut.authState)

        #expect(result == .deferred)
        #expect(handler.hasPendingResetPassword)
    }

    @Test func deepLinkWhenUnauthenticated_isConsumedAndPresented() async {
        let sut = AppState()
        sut.authState = .unauthenticated

        let handler = DeepLinkHandler()
        handler.setPending(.resetPassword(url: testURL))

        let result = handler.processResetPassword(authState: sut.authState)

        #expect(result == .present(testURL))
        #expect(!handler.hasPendingResetPassword)
    }

    @Test func deepLinkWhenAuthenticated_isConsumedAndDropped() async {
        let pinResolver = MockPostAuthResolver(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false)
        )
        let testUser = UserInfo(id: "test", email: "test@pulpe.app", firstName: "Test")
        let sut = AppState(postAuthResolver: pinResolver)

        await sut.resolvePostAuth(user: testUser)
        await sut.completePinEntry()
        #expect(sut.authState == .authenticated)

        let handler = DeepLinkHandler()
        handler.setPending(.resetPassword(url: testURL))

        let result = handler.processResetPassword(authState: sut.authState)

        #expect(result == .dropped)
        #expect(!handler.hasPendingResetPassword)
    }

    @Test func deferredDeepLink_isPresentedWhenAuthStateBecomesUnauthenticated() async {
        let sut = AppState()
        #expect(sut.authState == .loading)

        let handler = DeepLinkHandler()
        handler.setPending(.resetPassword(url: testURL))

        // First attempt during loading - deferred
        let firstResult = handler.processResetPassword(authState: sut.authState)
        #expect(firstResult == .deferred)
        #expect(handler.hasPendingResetPassword)

        // Auth state changes to unauthenticated
        sut.authState = .unauthenticated

        // Second attempt - now presented
        let secondResult = handler.processResetPassword(authState: sut.authState)
        #expect(secondResult == .present(testURL))
        #expect(!handler.hasPendingResetPassword)
    }

    @Test func deferredDeepLink_isDroppedWhenAuthStateBecomesAuthenticated() async {
        let pinResolver = MockPostAuthResolver(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false)
        )
        let testUser = UserInfo(id: "test", email: "test@pulpe.app", firstName: "Test")
        let sut = AppState(postAuthResolver: pinResolver)
        #expect(sut.authState == .loading)

        let handler = DeepLinkHandler()
        handler.setPending(.resetPassword(url: testURL))

        // First attempt during loading - deferred
        let firstResult = handler.processResetPassword(authState: sut.authState)
        #expect(firstResult == .deferred)

        // Auth state changes to authenticated (user was already logged in)
        await sut.resolvePostAuth(user: testUser)
        await sut.completePinEntry()
        #expect(sut.authState == .authenticated)

        // Second attempt - now dropped
        let secondResult = handler.processResetPassword(authState: sut.authState)
        #expect(secondResult == .dropped)
        #expect(!handler.hasPendingResetPassword)
    }
}
