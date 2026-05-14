import Foundation
@testable import Pulpe
import Testing

@Suite("AppVersionResponse JSON decoding")
struct AppVersionResponseDecodingTests {
    @Test("Decodes the canonical wire shape served by the backend")
    func decodesCanonicalShape() throws {
        let json = """
        {
          "success": true,
          "data": {
            "ios": {
              "minVersion": "1.0.0",
              "latestVersion": "1.0.2",
              "storeUrl": "https://apps.apple.com/app/pulpe"
            },
            "web": {
              "minVersion": "0.0.1",
              "latestVersion": "0.34.1"
            }
          }
        }
        """
        let data = Data(json.utf8)

        let response = try JSONDecoder().decode(AppVersionResponse.self, from: data)

        #expect(response.success == true)
        #expect(response.data.ios.minVersion == "1.0.0")
        #expect(response.data.ios.latestVersion == "1.0.2")
        #expect(response.data.ios.storeUrl == "https://apps.apple.com/app/pulpe")
        #expect(response.data.web.minVersion == "0.0.1")
        #expect(response.data.web.latestVersion == "0.34.1")
        #expect(response.data.web.storeUrl == nil)
    }

    @Test("Tolerates missing optional storeUrl on iOS")
    func decodesWithoutStoreURL() throws {
        let json = """
        {
          "success": true,
          "data": {
            "ios": { "minVersion": "1.0.0", "latestVersion": "1.0.0" },
            "web": { "minVersion": "0.0.1", "latestVersion": "0.0.1" }
          }
        }
        """
        let data = Data(json.utf8)

        let response = try JSONDecoder().decode(AppVersionResponse.self, from: data)

        #expect(response.data.ios.storeUrl == nil)
    }

    @Test("Rejects payload missing required minVersion")
    func rejectsMissingRequiredField() {
        let json = """
        {
          "success": true,
          "data": {
            "ios": { "latestVersion": "1.0.0" },
            "web": { "minVersion": "0.0.1", "latestVersion": "0.0.1" }
          }
        }
        """
        let data = Data(json.utf8)

        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(AppVersionResponse.self, from: data)
        }
    }
}
