import Observation

@Observable @MainActor
final class TagsSettingsViewModel {
    private(set) var tags: [Tag] = []
    private(set) var isLoading = true
    private(set) var error: Error?

    private let service: any TagServicing

    init(service: any TagServicing = TagService.shared) {
        self.service = service
    }

    var countLabel: String {
        tags.count == 1 ? "1 TAG PERSONNEL" : "\(tags.count) TAGS PERSONNELS"
    }

    func load() async {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            tags = try await service.getAll()
        } catch is CancellationError {
            return
        } catch {
            tags = []
            self.error = error
        }
    }
}
