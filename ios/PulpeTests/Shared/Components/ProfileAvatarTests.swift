import Foundation
@testable import Pulpe
import Testing

@Suite("ProfileAvatar")
@MainActor
struct ProfileAvatarTests {
    // MARK: - Initials derivation

    @Test func initials_multiWordFirstName_takesFirstTwoLetters() {
        #expect(ProfileAvatar.initials(firstName: "Maxime De", email: nil) == "MD")
    }

    @Test func initials_multiWordFirstName_capsAtTwoLetters() {
        #expect(ProfileAvatar.initials(firstName: "jean paul henri", email: nil) == "JP")
    }

    @Test func initials_singleWordFirstName_takesOneLetter() {
        #expect(ProfileAvatar.initials(firstName: "sofia", email: nil) == "S")
    }

    @Test func initials_firstNameWins_overEmail() {
        #expect(ProfileAvatar.initials(firstName: "Maxime", email: "sofia@pulpe.app") == "M")
    }

    @Test("Blank or absent first name falls back to the email", arguments: [nil, "", "   "])
    func initials_withoutUsableFirstName_fallsBackToEmail(firstName: String?) {
        #expect(ProfileAvatar.initials(firstName: firstName, email: "sofia@pulpe.app") == "S")
    }

    @Test func initials_noFirstNameNoEmail_returnsNil() {
        #expect(ProfileAvatar.initials(firstName: nil, email: nil) == nil)
    }

    @Test func initials_emptyEmail_returnsNil() {
        #expect(ProfileAvatar.initials(firstName: nil, email: "") == nil)
    }

    @Test func initials_privateRelayEmail_isGlyphNotAStoredFirstName() {
        #expect(
            ProfileAvatar.initials(
                firstName: nil,
                email: "xyz@privaterelay.appleid.com"
            ) == "X"
        )
    }
}
