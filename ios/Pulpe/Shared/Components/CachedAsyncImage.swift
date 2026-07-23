import SwiftUI

/// In-memory cached replacement for `AsyncImage`, which re-fetches on every view identity
/// change (each tab switch, each re-render) — the exact anti-pattern the SwiftUI rule bans.
/// Memory-only by design: one avatar-sized image per URL, and the HTTP layer's own cache
/// covers cold launches. Reach for a real pipeline (Nuke/Kingfisher) only if the app ever
/// renders image *lists*.
struct CachedAsyncImage<Content: View, Placeholder: View>: View {
    let url: URL
    @ViewBuilder let content: (Image) -> Content
    @ViewBuilder let placeholder: () -> Placeholder

    @State private var loaded: UIImage?

    var body: some View {
        if let image = loaded ?? Self.cached(url) {
            content(Image(uiImage: image))
        } else {
            placeholder()
                .task(id: url) {
                    guard let (data, _) = try? await URLSession.shared.data(from: url),
                          let image = UIImage(data: data) else { return }
                    Self.cache.setObject(image, forKey: url as NSURL)
                    loaded = image
                }
        }
    }

    // NSCache is thread-safe; same pattern as the formatter caches in Shared/Formatters.
    nonisolated(unsafe) private static var cache: NSCache<NSURL, UIImage> { SharedImageCache.store }

    private static func cached(_ url: URL) -> UIImage? {
        cache.object(forKey: url as NSURL)
    }
}

/// Process-wide store shared across all `CachedAsyncImage` generic specializations —
/// a `static let` inside the generic struct would create one cache per Content/Placeholder pair.
private enum SharedImageCache {
    nonisolated(unsafe) static let store = NSCache<NSURL, UIImage>()
}
