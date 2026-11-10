import SwiftUI

/// Whether the amount typed in the hero field is a per-month figure or the TOTAL
/// to fan out over the selected months (PUL-17 dual-mode). Total is the default —
/// most users think "I want to spread 1'200 over the year", not "100/month".
enum SpreadAmountMode: CaseIterable, Hashable {
    case total
    case perMonth

    var label: String {
        switch self {
        case .total: AppLocale.string("Total")
        case .perMonth: AppLocale.string("Par mois")
        }
    }
}
