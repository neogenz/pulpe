import Foundation

@Observable @MainActor
final class LoginViewModel {
    var email = ""
    var password = ""
    var showPassword = false
    var isLoading = false
    var errorMessage: String?

    private let keychainManager: KeychainManager

    init(keychainManager: KeychainManager = .shared) {
        self.keychainManager = keychainManager
    }

    func loadLastUsedEmail() async {
        email = await keychainManager.getLastUsedEmail() ?? ""
    }

    var isEmailValid: Bool {
        let pattern = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/
        return email.wholeMatch(of: pattern) != nil
    }

    var isPasswordValid: Bool {
        password.count >= 8
    }

    var canSubmit: Bool {
        isEmailValid && isPasswordValid && !isLoading
    }
}
