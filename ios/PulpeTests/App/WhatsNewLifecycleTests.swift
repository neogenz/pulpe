@testable import Pulpe
import Testing

@Suite("What's New lifecycle")
struct WhatsNewLifecycleTests {
    @Test @MainActor
    func initialAuthenticatedStateLoadsData() {
        #expect(
            RootViewLifecycle.shouldLoadAuthenticatedData(for: .authenticated)
        )
    }

    @Test(
        "Unauthenticated states do not load authenticated data",
        arguments: [
            AppState.AuthStatus.loading,
            .unauthenticated,
            .needsPinSetup,
            .needsPinEntry,
            .needsPinRecovery,
        ]
    )
    @MainActor
    func unauthenticatedStatesDoNotLoadData(_ authState: AppState.AuthStatus) {
        #expect(
            !RootViewLifecycle.shouldLoadAuthenticatedData(for: authState)
        )
    }

    @Test("What's New starts without waiting for authenticated data")
    @MainActor
    func whatsNewDoesNotWaitForAuthenticatedData() async throws {
        let settingsGate = AsyncGate()
        let recorder = InvocationRecorder()

        let loading = Task { @MainActor in
            await PostAuthenticationLoader.load(
                userSettings: { await settingsGate.wait() },
                currentMonth: { await recorder.record(.currentMonth) },
                whatsNew: { await recorder.record(.whatsNew) }
            )
        }

        await settingsGate.waitUntilBlocked()
        try await Task.sleep(for: .milliseconds(50))

        #expect(await recorder.contains(.whatsNew))

        await settingsGate.open()
        await loading.value
    }
}

private actor AsyncGate {
    private var isOpen = false
    private var isBlocked = false
    private var waitContinuation: CheckedContinuation<Void, Never>?

    func wait() async {
        guard !isOpen else { return }
        isBlocked = true
        await withCheckedContinuation { continuation in
            waitContinuation = continuation
        }
    }

    func waitUntilBlocked() async {
        while !isBlocked {
            await Task.yield()
        }
    }

    func open() {
        isOpen = true
        waitContinuation?.resume()
        waitContinuation = nil
    }
}

private actor InvocationRecorder {
    enum Event {
        case currentMonth
        case whatsNew
    }

    private var events: [Event] = []

    func record(_ event: Event) {
        events.append(event)
    }

    func contains(_ event: Event) -> Bool {
        events.contains(event)
    }
}
