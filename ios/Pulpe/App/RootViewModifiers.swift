import OSLog
import SwiftUI

struct RootViewAlerts: ViewModifier {
    @Bindable var appState: AppState
    var uiPreferences: UIPreferencesState
    @Binding var showAmountsToggleAlert: Bool

    func body(content: Content) -> some View {
        content
            .alert(
                "Petit souci de connexion",
                isPresented: $appState.showPostAuthError
            ) {
                Button("Réessayer") {
                    Task { await appState.retryOnboardingPostAuth() }
                }
                Button("Se déconnecter", role: .destructive) {
                    appState.send(.logoutRequested(source: .userInitiated))
                }
            } message: {
                Text("La configuration de ton compte n'a pas abouti — vérifie ta connexion et réessaie.")
            }
            .alert(
                "Générer une clé de récupération ?",
                isPresented: $appState.isRecoveryConsentVisible
            ) {
                Button("Générer maintenant") {
                    appState.send(.recoveryKeyConsentAccepted)
                }
                Button("Plus tard", role: .cancel) {
                    appState.send(.recoveryKeyConsentDeclined)
                }
            } message: {
                Text(
                    "Ton coffre est configuré sans clé de récupération. " +
                    "Génère-la maintenant pour éviter de perdre l'accès à tes données chiffrées."
                )
            }
            .onShake {
                guard appState.authState == .authenticated else { return }
                showAmountsToggleAlert = true
            }
            .alert(
                uiPreferences.amountsHidden ? "Afficher les montants ?" : "Masquer les montants ?",
                isPresented: $showAmountsToggleAlert
            ) {
                Button(uiPreferences.amountsHidden ? "Afficher" : "Masquer") {
                    uiPreferences.toggleAmountsVisibility()
                }
                Button("Annuler", role: .cancel) {}
            }
    }
}

struct RootViewSheets: ViewModifier {
    @Bindable var appState: AppState
    @Binding var showAddExpenseSheet: Bool
    @Binding var resetPasswordDeepLink: ResetPasswordDeepLink?
    var recoveryKeySheetItemBinding: Binding<RecoveryKeySheetItem?>

    func body(content: Content) -> some View {
        content
            .sheet(isPresented: $showAddExpenseSheet) {
                DeepLinkAddExpenseSheet()
                    .environment(appState.toastManager)
            }
            .sheet(item: $resetPasswordDeepLink) { deepLink in
                ResetPasswordFlowView(
                    callbackURL: deepLink.url,
                    onComplete: {
                        await appState.completePasswordResetFlow()
                    },
                    onCancel: {
                        await appState.cancelPasswordResetFlow()
                    }
                )
            }
            .sheet(item: recoveryKeySheetItemBinding) { sheet in
                RecoveryKeySheet(recoveryKey: sheet.recoveryKey) {
                    appState.send(.recoveryKeyPresentationDismissed)
                }
            }
    }
}

/// Splits the `RootView` modifier chain so the SwiftUI ViewBuilder type checker
/// stays under its expression-complexity budget.
///
/// `@State`-backed handlers (`onPendingDeepLink`, etc.) survive the parent value
/// copy because SwiftUI keys `State` storage by identity, not by struct address.
struct RootViewLifecycle: ViewModifier {
    let appState: AppState
    let runtimeCoordinator: AppRuntimeCoordinator
    let scenePhase: ScenePhase
    let deepLinkDestination: DeepLinkDestination?
    let onAppStart: () async -> Void
    let onClientKeyCheckFailed: () -> Void
    let onPendingDeepLink: () -> Void

    func body(content: Content) -> some View {
        content
            .environment(appState.toastManager)
            .onReceive(NotificationCenter.default.publisher(for: .maintenanceModeDetected)) { _ in
                appState.send(.maintenanceChecked(isInMaintenance: true))
            }
            .onReceive(NotificationCenter.default.publisher(for: .clientKeyCheckFailed)) { _ in
                onClientKeyCheckFailed()
            }
            .onReceive(NotificationCenter.default.publisher(for: .sessionExpired)) { _ in
                appState.send(.sessionExpired)
            }
            .task { await onAppStart() }
            .onChange(of: appState.isInMaintenance) { wasInMaintenance, isInMaintenance in
                guard wasInMaintenance, !isInMaintenance else { return }
                Task(name: "RootView.exitMaintenance") { await appState.retryStartup() }
            }
            .onChange(of: scenePhase) { oldPhase, newPhase in
                runtimeCoordinator.handleScenePhaseChange(from: oldPhase, to: newPhase)
            }
            .onChange(of: appState.currentRoute) { oldRoute, newRoute in
                logAuthTransition(label: "AUTH_ROUTE", from: oldRoute, to: newRoute)
            }
            .onChange(of: appState.authState) { oldAuth, newAuth in
                logAuthTransition(label: "AUTH_STATE_UI", from: oldAuth, to: newAuth)
                onPendingDeepLink()
            }
            .onChange(of: deepLinkDestination) { _, _ in
                onPendingDeepLink()
            }
    }

    private func logAuthTransition<T>(label: String, from old: T, to new: T) {
        #if DEBUG
        let oldDesc = String(describing: old)
        let newDesc = String(describing: new)
        Logger.auth.debug("[\(label, privacy: .public)] \(oldDesc, privacy: .public) → \(newDesc, privacy: .public)")
        #endif
    }
}

struct PrivacyShieldOverlay: View {
    var body: some View {
        Rectangle()
            .fill(.ultraThinMaterial)
            .ignoresSafeArea()
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }
}
