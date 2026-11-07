import SwiftUI

struct TemplatesTab: View {
    @Environment(AppState.self) private var appState
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var selectedTemplateId: String?

    var body: some View {
        @Bindable var state = appState

        Group {
            // The open iPhone Duo keeps the models beside the lines of the one opened.
            if horizontalSizeClass == .regular {
                ListBesideDetail {
                    TemplateListView(selectedTemplateId: $selectedTemplateId)
                        .ignoresForeignKeyboardInset()
                } detail: {
                    NavigationStack(path: $state.templatePath) {
                        if let selectedTemplateId {
                            TemplateDetailsView(templateId: selectedTemplateId)
                                .id(selectedTemplateId)
                                .accessibilityIdentifier("templateDetailsRoot")
                                .ignoresForeignKeyboardInset()
                        } else {
                            ContentUnavailableView("Choisis un modèle", systemImage: "doc.on.doc")
                                .pulpeBackground()
                                .ignoresForeignKeyboardInset()
                        }
                    }
                }
            } else {
                NavigationStack(path: $state.templatePath) {
                    TemplateListView()
                        .pulpeRootBottomInset()
                        .pulpeStatusBarBlur()
                        .ignoresForeignKeyboardInset()
                        .navigationDestination(for: TemplateDestination.self) { destination in
                            switch destination {
                            case .details(let templateId):
                                TemplateDetailsView(templateId: templateId)
                                    .accessibilityIdentifier("templateDetailsRoot")
                                    .ignoresForeignKeyboardInset()
                                    // Unfolding the Duo keeps this model beside the list.
                                    .onAppear { selectedTemplateId = templateId }
                            }
                        }
                }
            }
        }
        // A model pushed on the list would stack a copy on the one shown beside it; folding
        // keeps the model that was open beside the list, now pushed on it.
        .onChange(of: horizontalSizeClass) { oldClass, newClass in
            appState.templatePath = NavigationPath()
            if oldClass == .regular, newClass == .compact, let selectedTemplateId {
                appState.templatePath.append(TemplateDestination.details(templateId: selectedTemplateId))
            }
        }
    }
}
