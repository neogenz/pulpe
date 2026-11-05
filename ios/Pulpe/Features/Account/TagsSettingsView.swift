import SwiftUI

struct TagsSettingsView: View {
    @State private var viewModel: TagsSettingsViewModel

    init(service: any TagServicing = TagService.shared) {
        _viewModel = State(initialValue: TagsSettingsViewModel(service: service))
    }

    var body: some View {
        Group {
            if viewModel.isLoading {
                LoadingView(message: AppLocale.string("Chargement de tes tags..."))
            } else if let error = viewModel.error {
                ErrorView(error: error) {
                    await viewModel.load()
                }
            } else if viewModel.tags.isEmpty {
                EmptyStateView(
                    title: AppLocale.string("Aucun tag personnel"),
                    description: AppLocale.string("Les tags créés sur le web apparaîtront ici."),
                    systemImage: "tag"
                )
            } else {
                tagsList
            }
        }
        .localizedNavigationTitle("Mes tags")
        .navigationBarTitleDisplayMode(.large)
        .task {
            await viewModel.load()
        }
    }

    private var tagsList: some View {
        List {
            Section {
                ForEach(viewModel.sortedTags) { tag in
                    Text(tag.name)
                        .font(PulpeTypography.bodyLarge)
                        .accessibilityLabel("Tag \(tag.name)")
                }
            } header: {
                Text(viewModel.countLabel)
                    .font(PulpeTypography.bannerText.weight(.semibold))
                    .textCase(nil)
            } footer: {
                Text("Tu crées et modifies tes tags sur pulpe.app.")
                    .font(PulpeTypography.bannerText)
            }
            .listRowSettingsBackground()
        }
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .listStyle(.insetGrouped)
    }
}

// MARK: - ViewModel

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
        tags.count == 1
            ? AppLocale.string("1 tag personnel")
            : AppLocale.string("\(tags.count) tags personnels")
    }

    var sortedTags: [Tag] {
        tags.sorted { $0.name.localizedStandardCompare($1.name) == .orderedAscending }
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
