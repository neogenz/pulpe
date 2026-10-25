@testable import Pulpe
import SwiftUI
import Testing

@Suite("TwoColumnReflowLayout")
@MainActor
struct TwoColumnReflowLayoutTests {
    private static let spacing: CGFloat = 10

    private func renderedHeight(_ content: some View) -> CGFloat? {
        let renderer = ImageRenderer(
            content: content.frame(width: 300).fixedSize(horizontal: false, vertical: true)
        )
        return renderer.uiImage?.size.height
    }

    private func block(_ height: CGFloat) -> some View {
        Color.clear.frame(height: height)
    }

    @Test("Tagged cards share a row; a full-width card starts below the taller column")
    func place_taggedThenUntagged_fullWidthStartsBelowTallerColumn() {
        let height = renderedHeight(
            TwoColumnReflowLayout(spacing: Self.spacing, minColumnWidth: 100) {
                block(100).reflowColumn(.leading)
                block(50).reflowColumn(.trailing)
                block(30)
            }
        )
        #expect(height == 100 + Self.spacing + 30)
    }

    @Test("A lone column spans the full width and stacks like a VStack")
    func place_singleTaggedColumn_spansFullWidth() {
        let height = renderedHeight(
            TwoColumnReflowLayout(spacing: Self.spacing, minColumnWidth: 100) {
                block(40)
                block(50).reflowColumn(.trailing)
            }
        )
        #expect(height == 40 + Self.spacing + 50)
    }

    @Test("Columns narrower than the minimum stack like a VStack")
    func place_columnsUnderMinimumWidth_stack() {
        let height = renderedHeight(
            TwoColumnReflowLayout(spacing: Self.spacing, minColumnWidth: 200) {
                block(100).reflowColumn(.leading)
                block(50).reflowColumn(.trailing)
            }
        )
        #expect(height == 100 + Self.spacing + 50)
    }

    @Test("An empty card takes no gap")
    func place_emptyCard_takesNoGap() {
        let height = renderedHeight(
            TwoColumnReflowLayout(spacing: Self.spacing, minColumnWidth: 100) {
                block(0)
                block(50)
            }
        )
        #expect(height == 50)
    }
}
