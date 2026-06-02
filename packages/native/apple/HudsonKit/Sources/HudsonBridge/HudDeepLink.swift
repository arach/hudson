import Foundation

public enum HudDeepLinkError: Error, Equatable, LocalizedError, Sendable {
    case unsupportedScheme(String?)
    case missingRoute
    case missingParameter(route: String, parameter: String)
    case invalidURLParameter(route: String, parameter: String, value: String)

    public var errorDescription: String? {
        switch self {
        case .unsupportedScheme(let scheme):
            return "Unsupported URL scheme: \(scheme ?? "none")"
        case .missingRoute:
            return "The deep link does not include a route."
        case .missingParameter(let route, let parameter):
            return "The \(route) route is missing \(parameter)."
        case .invalidURLParameter(let route, let parameter, let value):
            return "The \(route) route has an invalid \(parameter): \(value)"
        }
    }
}

public struct HudDeepLinkCallback: Equatable, Sendable {
    public var success: URL?
    public var error: URL?
    public var cancel: URL?
    public var source: String?

    public init(success: URL? = nil, error: URL? = nil, cancel: URL? = nil, source: String? = nil) {
        self.success = success
        self.error = error
        self.cancel = cancel
        self.source = source
    }

    public var isEmpty: Bool {
        success == nil && error == nil && cancel == nil && source == nil
    }
}

public enum HudCaptureRouteMode: String, Equatable, Sendable {
    case camera
    case document
    case ocr
    case photo
}

public enum HudDeepLinkRoute: Equatable, Sendable {
    case home
    case workspace(id: String?)
    case node(id: String)
    case settings(section: String?)
    case terminal(session: String?)
    case pair(payload: String?)
    case capture(mode: HudCaptureRouteMode)
    case web(url: URL)
    case keyboard(mode: String?)
    case onboarding(step: String?)
    case unknown(name: String, components: [String])

    public var title: String {
        switch self {
        case .home:
            return "Home"
        case .workspace:
            return "Workspace"
        case .node:
            return "Node"
        case .settings:
            return "Settings"
        case .terminal:
            return "Terminal"
        case .pair:
            return "Pair"
        case .capture:
            return "Capture"
        case .web:
            return "Web"
        case .keyboard:
            return "Keyboard"
        case .onboarding:
            return "Onboarding"
        case .unknown(let name, _):
            return name.isEmpty ? "Unknown" : name
        }
    }

    public var detail: String {
        switch self {
        case .home:
            return "shell"
        case .workspace(let id):
            return id ?? "default"
        case .node(let id):
            return id
        case .settings(let section):
            return section ?? "root"
        case .terminal(let session):
            return session ?? "default"
        case .pair(let payload):
            return payload == nil ? "scan" : "payload"
        case .capture(let mode):
            return mode.rawValue
        case .web(let url):
            return url.absoluteString
        case .keyboard(let mode):
            return mode ?? "default"
        case .onboarding(let step):
            return step ?? "start"
        case .unknown(_, let components):
            return components.isEmpty ? "unhandled" : components.joined(separator: "/")
        }
    }
}

public struct HudDeepLink: Equatable, Sendable {
    public static let acceptedSchemes: Set<String> = ["hudson", "hudsonkit"]

    public let url: URL
    public let route: HudDeepLinkRoute
    public let parameters: [String: String]
    public let components: [String]
    public let callback: HudDeepLinkCallback?

    public init(
        url: URL,
        route: HudDeepLinkRoute,
        parameters: [String: String] = [:],
        components: [String] = [],
        callback: HudDeepLinkCallback? = nil
    ) {
        self.url = url
        self.route = route
        self.parameters = parameters
        self.components = components
        self.callback = callback
    }

    public static func parse(
        _ url: URL,
        acceptedSchemes: Set<String> = HudDeepLink.acceptedSchemes
    ) throws -> HudDeepLink {
        guard let scheme = url.scheme?.lowercased(),
              acceptedSchemes.contains(scheme) else {
            throw HudDeepLinkError.unsupportedScheme(url.scheme)
        }

        let parameters = queryParameters(from: url)
        let callback = callback(from: parameters)
        let host = url.host?.removingPercentEncoding ?? ""
        let pathComponents = pathComponents(from: url)

        let routeName: String
        let routeComponents: [String]
        if host.lowercased() == "x-callback-url" {
            guard let first = pathComponents.first else {
                throw HudDeepLinkError.missingRoute
            }
            routeName = first
            routeComponents = Array(pathComponents.dropFirst())
        } else if !host.isEmpty {
            routeName = host
            routeComponents = pathComponents
        } else if let first = pathComponents.first {
            routeName = first
            routeComponents = Array(pathComponents.dropFirst())
        } else {
            throw HudDeepLinkError.missingRoute
        }

        let route = try route(
            named: routeName,
            components: routeComponents,
            parameters: parameters
        )

        return HudDeepLink(
            url: url,
            route: route,
            parameters: parameters,
            components: routeComponents,
            callback: callback?.isEmpty == true ? nil : callback
        )
    }

