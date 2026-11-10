import Foundation
@testable import Pulpe
import Testing

@MainActor
struct AssetCategoriesLogicTests {
    private let assets = [
        TestDataFactory.makeAsset(id: "a1", categoryId: "c1", name: "UBS"),
        TestDataFactory.makeAsset(
            id: "a2", categoryId: "c1", name: "Raiffeisen", archivedAt: TestDataFactory.fixedDate
        ),
        TestDataFactory.makeAsset(id: "a3", categoryId: "c2", name: "Leasing")
    ]

    @Test func blockingNames_includeArchivedAssetsOfTheCategoryOnly() {
        #expect(AssetCategoriesLogic.blockingAssetNames(categoryId: "c1", in: assets) == ["UBS", "Raiffeisen"])
        #expect(AssetCategoriesLogic.blockingAssetNames(categoryId: "c3", in: assets).isEmpty)
    }

    @Test func message_withOneAndTwoNames() {
        let locale = Locale(identifier: "fr")
        #expect(AssetCategoriesLogic.notEmptyMessage(names: ["UBS"], locale: locale)
            == "Déplace d'abord UBS vers une autre catégorie.")
        #expect(AssetCategoriesLogic.notEmptyMessage(names: ["UBS", "Leasing"], locale: locale)
            == "Déplace d'abord UBS et Leasing vers une autre catégorie.")
    }
}
