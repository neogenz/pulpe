@testable import Pulpe
import Testing

/// PUL-337: a 503 raised during PIN validation must never read as a wrong code.
@Suite(.serialized)
struct PinMaintenanceMessageTests {
    @Test("Maintenance does not reuse the wrong-code message")
    func maintenance_differsFromWrongCodeMessage() {
        #expect(APIError.maintenance.pinValidationMessage != APIError.unauthorized.pinValidationMessage)
    }

    @Test("A failure unrelated to maintenance keeps the wrong-code message")
    func otherFailure_keepsWrongCodeMessage() {
        #expect(APIError.clientKeyInvalid.pinValidationMessage == APIError.unauthorized.pinValidationMessage)
    }
}
