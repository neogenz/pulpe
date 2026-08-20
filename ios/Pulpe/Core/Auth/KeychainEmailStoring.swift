import Security

enum LastUsedEmailReadResult: Sendable, Equatable {
    case available(String)
    case missing
    case temporarilyUnavailable(OSStatus)
    case failed(OSStatus)
}

/// Protocol for keychain operations used by AppState.
/// Enables dependency injection for testing without real keychain access.
protocol KeychainEmailStoring: Sendable {
    func getLastUsedEmail() async -> String?
    func readLastUsedEmail() async -> LastUsedEmailReadResult
    func saveLastUsedEmail(_ email: String) async
    func clearLastUsedEmail() async
    func clearAllData() async
}

extension KeychainEmailStoring {
    func readLastUsedEmail() async -> LastUsedEmailReadResult {
        guard let email = await getLastUsedEmail() else { return .missing }
        return .available(email)
    }
}
