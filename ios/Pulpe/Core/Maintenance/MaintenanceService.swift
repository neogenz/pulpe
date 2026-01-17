import Foundation

extension Notification.Name {
    static let maintenanceModeDetected = Notification.Name("maintenanceModeDetected")
}

actor MaintenanceService {
    static let shared = MaintenanceService()

    private init() {}

    private struct StatusResponse: Decodable {
        let maintenanceMode: Bool
        let message: String?
    }

    func checkStatus() async throws -> Bool {
        let url = AppConfiguration.apiBaseURL.appendingPathComponent("maintenance/status")
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200 ... 299).contains(httpResponse.statusCode)
        else {
            throw APIError.serverError(message: "Impossible de vérifier le statut")
        }

        let status = try JSONDecoder().decode(StatusResponse.self, from: data)
        return status.maintenanceMode
    }
}
