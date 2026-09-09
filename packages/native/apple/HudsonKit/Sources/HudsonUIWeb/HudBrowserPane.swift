import SwiftUI
import WebKit

/// A browser column: a chrome rail, a loading hairline, and the page.
///
/// Styling is deliberately thin — semantic colours and materials only, no
/// palette of its own — because the hosts that embed this each have a theme
/// and a browser pane that ignores it looks pasted on. Hosts tint through the
/// usual environment (`.tint`, `.foregroundStyle`) and put their own controls
/// in `accessory`, which is where "open in the real browser" and "close the
/// pane" belong: those are decisions about the *host's* layout, not about
/// browsing.
public struct HudBrowserPane<Accessory: View>: View {
    private let browser: HudBrowser
    private let accessory: Accessory
    private let onSubmitAddress: ((String) -> Void)?

    @State private var addressDraft = ""
    @FocusState private var addressFocused: Bool

    /// `onSubmitAddress` turns the read-only host caption into an address
    /// field. What the string *means* — URL, bare host, search query — is the
    /// host's policy call, so the pane hands it over verbatim and the host
    /// routes it through whatever chokepoint it routes every other link
    /// through. Nil keeps the pane link-driven and read-only, which is the
    /// right shape for a pane that only ever shows someone else's citations.
    public init(
        _ browser: HudBrowser,
        onSubmitAddress: ((String) -> Void)? = nil,
        @ViewBuilder accessory: () -> Accessory
    ) {
        self.browser = browser
        self.onSubmitAddress = onSubmitAddress
        self.accessory = accessory()
    }

    public var body: some View {
        VStack(spacing: 0) {
            chrome
            Divider()
            ZStack(alignment: .top) {
                WebView(browser.page)
                progressHairline
            }
        }
        .background(.background)
    }

    private var chrome: some View {
        HStack(spacing: 8) {
            control("chevron.left", "Back", enabled: browser.canGoBack) { browser.goBack() }
            control("chevron.right", "Forward", enabled: browser.canGoForward) { browser.goForward() }

            if browser.isLoading {
                control("xmark", "Stop") { browser.stop() }
            } else {
                control("arrow.clockwise", "Reload", enabled: browser.url != nil) { browser.reload() }
            }

            if let onSubmitAddress {
                addressField(submit: onSubmitAddress)
            } else {
                caption
            }

            Spacer(minLength: 8)

            accessory
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(.bar)
    }

    /// The editable counterpart to `caption`: the current address, or whatever
    /// the reader is about to go find. The draft resyncs on navigation so the
    /// field always answers "where am I" when it is not being typed in, and a
    /// fresh pane with no page yet asks for focus — a blank session exists to
    /// be typed into.
    private func addressField(submit: @escaping (String) -> Void) -> some View {
        VStack(alignment: .leading, spacing: 1) {
            TextField("Search or enter address", text: $addressDraft)
                .textFieldStyle(.plain)
                .font(.system(size: 11, weight: .medium, design: .monospaced))
                .focused($addressFocused)
                .onSubmit {
                    let trimmed = addressDraft.trimmingCharacters(in: .whitespacesAndNewlines)
                    guard !trimmed.isEmpty else { return }
                    addressFocused = false
                    submit(trimmed)
                }
                .onAppear {
                    addressDraft = browser.url?.absoluteString ?? ""
                    if browser.url == nil { addressFocused = true }
                }
                .onChange(of: browser.url) { _, url in
                    guard !addressFocused else { return }
                    addressDraft = url?.absoluteString ?? ""
                }
                .accessibilityLabel("Address and search")

            if let failure = browser.failure {
                Text(failure)
                    .font(.system(size: 10))
                    .foregroundStyle(.red)
                    .lineLimit(1)
                    .truncationMode(.tail)
            } else if !browser.title.isEmpty {
                Text(browser.title)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        }
        .padding(.leading, 4)
    }

    /// Host first, title underneath. The host is the part that answers "where
    /// did this link actually take me", which is the question a pane opened
    /// from someone else's document most needs to answer.
    @ViewBuilder
    private var caption: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text(browser.displayHost ?? "—")
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.primary)

            if let failure = browser.failure {
                Text(failure)
                    .font(.system(size: 10))
                    .foregroundStyle(.red)
            } else if !browser.title.isEmpty {
                Text(browser.title)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
        }
        .lineLimit(1)
        .truncationMode(.tail)
        .padding(.leading, 4)
    }

    @ViewBuilder
    private var progressHairline: some View {
        if browser.isLoading {
            GeometryReader { geometry in
                Rectangle()
                    .fill(.tint)
                    .frame(width: geometry.size.width * browser.progress)
            }
            .frame(height: 2)
            .animation(.linear(duration: 0.15), value: browser.progress)
            .transition(.opacity)
        }
    }

    private func control(
        _ symbol: String,
        _ label: String,
        enabled: Bool = true,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 11, weight: .semibold))
                .frame(width: 20, height: 18)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
        .opacity(enabled ? 1 : 0.3)
        .help(label)
        .accessibilityLabel(label)
    }
}

extension HudBrowserPane where Accessory == EmptyView {
    public init(_ browser: HudBrowser, onSubmitAddress: ((String) -> Void)? = nil) {
        self.init(browser, onSubmitAddress: onSubmitAddress) { EmptyView() }
    }
}
