@testable import Pulpe
import Testing

@Suite("LoginViewModel Tests")
@MainActor
struct LoginViewModelTests {
    @Test("Initial state is correct")
    func initialState() {
        let sut = LoginViewModel()

        #expect(sut.email.isEmpty)
        #expect(sut.password.isEmpty)
        #expect(sut.showPassword == false)
        #expect(sut.isLoading == false)
        #expect(sut.errorMessage == nil)
    }

    @Test("Valid emails are recognized", arguments: [
        "user@example.com",
        "user.name+tag@domain.co",
        "a@b.cd",
        "test.email@subdomain.example.org",
        "user123@test-domain.com",
    ])
    func isEmailValid_validEmails(email: String) {
        let sut = LoginViewModel()
        sut.email = email
        #expect(sut.isEmailValid, "Expected \(email) to be valid")
    }

    @Test("Invalid emails are rejected", arguments: [
        "",
        "user",
        "user@",
        "@domain.com",
        "user@.com",
        "user@domain",
        "user@domain.c",
        "user @example.com",
        "user@example .com",
    ])
    func isEmailValid_invalidEmails(email: String) {
        let sut = LoginViewModel()
        sut.email = email
        #expect(!sut.isEmailValid, "Expected '\(email)' to be invalid")
    }

    @Test("Valid passwords are recognized", arguments: [
        "12345678",
        "longerpassword",
        "password123!@#",
    ])
    func isPasswordValid_validPasswords(password: String) {
        let sut = LoginViewModel()
        sut.password = password
        #expect(sut.isPasswordValid, "Expected '\(password)' to be valid")
    }

    @Test("Invalid passwords are rejected", arguments: [
        "",
        "1234567",
        "short",
    ])
    func isPasswordValid_invalidPasswords(password: String) {
        let sut = LoginViewModel()
        sut.password = password
        #expect(!sut.isPasswordValid, "Expected '\(password)' to be invalid")
    }

    @Test("canSubmit is true with valid email and password")
    func canSubmit_validEmailAndPassword_true() {
        let sut = LoginViewModel()

        sut.email = "user@example.com"
        sut.password = "validpassword123"

        #expect(sut.canSubmit)
    }

    @Test("canSubmit is false with invalid email")
    func canSubmit_invalidEmail_false() {
        let sut = LoginViewModel()

        sut.email = "notanemail"
        sut.password = "validpassword123"

        #expect(!sut.canSubmit)
    }

    @Test("canSubmit is false with invalid password")
    func canSubmit_invalidPassword_false() {
        let sut = LoginViewModel()

        sut.email = "user@example.com"
        sut.password = "short"

        #expect(!sut.canSubmit)
    }

    @Test("canSubmit is false when isLoading is true")
    func canSubmit_isLoadingTrue_false() {
        let sut = LoginViewModel()

        sut.email = "user@example.com"
        sut.password = "validpassword123"
        sut.isLoading = true

        #expect(!sut.canSubmit)
    }

    @Test("canSubmit is false when all inputs are invalid")
    func canSubmit_allInvalid_false() {
        let sut = LoginViewModel()

        sut.email = ""
        sut.password = ""

        #expect(!sut.canSubmit)
    }
}
