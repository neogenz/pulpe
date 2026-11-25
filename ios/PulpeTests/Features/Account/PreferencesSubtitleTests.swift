@testable import Pulpe
import Testing

@Suite("Préférences subtitle on the Compte screen")
struct PreferencesSubtitleTests {
    @Test("names the default account only with the net_worth flag on")
    func preferencesSubtitle_followsNetWorthFlag() {
        #expect(
            AccountView.preferencesSubtitle(isNetWorthEnabled: true)
                == "Devise, langue, jour de paie, compte par défaut, rappels"
        )
        #expect(AccountView.preferencesSubtitle(isNetWorthEnabled: false) == "Devise, langue, jour de paie, rappels")
    }
}
