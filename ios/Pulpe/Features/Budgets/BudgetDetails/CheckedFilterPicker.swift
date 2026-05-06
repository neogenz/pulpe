import SwiftUI

/// Filter options for budget items visibility
enum CheckedFilterOption: String, CaseIterable, Identifiable {
    case unchecked
    case checked
    case all

    var id: String { rawValue }

    var label: String {
        switch self {
        case .unchecked: "À pointer"
        case .checked: "Pointé"
        case .all: "Tout voir"
        }
    }

    var icon: String {
        switch self {
        case .unchecked: "square"
        case .checked: "checkmark.square"
        case .all: "list.bullet"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .unchecked: "Afficher uniquement les éléments à pointer"
        case .checked: "Afficher uniquement les éléments pointés"
        case .all: "Afficher tous les éléments"
        }
    }
}

/// A segmented picker for filtering checked/unchecked budget items
/// with accessibility support for VoiceOver announcements
struct CheckedFilterPicker: View {
    @Binding var selection: CheckedFilterOption

    var body: some View {
        Picker("Filtrer", selection: $selection) {
            ForEach(CheckedFilterOption.allCases) { option in
                Label(option.label, systemImage: option.icon)
                    .tag(option)
            }
        }
        .pickerStyle(.segmented)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Filtrer les éléments")
        .accessibilityValue(selection.accessibilityLabel)
        .onChange(of: selection) { _, newValue in
            // Announce filter change to VoiceOver users
            let announcement: String = switch newValue {
            case .unchecked: "Affichage des éléments à pointer"
            case .checked: "Affichage des éléments pointés"
            case .all: "Affichage de tous les éléments"
            }
            UIAccessibility.post(notification: .announcement, argument: announcement)
        }
    }
}

#Preview {
    @Previewable @State var selection: CheckedFilterOption = .unchecked

    VStack(spacing: 20) {
        CheckedFilterPicker(selection: $selection)
            .padding()

        Text("Selected: \(selection.label)")
    }
}
