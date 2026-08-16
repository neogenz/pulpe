import SwiftUI

/// Deterministic root for `LoginFlowTests`: renders the returning-user login screen
/// directly. The real startup routes through keychain and session state, so on the
/// shared test simulator these smoke tests inherited whatever a previous run left
/// behind — a stored session lands on session validation, a virgin install on the
/// onboarding welcome, and `LoginView` on neither.
struct LoginFlowUITestHarness: View {
    @State private var appState = AppState()

    var body: some View {
        LoginView()
            .environment(appState)
    }
}
