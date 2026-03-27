import Foundation

public struct RecoveryKeyFormatter {
    public static let strippedKeyCharacterCount = 52

    /// Formats a raw string into groups of 4 characters separated by dashes.
    /// Example: "ABCDEFGH" -> "ABCD-EFGH"
    public static func format(_ input: String) -> String {
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
    public static func strip(_ input: String) -> String {
        let allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
        return input.uppercased()
            .filter { allowed.contains($0) }
    }

    /// Checks if the input (ignoring dashes and spaces) contains characters outside Base32 alphabet.
    /// Valid characters are A-Z and 2-7 (RFC 4648). Dashes and spaces are valid separators.
    public static func containsInvalidCharacters(_ input: String) -> Bool {
        let allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567- "
        let uppercased = input.uppercased()
        return uppercased.contains { !allowed.contains($0) }
    }
}
