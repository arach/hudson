import SwiftUI
import HudsonUI

struct WebTab: View {
    @State private var webState = HudWebViewState()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HudSpacing.xl) {
                header
                browserCard
                notes
            }
            .padding(.horizontal, HudSpacing.xl)
            .padding(.vertical, HudSpacing.xl)
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudSectionLabel("Web")
            Text("A built-in WKWebView surface for lightweight embedded tools, docs, OAuth handoffs, and web-native experiments.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var browserCard: some View {
        HudCard {
            VStack(spacing: 0) {
                chrome
                HudDivider(color: HudHairline.subtle)
                HudWebView(
                    .html(Self.demoHTML, baseURL: nil),
                    state: $webState,
                    configuration: HudWebViewConfiguration(
                        allowsBackForwardNavigationGestures: true,
                        usesNonPersistentDataStore: true
                    )
                )
                .frame(height: WebTabMetrics.browserHeight)
                .clipShape(RoundedRectangle(cornerRadius: HudRadius.card, style: .continuous))
            }
        }
    }

    private var chrome: some View {
        HStack(spacing: HudSpacing.sm) {
            Circle()
                .fill(webState.isLoading ? HudPalette.statusInfo : HudPalette.statusOk)
                .frame(width: HudDotSize.medium, height: HudDotSize.medium)
            Text(webState.title ?? "Hudson Web Surface")
                .font(HudFont.ui(HudTextSize.xs, weight: .semibold))
                .foregroundStyle(HudPalette.ink)
                .lineLimit(1)
            Spacer()
            Text(statusText)
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(HudPalette.dim)
        }
        .frame(height: WebTabMetrics.chromeHeight)
    }

    private var statusText: String {
        if let errorMessage = webState.errorMessage {
            return errorMessage
        }
        if webState.isLoading {
            return "\(Int(webState.estimatedProgress * 100))%"
        }
        return "READY"
    }

    private var notes: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudKVRow("backend", value: "WKWebView")
            HudKVRow("data store", value: "non-persistent in this demo")
            HudKVRow("teardown", value: "stops loading and releases delegates on dismantle")
        }
    }

    private static let demoHTML = """
    <!doctype html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        :root {
          color-scheme: dark;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
          background: #070909;
          color: #edf7f4;
        }
        body {
          margin: 0;
          min-height: 100vh;
          background:
            linear-gradient(135deg, rgba(22, 163, 135, 0.16), transparent 48%),
            #070909;
        }
        main {
          display: grid;
          gap: 18px;
          padding: 22px;
        }
        .eyebrow {
          color: #17c692;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.28em;
          text-transform: uppercase;
        }
        h1 {
          margin: 0;
          font-size: 34px;
          line-height: 1;
        }
        p {
          margin: 0;
          color: rgba(237, 247, 244, 0.68);
          font-size: 16px;
          line-height: 1.45;
        }
        .grid {
          display: grid;
          gap: 10px;
          margin-top: 6px;
        }
        .row {
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.045);
          padding: 14px;
        }
        .row strong {
          display: block;
          margin-bottom: 5px;
          font-size: 13px;
        }
        .row span {
          color: rgba(237, 247, 244, 0.62);
          font-size: 13px;
          line-height: 1.35;
        }
      </style>
    </head>
    <body>
      <main>
        <div class="eyebrow">Hudson surface</div>
        <h1>Web tools can live here.</h1>
        <p>This page is rendered by a reusable native HudWebView wrapper. It can host local HTML, remote URLs, docs, auth flows, or small web-native tools without pulling terminal or voice backends into the app loop.</p>
        <section class="grid">
          <div class="row">
            <strong>Fast by default</strong>
            <span>Uses system WebKit and adds no Swift package dependency.</span>
          </div>
          <div class="row">
            <strong>Explicit lifecycle</strong>
            <span>Dismantle stops loading, detaches delegates, and clears the page.</span>
          </div>
          <div class="row">
            <strong>Shell-friendly</strong>
            <span>The app owns the surface while Hudson owns chrome, navigation, and complications.</span>
          </div>
        </section>
      </main>
    </body>
    </html>
    """
}

private enum WebTabMetrics {
    static let browserHeight = HudLayout.popoverWidth + HudSpacing.huge + HudSpacing.xxxl
    static let chromeHeight = HudLayout.buttonHeight + HudSpacing.xxs
}
