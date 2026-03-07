import SwiftUI

/// Reusable password criteria list that displays validation state.
/// Replaces duplicated VStack+PasswordCriteriaRow blocks across auth flows.
struct PasswordCriteriaList: View {
    let validator: PasswordValidator

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
            PasswordCriteriaRow(met: validator.hasMinLength, text: "8 caractères minimum")
            PasswordCriteriaRow(met: validator.hasNumber, text: "Au moins un chiffre")
            PasswordCriteriaRow(met: validator.hasLetter, text: "Au moins une lettre")
        }
    }
}
