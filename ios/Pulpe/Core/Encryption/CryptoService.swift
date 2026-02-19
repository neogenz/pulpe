import CommonCrypto
import Foundation
import OSLog

/// Cryptographic service for PIN-based key derivation using PBKDF2.
/// Thread-safe actor that provides secure key derivation for client-side encryption.
actor CryptoService {
    static let shared = CryptoService()

    static let keyLengthBytes = 32
    static let keyLengthHex = 64
    
    /// Minimum allowed PBKDF2 iterations (security floor)
    static let minIterations = 500_000
    /// Maximum allowed PBKDF2 iterations (DoS protection)
    static let maxIterations = 2_000_000

    private init() {}

    // MARK: - Key Derivation

    /// Derives a 256-bit client encryption key from a PIN using PBKDF2-HMAC-SHA256.
    /// - Parameters:
    ///   - pin: User's PIN code (4-8 digits)
    ///   - saltHex: Hexadecimal salt from server (64 characters)
    ///   - iterations: PBKDF2 iteration count (typically 600,000)
    /// - Returns: Derived key as hexadecimal string (64 characters)
    /// - Throws: CryptoServiceError if derivation fails or parameters are invalid
    func deriveClientKey(pin: String, saltHex: String, iterations: Int) throws -> String {
        // Validate iteration bounds to prevent weak keys (too few) or DoS (too many)
        guard iterations >= Self.minIterations && iterations <= Self.maxIterations else {
            Logger.encryption.error("PBKDF2 iterations out of bounds: \(iterations) (expected \(Self.minIterations)-\(Self.maxIterations))")
            throw CryptoServiceError.invalidIterations
        }
        
        guard let pinData = pin.data(using: .utf8) else {
            throw CryptoServiceError.invalidPin
        }

        guard let saltData = hexToData(saltHex) else {
            throw CryptoServiceError.invalidSalt
        }

        var derivedKey = [UInt8](repeating: 0, count: Self.keyLengthBytes)

        let status = pinData.withUnsafeBytes { pinBytes in
            saltData.withUnsafeBytes { saltBytes in
                CCKeyDerivationPBKDF(
                    CCPBKDFAlgorithm(kCCPBKDF2),
                    pinBytes.baseAddress?.assumingMemoryBound(to: Int8.self),
                    pinData.count,
                    saltBytes.baseAddress?.assumingMemoryBound(to: UInt8.self),
                    saltData.count,
                    CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                    UInt32(iterations),
                    &derivedKey,
                    Self.keyLengthBytes
                )
            }
        }

        guard status == kCCSuccess else {
            Logger.encryption.error("PBKDF2 derivation failed with status: \(status)")
            throw CryptoServiceError.derivationFailed
        }

        let hex = dataToHex(Data(derivedKey))
        derivedKey.resetBytes(in: 0..<derivedKey.count)
        return hex
    }

    // MARK: - Validation

    func isValidClientKeyHex(_ hex: String) -> Bool {
        guard hex.count == Self.keyLengthHex else { return false }
        guard hex.range(of: "^[0-9a-fA-F]{64}$", options: .regularExpression) != nil else { return false }

        // Must not be all zeros
        return hex.contains(where: { $0 != "0" })
    }

    // MARK: - Hex Helpers

    private func hexToData(_ hex: String) -> Data? {
        guard hex.count.isMultiple(of: 2) else { return nil }

        var data = Data(capacity: hex.count / 2)
        var index = hex.startIndex

        while index < hex.endIndex {
            let nextIndex = hex.index(index, offsetBy: 2)
            guard let byte = UInt8(hex[index..<nextIndex], radix: 16) else { return nil }
            data.append(byte)
            index = nextIndex
        }

        return data
    }

    private func dataToHex(_ data: Data) -> String {
        data.map { String(format: "%02x", $0) }.joined()
    }
}

// MARK: - Errors

enum CryptoServiceError: LocalizedError {
    case invalidPin
    case invalidSalt
    case invalidIterations
    case derivationFailed

    var errorDescription: String? {
        switch self {
        case .invalidPin:
            return "Le code PIN est invalide"
        case .invalidSalt:
            return "Le sel de chiffrement est invalide"
        case .invalidIterations:
            return "Les paramètres de sécurité sont invalides"
        case .derivationFailed:
            return "La dérivation de la clé a échoué"
        }
    }
}
