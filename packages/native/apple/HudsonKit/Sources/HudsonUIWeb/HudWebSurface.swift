import Foundation
import SwiftUI

/// Where a native Hudson app should load a web-backed surface from.
public enum HudWebSurfaceLoadingPolicy: String, Equatable, Sendable {
    /// Static HTML/JS/CSS shipped inside the app bundle.
    case bundled
    /// A trusted local or paired host, usually a Mac during dogfooding.
    case paired
    /// A deployed Hudson route.
    case hosted
}

/// How aggressively the host can release the web surface.
public enum HudWebSurfaceLifecycle: String, Equatable, Sendable {
    /// Tear down when the native view disappears.
    case ephemeral
    /// The host may keep the surface warm for a likely quick reopen.
    case keepWarm
}

/// Stable locator for a web-backed native surface.
public enum HudWebSurfaceLocation: Equatable, Sendable {
    /// Load `indexFile` from a resource directory in the app bundle.
    case bundled(directory: String, indexFile: String = "index.html")
    /// Load from a paired or local server, such as a Mac running Hudson dev.
    case paired(URL)
    /// Load from a deployed Hudson web route.
    case hosted(URL)

    public var loadingPolicy: HudWebSurfaceLoadingPolicy {
        switch self {
        case .bundled:
            return .bundled
        case .paired:
            return .paired
        case .hosted:
            return .hosted
        }
    }

    public var url: URL? {
        switch self {
        case .bundled:
            return nil
        case .paired(let url), .hosted(let url):
            return url
        }
    }

    public func bundledIndexURL(in bundle: Bundle = .main) -> URL? {
        guard case .bundled(let directory, let indexFile) = self else { return nil }
        let normalizedDirectory = directory.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        let fileURL = URL(fileURLWithPath: indexFile)
        let resourceName = fileURL.deletingPathExtension().lastPathComponent
        let resourceExtension = fileURL.pathExtension.isEmpty ? nil : fileURL.pathExtension
        return bundle.url(
            forResource: resourceName,
            withExtension: resourceExtension,
            subdirectory: normalizedDirectory.isEmpty ? nil : normalizedDirectory
        )
    }

    public func webViewSource(in bundle: Bundle = .main) -> HudWebViewSource? {
        switch self {
        case .bundled:
            guard let url = bundledIndexURL(in: bundle) else { return nil }
            return .url(url)
        case .paired(let url), .hosted(let url):
            return .url(url)
        }
    }
}

/// Native-facing identity for a web surface. The `id` should stay stable even
/// when the loading policy moves from paired dev server to bundled resources.
public struct HudWebSurfaceDescriptor: Equatable, Sendable {
    public var id: String
    public var title: String?
    public var location: HudWebSurfaceLocation
    public var lifecycle: HudWebSurfaceLifecycle

    public init(
        id: String,
        title: String? = nil,
        location: HudWebSurfaceLocation,
        lifecycle: HudWebSurfaceLifecycle = .ephemeral
    ) {
        self.id = id
        self.title = title
        self.location = location
        self.lifecycle = lifecycle
    }

    public var loadingPolicy: HudWebSurfaceLoadingPolicy {
        location.loadingPolicy
    }

    public func webViewSource(in bundle: Bundle = .main) -> HudWebViewSource? {
        location.webViewSource(in: bundle)
    }
}

public struct HudWebSurface<Placeholder: View>: View {
    private let descriptor: HudWebSurfaceDescriptor
    private let bundle: Bundle
    @Binding private var state: HudWebViewState
    private let configuration: HudWebViewConfiguration
    private let placeholder: (HudWebSurfaceDescriptor) -> Placeholder

    public init(
        _ descriptor: HudWebSurfaceDescriptor,
        bundle: Bundle = .main,
        state: Binding<HudWebViewState> = .constant(HudWebViewState()),
        configuration: HudWebViewConfiguration = HudWebViewConfiguration(),
        @ViewBuilder placeholder: @escaping (HudWebSurfaceDescriptor) -> Placeholder
    ) {
        self.descriptor = descriptor
        self.bundle = bundle
        self._state = state
        self.configuration = configuration
        self.placeholder = placeholder
    }

    public var body: some View {
        Group {
            if let source = descriptor.webViewSource(in: bundle) {
                HudWebView(source, state: $state, configuration: configuration)
            } else {
                placeholder(descriptor)
            }
        }
    }
}

public extension HudWebSurface where Placeholder == HudWebSurfaceUnavailableView {
    init(
        _ descriptor: HudWebSurfaceDescriptor,
        bundle: Bundle = .main,
        state: Binding<HudWebViewState> = .constant(HudWebViewState()),
        configuration: HudWebViewConfiguration = HudWebViewConfiguration()
    ) {
        self.init(
            descriptor,
            bundle: bundle,
            state: state,
            configuration: configuration
        ) { descriptor in
            HudWebSurfaceUnavailableView(descriptor: descriptor)
        }
    }
}

public struct HudWebSurfaceUnavailableView: View {
    private let descriptor: HudWebSurfaceDescriptor

    public init(descriptor: HudWebSurfaceDescriptor) {
        self.descriptor = descriptor
    }

    public var body: some View {
        VStack(spacing: 8) {
            Text(descriptor.title ?? descriptor.id)
                .font(.headline)
                .foregroundStyle(.primary)
            Text("Bundled web surface unavailable")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}
