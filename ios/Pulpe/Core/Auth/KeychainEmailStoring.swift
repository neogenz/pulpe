/// Protocol for keychain operations used by AppState.
/// Enables dependency injection for testing without real keychain access.
protocol KeychainEmailStoring: Sendable {
    func getLastUsedEmail() async -> String?
    func saveLastUsedEmail(_ email: String) async
    func clearLastUsedEmail() async
    func clearAllData() async
}
