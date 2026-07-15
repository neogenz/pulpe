import SwiftUI

struct TagsSettingsView: View {
    @State private var viewModel: TagsSettingsViewModel

    init(service: any TagServicing = TagService.shared) {
        _viewModel = State(initialValue: TagsSettingsViewModel(service: service))
    }

    var body: some View {
        Group {
            if viewModel.isLoading {
                LoadingView(message: "Chargement de tes tags...")
            } else if let error = viewModel.error {
                ErrorView(error: error) {
                    await viewModel.load()
                }
            } else if viewModel.tags.isEmpty {
                EmptyStateView(
                    title: "Aucun tag personnel",
                    description: "Les tags créés sur le web apparaîtront ici.",
                    systemImage: "tag"
                )
            } else {
                tagsList
            }
        }
        .navigationTitle("Mes tags")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.load()
        }
    }

    private var tagsList: some View {
        List {
            Section {
                ForEach(viewModel.tags) { tag in
                    Label {
                        Text(tag.name)
                            .font(PulpeTypography.bodyLarge)
                    } icon: {
                        Image(systemName: "tag")
                            .foregroundStyle(Color.textSecondary)
                    }
                    .accessibilityElement(children: .combine)
                    .accessibilityLabel("Tag \(tag.name)")
                }
            } header: {
                Text(viewModel.countLabel)
                    .font(PulpeTypography.labelLarge)
            }
            .listRowBackground(Color.surfaceContainerHigh)
        }
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .listStyle(.insetGrouped)
    }
}
