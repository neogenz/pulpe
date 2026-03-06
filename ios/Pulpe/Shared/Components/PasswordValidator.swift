import Foundation

/// Centralized password validation logic.
/// Used by RegistrationStep, ChangePasswordViewModel, and ResetPasswordFlowViewModel.
struct PasswordValidator {
    let password: String

    var hasMinLength: Bool { password.count >= 8 }
    var hasNumber: Bool { password.contains(where: { $0.isNumber }) }
    var hasLetter: Bool { password.contains(where: { $0.isLetter }) }
    var isValid: Bool { hasMinLength && hasNumber && hasLetter }

    static func isConfirmed(password: String, confirmation: String) -> Bool {
        !confirmation.isEmpty && password == confirmation
    }
}
