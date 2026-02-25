import OSLog

/// Coordinates the post-authentication entry pipeline:
/// biometric credential sync and automatic enrollment policy execution.
@MainActor
final class AuthenticatedEntryCoordinator {
    private let biometric: BiometricManager
    private let enrollmentPolicy: BiometricAutomaticEnrollmentPolicy
    private let toastManager: ToastManager

    init(
        biometric: BiometricManager,
        enrollmentPolicy: BiometricAutomaticEnrollmentPolicy,
        toastManager: ToastManager
    ) {
        self.biometric = biometric
        self.enrollmentPolicy = enrollmentPolicy
        self.toastManager = toastManager
    }

    /// Syncs biometric credentials to the keychain after authentication.
    func syncCredentials() async {
        let syncOK = await biometric.syncAfterAuth()
        if !syncOK {
            toastManager.show(
                "La reconnaissance biométrique n'a pas pu être activée",
                type: .error
            )
        }
    }

    /// Evaluates and executes the automatic biometric enrollment policy.
    func runEnrollmentPipeline(context: AppState.AuthCompletionContext, hasActiveModal: Bool) async {
        enrollmentPolicy.resetForNewTransition()
        let decision = enrollmentPolicy.shouldAttempt(
            biometricEnabled: biometric.isEnabled,
            biometricCapable: biometric.canEnroll(),
            isAuthenticated: true,
            sourceEligible: context.allowsAutomaticEnrollment,
            hasActiveModal: hasActiveModal,
            context: context.reason
        )
        switch decision {
        case .proceed:
            enrollmentPolicy.markInFlight(context: context.reason)
            let enabled = await biometric.enable(source: .automatic, reason: context.reason)
            enrollmentPolicy.markComplete(context: context.reason, outcome: enabled ? .success : .deniedOrFailed)
        case .skip:
            break
        }
    }
}
