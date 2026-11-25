import Foundation

/// A page of an element's history (PUL-379), newest first. `asset` is the element as
/// `GET /v1/assets` computes it, read in the same pass as the entries. `nextCursor` is `nil` on
/// the last page.
struct AssetHistory: Decodable, Hashable, Sendable {
    let asset: Asset
    let entries: [AssetHistoryEntry]
    let nextCursor: String?
}

/// One line of the history, amounts in the element's currency: a value the user entered, or a
/// checked prévision or free movement with what it moved. A prévision present in two periods
/// repeats its `sourceId`, so a line is identified by its type, source and date.
struct AssetHistoryEntry: Decodable, Hashable, Identifiable, Sendable {
    enum Kind: Hashable, Sendable {
        case snapshot(value: Decimal)
        /// `effect` is `nil` without an exchange rate. `supersededAt` is the date of the entry
        /// that follows and takes over, `nil` while the movement still counts in the value.
        case movement(name: String, effect: Decimal?, supersededAt: Date?)
    }

    let sourceId: String
    let at: Date
    let kind: Kind

    var id: String {
        let type = if case .snapshot = kind { "snapshot" } else { "movement" }
        return "\(type)-\(sourceId)-\(at.timeIntervalSince1970)"
    }

    var isSnapshot: Bool {
        if case .snapshot = kind { true } else { false }
    }

    init(sourceId: String, at: Date, kind: Kind) {
        self.sourceId = sourceId
        self.at = at
        self.kind = kind
    }

    private enum CodingKeys: String, CodingKey {
        case type, id, at, value, name, effect, supersededAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        sourceId = try container.decode(String.self, forKey: .id)
        at = try container.decode(Date.self, forKey: .at)
        let type = try container.decode(String.self, forKey: .type)
        switch type {
        case "snapshot":
            kind = .snapshot(value: try container.decode(Decimal.self, forKey: .value))
        case "movement":
            kind = .movement(
                name: try container.decode(String.self, forKey: .name),
                effect: try container.decodeIfPresent(Decimal.self, forKey: .effect),
                supersededAt: try container.decodeIfPresent(Date.self, forKey: .supersededAt)
            )
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type, in: container, debugDescription: "Unknown history entry type \(type)"
            )
        }
    }
}