    private static func route(
        named rawName: String,
        components: [String],
        parameters: [String: String]
    ) throws -> HudDeepLinkRoute {
        let name = rawName.lowercased()

        switch name {
        case "home", "root":
            return .home

        case "open":
            if let workspaceID = firstValue(["workspace", "workspaceId"], in: parameters, components: components) {
                return .workspace(id: workspaceID)
            }
            if let nodeID = firstValue(["node", "nodeId"], in: parameters, components: components) {
                return .node(id: nodeID)
            }
            return .home

        case "workspace", "workspaces", "w":
            return .workspace(id: firstValue(["id", "workspace", "workspaceId"], in: parameters, components: components))

        case "node", "nodes", "n":
            guard let id = firstValue(["id", "node", "nodeId"], in: parameters, components: components) else {
                throw HudDeepLinkError.missingParameter(route: rawName, parameter: "id")
            }
            return .node(id: id)

        case "settings", "preferences", "prefs":
            return .settings(section: firstValue(["section", "tab"], in: parameters, components: components))

        case "terminal", "term", "ssh":
            return .terminal(session: firstValue(["session", "id"], in: parameters, components: components))

        case "pair", "pairing", "connect":
            return .pair(payload: firstValue(["payload", "token", "code"], in: parameters, components: components))

        case "capture", "scan", "ocr":
            let value = firstValue(["mode"], in: parameters, components: components) ?? (name == "ocr" ? "ocr" : nil)
            return .capture(mode: captureMode(from: value, fallback: name == "scan" ? .camera : .ocr))

        case "web", "browser", "url":
            let value = firstValue(["url", "href"], in: parameters, components: components)
            guard let value else {
                throw HudDeepLinkError.missingParameter(route: rawName, parameter: "url")
            }
            guard let url = URL(string: value) else {
                throw HudDeepLinkError.invalidURLParameter(route: rawName, parameter: "url", value: value)
            }
            return .web(url: url)

        case "keyboard", "keys", "shortcuts":
            return .keyboard(mode: firstValue(["mode", "preset"], in: parameters, components: components))

        case "onboarding", "setup":
            return .onboarding(step: firstValue(["step", "page"], in: parameters, components: components))

        default:
            return .unknown(name: rawName, components: components)
        }
    }

    private static func captureMode(from value: String?, fallback: HudCaptureRouteMode) -> HudCaptureRouteMode {
        guard let value else { return fallback }
        switch value.lowercased() {
        case "camera":
            return .camera
        case "document", "doc":
            return .document
        case "photo", "photos", "library":
            return .photo
        default:
            return .ocr
        }
    }

    private static func firstValue(
        _ names: [String],
        in parameters: [String: String],
        components: [String]
    ) -> String? {
        for name in names {
            if let value = parameters[name], !value.isEmpty {
                return value
            }
        }
        return components.first { !$0.isEmpty }
    }

    private static func pathComponents(from url: URL) -> [String] {
        url.path
            .split(separator: "/")
            .map(String.init)
            .compactMap { $0.removingPercentEncoding }
            .filter { !$0.isEmpty }
    }

    private static func queryParameters(from url: URL) -> [String: String] {
        guard let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else {
            return [:]
        }
        var parameters: [String: String] = [:]
        for item in items {
            parameters[item.name] = item.value ?? ""
        }
        return parameters
    }

    private static func callback(from parameters: [String: String]) -> HudDeepLinkCallback? {
        let success = parameters["x-success"].flatMap(URL.init(string:))
        let error = parameters["x-error"].flatMap(URL.init(string:))
        let cancel = parameters["x-cancel"].flatMap(URL.init(string:))
        let source = parameters["x-source"]
        let callback = HudDeepLinkCallback(success: success, error: error, cancel: cancel, source: source)
        return callback.isEmpty ? nil : callback
    }
}
