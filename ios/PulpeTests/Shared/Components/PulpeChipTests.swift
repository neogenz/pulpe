import Foundation
@testable import Pulpe
import SwiftUI
import Testing

@Suite("PulpeChip")
@MainActor
struct PulpeChipTests {
    // MARK: - Init smoke tests

    @Test func defaultInit_buildsWithoutCrash() {
        _ = PulpeChip(label: "Tout")
    }

    @Test func init_withAllOptionalsProvided_compilesAndStoresValues() {
        let chip = PulpeChip(
            icon: "checkmark.square",
            label: "Pointé",
            count: 3,
            style: .outlined,
            size: .standard,
            isDisabled: false,
            trailing: { Image(systemName: "chevron.down") }
        )

        #expect(chip.icon == "checkmark.square")
        #expect(chip.label == "Pointé")
        #expect(chip.count == 3)
        #expect(chip.style == .outlined)
        #expect(chip.size == .standard)
        #expect(chip.isDisabled == false)
    }

    @Test func init_disabledFlag_isStored() {
        let chip = PulpeChip(label: "Épargne", isDisabled: true)

        #expect(chip.isDisabled == true)
    }

    @Test func init_emptyTrailing_defaultsToEmptyView() {
        // Default trailing closure produces EmptyView — exercising the default arg.
        let chip = PulpeChip(label: "Revenus", count: 4)

        #expect(chip.label == "Revenus")
        #expect(chip.count == 4)
    }

    // MARK: - Style equality

    @Test("Style values are distinct", arguments: [
        (PulpeChip<EmptyView>.Style.solid, PulpeChip<EmptyView>.Style.outlined),
        (PulpeChip<EmptyView>.Style.solid, PulpeChip<EmptyView>.Style.muted),
        (PulpeChip<EmptyView>.Style.outlined, PulpeChip<EmptyView>.Style.muted)
    ])
    func style_distinctValues_areNotEqual(
        pair: (PulpeChip<EmptyView>.Style, PulpeChip<EmptyView>.Style)
    ) {
        #expect(pair.0 != pair.1)
    }

    @Test func style_equalValues_areEqual() {
        #expect(PulpeChip<EmptyView>.Style.solid == .solid)
        #expect(PulpeChip<EmptyView>.Style.outlined == .outlined)
        #expect(PulpeChip<EmptyView>.Style.muted == .muted)
    }

    // MARK: - Size equality

    @Test func size_distinctValues_areNotEqual() {
        #expect(PulpeChip<EmptyView>.Size.standard != PulpeChip<EmptyView>.Size.prominent)
    }

    @Test func size_equalValues_areEqual() {
        #expect(PulpeChip<EmptyView>.Size.standard == .standard)
        #expect(PulpeChip<EmptyView>.Size.prominent == .prominent)
    }

    // MARK: - Body construction

    @Test func body_constructsForAllStyleSizeCombinations() {
        let combos: [(PulpeChip<EmptyView>.Style, PulpeChip<EmptyView>.Size)] = [
            (.solid, .standard),
            (.solid, .prominent),
            (.outlined, .standard),
            (.outlined, .prominent),
            (.muted, .standard),
            (.muted, .prominent)
        ]

        for (style, size) in combos {
            let chip = PulpeChip(
                label: "Test",
                style: style,
                size: size
            )
            // Body access type-checks → the SwiftUI graph compiles for every variant.
            _ = chip.body
        }
    }

    @Test func body_withTrailingContent_compiles() {
        let chip = PulpeChip(
            icon: "list.bullet",
            label: "Tout voir",
            count: 12,
            style: .outlined,
            trailing: {
                Image(systemName: "chevron.down")
                    .font(PulpeTypography.metricMini)
            }
        )

        _ = chip.body
    }
}
