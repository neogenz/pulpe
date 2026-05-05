import Foundation

extension String {
    /// Validates email format using a shared regex pattern.
    /// Used by OnboardingState, LoginViewModel, and ForgotPasswordViewModel.
    var isValidEmail: Bool {
        wholeMatch(of: Self.emailPattern) != nil
    }

    // SAFETY: Immutable regex literal; no mutation after static init. Reads are safe across isolation (Swift 6 `Regex` is not always inferred `Sendable` for static storage).
    nonisolated(unsafe) private static let emailPattern = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/
}
