import Foundation

/// Generic API response wrapper matching backend format
struct APIResponse<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let error: String?
    let message: String?
    let code: String?
    let details: APIErrorDetails?

    enum CodingKeys: String, CodingKey {
        case success, data, error, message, code, details
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)

        success = try container.decode(Bool.self, forKey: .success)
        error = try container.decodeIfPresent(String.self, forKey: .error)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        code = try container.decodeIfPresent(String.self, forKey: .code)
        details = try container.decodeIfPresent(APIErrorDetails.self, forKey: .details)

        // Only decode data if success is true
        if success {
            data = try container.decodeIfPresent(T.self, forKey: .data)
        } else {
            data = nil
        }
    }
}

/// Error details that can be string or object
enum APIErrorDetails: Decodable {
    case string(String)
    case array([String])
    case dictionary([String: String])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()

        if let string = try? container.decode(String.self) {
            self = .string(string)
        } else if let array = try? container.decode([String].self) {
            self = .array(array)
        } else if let dict = try? container.decode([String: String].self) {
            self = .dictionary(dict)
        } else {
            self = .string("Unknown error details")
        }
    }

    var messages: [String] {
        switch self {
        case .string(let s): return [s]
        case .array(let arr): return arr
        case .dictionary(let dict): return dict.values.map { $0 }
        }
    }
}

/// Response for delete operations
struct DeleteResponse: Decodable {
    let success: Bool
    let message: String
}

/// Wrapper for responses where data is the root object (not nested in "data")
struct DirectResponse<T: Decodable>: Decodable {
    let success: Bool
    let data: T

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let response = try container.decode(T.self)
        self.success = true
        self.data = response
    }
}
