import OSLog

extension Logger {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "app.pulpe.ios"

    static let auth = Logger(subsystem: subsystem, category: "auth")
    static let network = Logger(subsystem: subsystem, category: "network")
    static let sync = Logger(subsystem: subsystem, category: "sync")
    static let ui = Logger(subsystem: subsystem, category: "ui")
    static let widget = Logger(subsystem: subsystem, category: "widget")
    static let app = Logger(subsystem: subsystem, category: "app")
}
