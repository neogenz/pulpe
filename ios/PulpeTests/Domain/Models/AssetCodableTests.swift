import Foundation
@testable import Pulpe
import Testing

@Suite("Asset wire contract")
struct AssetCodableTests {
    private func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    @Test
    func netWorth_decodesEveryField_andNullsAsNil() throws {
        let json = """
        {
          "totals": {"baseCurrency": "CHF", "gross": 1500.5, "debts": 200, "net": 1300.5, "incomplete": true},
          "categories": [{"id": "c1", "name": "Comptes", "total": 1300.5}],
          "assets": [
            {
              "id": "a1", "categoryId": "c1", "name": "UBS", "currency": "CHF", "direction": "own",
              "inPulpe": true, "archivedAt": null, "latestValue": 1500.5,
              "latestRecordedAt": "2026-11-01T10:00:00Z", "convertedValue": 1500.5,
              "suggestion": {"delta": -50, "proposedValue": 1450.5}
            },
            {
              "id": "a2", "categoryId": "c1", "name": "Revolut", "currency": "EUR", "direction": "own",
              "inPulpe": false, "archivedAt": null, "latestValue": 300,
              "latestRecordedAt": "2026-11-01T10:00:00Z", "convertedValue": null, "suggestion": null
            },
            {
              "id": "a3", "categoryId": "c1", "name": "Prêt", "currency": "CHF", "direction": "owe",
              "inPulpe": false, "archivedAt": "2026-10-01T08:00:00Z", "latestValue": 200,
              "latestRecordedAt": "2026-10-01T08:00:00Z", "convertedValue": 200, "suggestion": null
            }
          ]
        }
        """

        let netWorth = try decoder().decode(NetWorth.self, from: Data(json.utf8))

        #expect(netWorth.totals.baseCurrency == .chf)
        #expect(netWorth.totals.net == Decimal(string: "1300.5"))
        #expect(netWorth.totals.incomplete)
        #expect(netWorth.categories.first?.total == Decimal(string: "1300.5"))
        let first = try #require(netWorth.assets.first)
        #expect(first.suggestion == AssetSuggestion(delta: -50, proposedValue: Decimal(string: "1450.5") ?? 0))
        #expect(first.archivedAt == nil)
        #expect(netWorth.assets[1].currency == .eur)
        #expect(netWorth.assets[1].convertedValue == nil)
        #expect(netWorth.assets[1].suggestion == nil)
        #expect(netWorth.assets[2].direction == .owe)
        #expect(netWorth.assets[2].archivedAt != nil)
    }

    @Test
    func assetUpdate_withOnlyArchived_encodesOneKey() throws {
        let data = try JSONEncoder().encode(AssetUpdate(archived: true))

        #expect(String(data: data, encoding: .utf8) == #"{"archived":true}"#)
    }
}
