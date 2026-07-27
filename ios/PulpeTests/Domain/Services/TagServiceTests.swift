import Foundation
@testable import Pulpe
import Testing

@Suite("TagService contract", .serialized)
struct TagServiceTests {
    private let baseURL = URL(string: "https://pulpe.test") ?? URL(fileURLWithPath: "/")

    @Test
    func getAll_callsTagsEndpoint_andDecodesCatalog() async throws {
        let recorder = TagRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.path = request.url?.path
            recorder.method = request.httpMethod
            let json = """
            {
              "success": true,
              "data": [{
                "id": "tag-1",
                "userId": "user-1",
                "name": "Assurance",
                "createdAt": "2026-07-15T18:00:00.000Z",
                "updatedAt": "2026-07-15T19:00:00.000Z"
              }]
            }
            """
            return (
                makeHTTPResponse(for: request, statusCode: 200),
                Data(json.utf8)
            )
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let service = TagService(apiClient: makeAPIClient())

        let tags = try await service.getAll()

        #expect(recorder.method == "GET")
        #expect(recorder.path == "/tags")
        let tag = try #require(tags.first)
        #expect(tag.id == "tag-1")
        #expect(tag.userId == "user-1")
        #expect(tag.name == "Assurance")
        #expect(tag.createdAt == Date(timeIntervalSince1970: 1_784_138_400))
        #expect(tag.updatedAt == Date(timeIntervalSince1970: 1_784_142_000))
    }

    @Test
    func getAll_decodesEmptyCatalog() async throws {
        InterceptingURLProtocol.requestHandler = { request in
            (
                makeHTTPResponse(for: request, statusCode: 200),
                Data(#"{"success":true,"data":[]}"#.utf8)
            )
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let service = TagService(apiClient: makeAPIClient())

        let tags = try await service.getAll()

        #expect(tags.isEmpty)
    }

    @Test
    func create_postsName_andDecodesCreatedTag() async throws {
        let recorder = TagRequestRecorder()
        InterceptingURLProtocol.requestHandler = { request in
            recorder.record(request)
            return (
                makeHTTPResponse(for: request, statusCode: 201),
                Data("""
                {
                  "success": true,
                  "data": {
                    "id": "tag-2",
                    "userId": "user-1",
                    "name": "Courses",
                    "createdAt": "2026-07-15T18:00:00.000Z",
                    "updatedAt": "2026-07-15T18:00:00.000Z"
                  }
                }
                """.utf8)
            )
        }
        defer { InterceptingURLProtocol.requestHandler = nil }

        let tag = try await TagService(apiClient: makeAPIClient())
            .create(TagCreate(name: "Courses"))

        #expect(recorder.method == "POST")
        #expect(recorder.path == "/tags")
        let body = try #require(recorder.body)
        let object = try #require(JSONSerialization.jsonObject(with: body) as? [String: String])
        #expect(object == ["name": "Courses"])
        #expect(tag.id == "tag-2")
        #expect(tag.name == "Courses")
    }

    private func makeAPIClient() -> APIClient {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [InterceptingURLProtocol.self]
        let session = URLSession(configuration: configuration)
        return APIClient(
            session: session,
            baseURL: baseURL,
            authTokenProvider: { "test-token" },
            clientKeyProvider: { nil }
        )
    }
}

private final class TagRequestRecorder: @unchecked Sendable {
    private let lock = NSLock()
    private var storedPath: String?
    private var storedMethod: String?
    private var storedBody: Data?

    func record(_ request: URLRequest) {
        let body = Self.bodyData(from: request)
        lock.withLock {
            storedPath = request.url?.path
            storedMethod = request.httpMethod
            storedBody = body
        }
    }

    var path: String? {
        get { lock.withLock { storedPath } }
        set { lock.withLock { storedPath = newValue } }
    }

    var method: String? {
        get { lock.withLock { storedMethod } }
        set { lock.withLock { storedMethod = newValue } }
    }

    var body: Data? {
        lock.withLock { storedBody }
    }

    private static func bodyData(from request: URLRequest) -> Data? {
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 1024)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let count = stream.read(buffer, maxLength: 1024)
            if count <= 0 { break }
            data.append(buffer, count: count)
        }
        return data
    }
}
