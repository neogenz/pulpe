import Foundation
import Testing

/// Architecture invariants for the `Features/Budgets/BudgetDetails` feature.
///
/// These tests walk the source tree on disk and assert structural rules — the
/// same rules listed in the auto-loaded architecture rule at
/// `.claude/rules/00-architecture/budget-details-feature-architecture.md`. They
/// fail loud when future code drifts from the target shape (Stores + Projector
/// + DTO + Coordinator + Router) and run alongside the SwiftLint custom rules
/// in `ios/.swiftlint.yml`.
@Suite("BudgetDetails architecture invariants")
struct BudgetDetailsArchitectureTests {
    // MARK: - Sources roots

    /// Resolves the BudgetDetails feature directory by walking up from this
    /// test file location. Works on dev machines and CI as long as the
    /// repository layout is intact at test time.
    private static func featureDirectory() -> URL {
        // This file lives in <repo>/ios/PulpeTests/Architecture/.
        var url = URL(fileURLWithPath: #filePath)
        // Architecture/<file>.swift -> Architecture/
        url = url.deletingLastPathComponent()
        // Architecture/ -> PulpeTests/
        url = url.deletingLastPathComponent()
        // PulpeTests/ -> ios/
        url = url.deletingLastPathComponent()
        return url
            .appendingPathComponent("Pulpe")
            .appendingPathComponent("Features")
            .appendingPathComponent("Budgets")
            .appendingPathComponent("BudgetDetails")
    }

    private static func swiftFiles(under directory: URL) -> [URL] {
        guard let enumerator = FileManager.default.enumerator(
            at: directory,
            includingPropertiesForKeys: [.isRegularFileKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }
        return enumerator.compactMap { $0 as? URL }
            .filter { $0.pathExtension == "swift" }
    }

    private static func read(_ url: URL) -> String {
        (try? String(contentsOf: url, encoding: .utf8)) ?? ""
    }

    // MARK: - Sanity

    @Test("Feature directory is present")
    func featureDirectoryExists() throws {
        let dir = Self.featureDirectory()
        var isDir: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: dir.path, isDirectory: &isDir)
        try #require(exists, "BudgetDetails feature directory missing at \(dir.path)")
        #expect(isDir.boolValue)
    }

    @Test("Has at least one Swift source file")
    func hasSwiftSources() {
        let files = Self.swiftFiles(under: Self.featureDirectory())
        #expect(!files.isEmpty)
    }

    // MARK: - Phase 5 — File length invariant (≤350 LOC)

    /// Phase 5 invariant: every file in the feature stays ≤350 LOC. Splits
    /// happen via dedicated subview / helper / extension files.
    @Test("All BudgetDetails files are ≤350 LOC")
    func noFileExceedsLineLimit() {
        let limit = 350
        let files = Self.swiftFiles(under: Self.featureDirectory())
        let offenders = files.compactMap { url -> (String, Int)? in
            let body = Self.read(url)
            let lines = body.split(separator: "\n", omittingEmptySubsequences: false).count
            return lines > limit ? (url.lastPathComponent, lines) : nil
        }

        let summary = offenders.map { "\($0.0)=\($0.1)" }.joined(separator: ", ")
        #expect(offenders.isEmpty, "Files over \(limit) LOC: \(summary)")
    }

    // MARK: - Phase 4 — No file_length / type_body_length disables

    /// Activated by Phase 4. Forbids file-length and type-body-length lint
    /// disables anywhere in the feature.
    @Test("No file_length / type_body_length lint disables")
    func noSwiftLintDisableInFeature() {
        // Marker is split so the feature lint rule does not flag this test.
        let prefix = "swiftlint:" + "disable"
        let files = Self.swiftFiles(under: Self.featureDirectory())
        let offenders = files.filter { url in
            let body = Self.read(url)
            return body.contains("\(prefix) file_length") ||
                body.contains("\(prefix) type_body_length")
        }.map { $0.lastPathComponent }

        // Phase 4 shipped — assert strictly. Future regressions break the build.
        #expect(offenders.isEmpty, "Offenders: \(offenders.joined(separator: ", "))")
    }

    // MARK: - Phase 2 — No BudgetFormulas in view files

    /// Activated by Phase 2 (projector). View files must not import or invoke
    /// `BudgetFormulas` directly.
    @Test("No BudgetFormulas calls in view files")
    func noBudgetFormulasInViewFiles() {
        let viewRoots = ["Views", "BudgetDetailsView.swift", "BudgetMixedSection.swift",
                         "BudgetLineMixedRow.swift", "BudgetLineDetailPage.swift",
                         "BudgetDetailHero.swift", "AddAllocatedTransactionPage.swift",
                         "EditTransactionPage.swift"]
        let allFiles = Self.swiftFiles(under: Self.featureDirectory())
        let viewFiles = allFiles.filter { url in
            viewRoots.contains { url.path.contains("/\($0)") || url.lastPathComponent == $0 }
        }
        let offenders = viewFiles.filter { url in
            let body = Self.read(url)
            return body.contains("BudgetFormulas.calculate") ||
                body.contains("BudgetFormulas.displayBudgetLines") ||
                body.contains("BudgetFormulas.emotionState")
        }.map { $0.lastPathComponent }

        // Phase 2 shipped — assert strictly. Future regressions break the build.
        #expect(offenders.isEmpty, "Offenders: \(offenders.joined(separator: ", "))")
    }

    // MARK: - Phase 2 — No collection ops in view body

    /// Activated by Phase 2. Views must not call `.filter` / `.sorted` / `.sort`
    /// over collections — projector pre-shapes everything.
    @Test("No filter/sorted/sort in view files")
    func noCollectionOpsInViewFiles() {
        let viewFiles = Self.swiftFiles(under: Self.featureDirectory())
            .filter { url in
                let name = url.lastPathComponent
                return url.path.contains("/Views/")
                    || name.hasSuffix("View.swift")
                    || name.hasSuffix("Page.swift")
                    || name.hasSuffix("Row.swift")
                    || name.hasSuffix("Section.swift")
                    || name.hasSuffix("Hero.swift")
            }
        // Match .filter / .sorted / .sort — both paren `.filter(` and brace
        // `.filter { … }` callsites. Word boundary catches both.
        let pattern = #"\.(filter|sorted|sort)\b"#
        let regex = try? NSRegularExpression(pattern: pattern)
        let offenders = viewFiles.filter { url in
            let body = Self.read(url)
            let range = NSRange(body.startIndex..., in: body)
            return regex?.firstMatch(in: body, range: range) != nil
        }.map { $0.lastPathComponent }

        // Phase 2 shipped — assert strictly. Future regressions break the build.
        #expect(offenders.isEmpty, "Offenders: \(offenders.joined(separator: ", "))")
    }

    // MARK: - Phase 3 — No UserSettingsStore in row files

    /// Activated by Phase 3 (substore split + receive-only contracts).
    /// Row files must accept `currency: SupportedCurrency` as a `let`
    /// primitive, not read `UserSettingsStore` from environment.
    @Test("Row files do not read UserSettingsStore from environment")
    func rowsDoNotReadUserSettingsStore() {
        let rowFiles = Self.swiftFiles(under: Self.featureDirectory())
            .filter { $0.lastPathComponent.contains("Row") }
        let offenders = rowFiles.filter { url in
            Self.read(url).contains("@Environment(UserSettingsStore.self)")
        }.map { $0.lastPathComponent }

        // Phase 3 shipped — row receives `currency` as a `let` primitive.
        #expect(offenders.isEmpty, "Offenders: \(offenders.joined(separator: ", "))")
    }

    // MARK: - Phase 1 — Router is sole budgetPath writer

    /// Activated by Phase 1 (router extraction). Inside the BudgetDetails
    /// feature, only `BudgetDetailsRouter` writes to `appState.budgetPath`.
    /// Cross-feature entry points (deep link, BudgetList CTA, CurrentMonth
    /// CTA, session reset) are explicitly allowed.
    @Test("Router is sole BudgetDetails feature writer of appState.budgetPath")
    func routerIsSoleBudgetPathWriter() {
        // Walk the whole iOS source tree, not just the feature.
        let iosRoot = Self.featureDirectory()
            .deletingLastPathComponent()  // Budgets/
            .deletingLastPathComponent()  // Features/
            .deletingLastPathComponent()  // Pulpe/
        let allowed: [String] = [
            "/Routing/BudgetDetailsRouter.swift",
            "/App/AppState.swift",
            "/App/AppState+SessionReset.swift",
            "/App/PulpeApp.swift",
            // Cross-feature entry points: pushing into the budget tab from
            // outside BudgetDetails is allowed (cross-feature CTAs).
            "/Features/Budgets/BudgetList/BudgetListView.swift",
            "/Features/CurrentMonth/CurrentMonthView.swift",
        ]
        // Probe split into substrings to keep the lint rule from flagging
        // this test file as a feature-level writer of the path.
        let target = "appState" + ".budgetPath"
        let files = Self.swiftFiles(under: iosRoot)
        let offenders = files.filter { url in
            let path = url.path
            guard !allowed.contains(where: { path.hasSuffix($0) }) else { return false }
            let body = Self.read(url)
            return body.contains("\(target).append") ||
                body.contains("\(target).removeLast") ||
                body.contains("\(target) =")
        }.map { $0.lastPathComponent }

        // Phase 1 shipped — assert strictly. Future regressions break the build.
        #expect(offenders.isEmpty, "Offenders: \(offenders.joined(separator: ", "))")
    }

    // MARK: - Phase 4 — No BudgetDetailsViewModel file

    /// Activated by Phase 4 (coordinator + action enum). The monolithic
    /// view model is removed in favor of stores + projector + coordinator.
    @Test("BudgetDetailsViewModel.swift no longer exists in the feature")
    func noViewModelFile() {
        let files = Self.swiftFiles(under: Self.featureDirectory())
        let offenders = files.filter { $0.lastPathComponent == "BudgetDetailsViewModel.swift" }
            .map { $0.lastPathComponent }

        // Phase 4 shipped — VM retired in favor of stores + coordinator.
        #expect(offenders.isEmpty)
    }

    // MARK: - Phase 5 — No Task.sleep outside helpers

    /// Phase 5 invariant: inside the feature, `Task.sleep` is only allowed in
    /// the dedicated `Helpers/` modifiers (`AutoPopView`, `afterPushTransition`,
    /// `rampSyncIndicator`). Any other location must route through one of them.
    @Test("No Task.sleep outside helpers")
    func noTaskSleepOutsideHelpers() {
        let files = Self.swiftFiles(under: Self.featureDirectory())
        let helperFilenames: Set<String> = [
            "AutoPopView.swift",
            "View+afterPushTransition.swift",
            "View+syncIndicatorRamp.swift",
        ]
        let offenders = files.filter { url in
            guard !helperFilenames.contains(url.lastPathComponent) else { return false }
            return Self.read(url).contains("Task.sleep(for:")
        }.map { $0.lastPathComponent }

        #expect(offenders.isEmpty, "Offenders: \(offenders.joined(separator: ", "))")
    }

    // MARK: - Phase 5 — No magic timing literals

    /// Phase 5 invariant: magic timing literals (.milliseconds(150|200|300))
    /// must be replaced by `DesignTokens` entries. Helpers are exempt because
    /// they are the canonical site for the underlying token consumption.
    @Test("No magic timing literals (.milliseconds(150|200|300))")
    func noMagicTimingLiterals() {
        let files = Self.swiftFiles(under: Self.featureDirectory())
            .filter { !$0.path.contains("/Helpers/") }
        let pattern = #"milliseconds\(\s*(150|200|300)\s*\)"#
        let regex = try? NSRegularExpression(pattern: pattern)
        let offenders = files.filter { url in
            let body = Self.read(url)
            let range = NSRange(body.startIndex..., in: body)
            return regex?.firstMatch(in: body, range: range) != nil
        }.map { $0.lastPathComponent }

        #expect(offenders.isEmpty, "Offenders: \(offenders.joined(separator: ", "))")
    }
}
