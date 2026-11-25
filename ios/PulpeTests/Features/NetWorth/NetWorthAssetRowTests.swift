import Foundation
@testable import Pulpe
import Testing

/// What a « Mon patrimoine » row does since it opens the element's detail (PUL-379).
@Suite("NetWorthAssetRow behaviour")
@MainActor
struct NetWorthAssetRowTests {
    private static let active = TestDataFactory.makeAsset(id: "cc", name: "Compte courant")
    private static let archived = TestDataFactory.makeAsset(id: "old", name: "Ancien compte", archivedAt: Date())

    @Test("CA1: tapping an active row pushes its detail on the Patrimoine stack")
    func ca1_tapOpensTheDetail() {
        let appState = AppState()
        appState.selectedTab = .netWorth

        #expect(Self.active.opensDetail)
        appState.pushOnActiveStack(NetWorthDestination.asset(id: Self.active.id))

        #expect(appState.netWorthPath.count == 1)
    }

    @Test("CA12: the menu keeps Modifier, Archiver and Supprimer")
    func ca12_menuKeepsItsEntries() {
        #expect(Self.active.rowMenuEntries(offersDefault: false) == [.edit, .archive, .delete])
        #expect(Self.active.rowMenuEntries(offersDefault: true) == [.edit, .toggleDefault, .archive, .delete])
    }

    @Test("CA15: an archived row opens nothing and its menu only unarchives or deletes")
    func ca15_archivedRowIsInert() {
        #expect(!Self.archived.opensDetail)
        #expect(Self.archived.rowMenuEntries(offersDefault: false) == [.unarchive, .delete])
    }
}
