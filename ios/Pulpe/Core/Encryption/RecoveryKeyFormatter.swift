import Foundation

enum RecoveryKeyFormatter {
    /// Formats a raw string into groups of 4 characters separated by dashes.
    /// Example: "ABCDEFGH" -> "ABCD-EFGH"
    static func format(_ input: String) -> String {
        let stripped = strip(input)
        var result = ""
        
        for (index, character) in stripped.enumerated() {
            if index > 0 && index % 4 == 0 {
                result.append("-")
            }
            result.append(character)
        }
        
        return result
    }
    
    /// Removes all non-Base32 characters (RFC 4648: A-Z, 2-7) and converts to uppercase.
    static func strip(_ input: String) -> String {
        let allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        return input.uppercased()
            .filter { allowed.contains($0) }
    }
}
