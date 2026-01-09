import SwiftUI

extension Color {
    init(hex: UInt) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    static let financialIncome = Color(hex: 0x0061A6)
    static let financialExpense = Color(hex: 0xC26C00)
    static let financialSavings = Color(hex: 0x27AE60)

    static let pulpePrimary = Color(hex: 0x006E25)

    static let pulpeGradientColors: [Color] = [
        Color(hex: 0x0088FF),
        Color(hex: 0x00DDAA),
        Color(hex: 0x00FF55),
        Color(hex: 0x88FF44)
    ]
}
