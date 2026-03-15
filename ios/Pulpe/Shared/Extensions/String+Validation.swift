import Foundation

extension String {
    /// Validates email format using a shared regex pattern.
    /// Used by OnboardingState, LoginViewModel, and ForgotPasswordViewModel.
    var isValidEmail: Bool {
        wholeMatch(of: Self.emailPattern) != nil
    }

    nonisolated(unsafe) private static let emailPattern = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/
}
