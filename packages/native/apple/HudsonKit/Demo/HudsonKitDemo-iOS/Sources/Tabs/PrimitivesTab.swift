import SwiftUI
import HudsonUI

/// Gallery of every public Hudson primitive shown in real context, with the
/// matching call-site snippet underneath. This tab is built strictly against
/// HudLint — every value comes from a token (HudSpacing, HudIconSize,
/// HudPalette, HudTextSize, HudRadius, HudStrokeWidth, HudOpacity, HudSurface).
struct PrimitivesTab: View {
    @State private var fieldText: String = ""
    @State private var fieldQuery: String = "alpha"
    @State private var selectedRow: String? = "alpha"
    @State private var qrInputText: String = ""
    @State private var lastScannedCode: String = ""
    @State private var tableSelection: String? = "alpha"
    @State private var vaultKey: String = ""
    @State private var vaultValue: String = ""
    @State private var vaultMessage: String = ""
    @State private var vaultKeys: [String] = []
    @State private var documentMode: HudTextDocumentMode = .preview
    @State private var document = HudTextDocumentDetector.makeDocument(
        id: "ios-demo-document",
        title: "SessionSummary.md",
        uri: "Notes/SessionSummary.md",
        mediaType: "text/markdown",
        value: """
        # Session Summary

        Hudson text documents share one model across plain text, markdown, code,
        and raw files.

        ```swift
        HudTextDocumentSurface(document: $document, mode: $mode)
        ```
        """
    )
    @State private var showSharing: Bool = false
    @State private var selectedLiquidTab: HudLiquidBarTab.ID = "home"
    @State private var lastLiquidAction: String = "—"

    private let demoVault = HudVault(service: "com.hudsonkit.demoios.vault-demo")

    private let scrollAnchors: [HudSettingsQuickNav.Item] = [
        .init(icon: "square",                label: "Buttons",  anchor: "Buttons"),
        .init(icon: "circle.fill",           label: "Status",   anchor: "Status"),
        .init(icon: "tag",                   label: "Badges",   anchor: "Badges"),
        .init(icon: "textformat",            label: "Field",    anchor: "Field"),
        .init(icon: "doc.text",              label: "Docs",     anchor: "Text documents"),
        .init(icon: "qrcode",                label: "QR",       anchor: "QR code"),
        .init(icon: "qrcode.viewfinder",     label: "Scan",     anchor: "QR scanner"),
        .init(icon: "lock.shield",           label: "Perms",    anchor: "Permissions"),
        .init(icon: "key",                   label: "Vault",    anchor: "Vault"),
        .init(icon: "square.and.arrow.up",   label: "Share",    anchor: "Share"),
        .init(icon: "list.bullet",           label: "List",     anchor: "List rows"),
        .init(icon: "tablecells.fill",       label: "Table",    anchor: "Table"),
        .init(icon: "tablecells",            label: "KV",       anchor: "KV rows"),
        .init(icon: "rectangle.stack",       label: "Cards",    anchor: "Cards & insets"),
        .init(icon: "tray",                  label: "Empty",    anchor: "Empty state"),
        .init(icon: "water.waves",           label: "Liquid",   anchor: "Liquid bar"),
        .init(icon: "minus",                 label: "Dividers", anchor: "Dividers"),
    ]

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: HudSpacing.xxxl) {
                    intro
                    sectionButtons
                    sectionStatusDots
                    sectionBadges
                    sectionField
                    sectionTextDocuments
                    sectionQRCode
                    sectionQRScanner
                    sectionPermissions
                    sectionVault
                    sectionShare
                    sectionListRows
                    sectionTable
                    sectionKVRows
                    sectionCards
                    sectionEmptyState
                    sectionLiquidBar
                    sectionDividers
                }
                .padding(.horizontal, HudSpacing.xl)
                .padding(.top, HudSpacing.lg)
                .padding(.bottom, HudSpacing.huge)
            }
            .safeAreaInset(edge: .top, spacing: 0) {
                HudSettingsQuickNav(items: scrollAnchors, proxy: proxy)
                    .padding(.vertical, HudSpacing.md)
                    .background(HudPalette.bg.opacity(HudOpacity.emphatic))
            }
        }
    }

    // MARK: Intro

    private var intro: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            HudSectionLabel("Hudson primitives")
            Text("Every public primitive composed against tokens. HudLint enforces the kit + this tab — no hardcoded colors, sizes, or font literals slip in.")
                .font(HudFont.ui(HudTextSize.sm))
                .foregroundStyle(HudPalette.muted)
        }
    }

    // MARK: Sections

    private var sectionButtons: some View {
        gallerySection("Buttons", snippet: """
            HudButton("Primary",   icon: "play.fill", style: .primary(.green)) {}
            HudButton("Secondary", icon: "gear",      style: .secondary)       {}
            HudButton("Ghost",                          style: .ghost)          {}
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudButton("Primary",   icon: "play.fill", style: .primary(.green)) {}
                HudButton("Secondary", icon: "gear",      style: .secondary)       {}
                HudButton("Ghost",                          style: .ghost)          {}
            }
        }
    }

    private var sectionStatusDots: some View {
        gallerySection("Status", snippet: """
            HudStatusDot(color: HudPalette.statusOk, pulses: true)
            HudStatusDot(color: HudPalette.statusWarn)
            HudStatusDot(color: HudPalette.statusError, size: HudDotSize.large)
            """) {
            HStack(spacing: HudSpacing.xxl) {
                HudStatusDot(color: HudPalette.statusOk, pulses: true, label: "online")
                HudStatusDot(color: HudPalette.statusWarn, label: "warning")
                HudStatusDot(color: HudPalette.statusError, size: HudDotSize.large, label: "error")
                HudStatusDot(color: HudPalette.statusInfo, size: HudDotSize.medium, label: "info")
            }
        }
    }

    private var sectionBadges: some View {
        gallerySection("Badges", snippet: """
            HudBadge("ONLINE", tint: HudPalette.statusOk,   dot: true)
            HudBadge("WARN",   tint: HudPalette.statusWarn, dot: true)
            HudBadge("ERROR",  tint: HudPalette.statusError, dot: true)
            HudBadge("BETA",   tint: HudTint.violet.color)
            """) {
            HStack(spacing: HudSpacing.sm) {
                HudBadge("ONLINE", tint: HudPalette.statusOk,    dot: true)
                HudBadge("WARN",   tint: HudPalette.statusWarn,  dot: true)
                HudBadge("ERROR",  tint: HudPalette.statusError, dot: true)
                HudBadge("BETA",   tint: HudTint.violet.color)
            }
        }
    }

    private var sectionField: some View {
        gallerySection("Field", snippet: """
            HudField("Search agents…", text: $fieldText, icon: "magnifyingglass")
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudField("Search agents…", text: $fieldText, icon: "magnifyingglass")
                HudField("Plain field",     text: $fieldQuery)
            }
        }
    }

    private var sectionTextDocuments: some View {
        gallerySection("Text documents", snippet: """
            @State var mode: HudTextDocumentMode = .preview
            @State var document = HudTextDocumentDetector.makeDocument(...)

            HudTextDocumentSurface(document: $document, mode: $mode)
            """) {
            HudTextDocumentSurface(document: $document, mode: $documentMode)
                .frame(height: HudLayout.textDocumentPreviewHeight)
        }
    }

    private var sectionQRCode: some View {
        gallerySection("QR code", snippet: """
            HudQRCode("https://hudson.dev/pair?token=...")
            HudQRCode(text, foreground: HudPalette.accent, background: HudPalette.bg)
            HudQRCode("important", errorCorrection: .high)
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HStack(spacing: HudSpacing.xl) {
                    HudQRCode("https://hudson.dev/pair?token=demo")
                    HudQRCode(
                        "https://hudson.dev/pair?token=demo",
                        foreground: HudPalette.accent,
                        background: HudPalette.bg
                    )
                }
                HudField(
                    "Encode anything…",
                    text: $qrInputText,
                    icon: "qrcode"
                )
                HudQRCode(qrInputText.isEmpty ? "https://hudson.dev" : qrInputText)
            }
        }
    }

    private var sectionQRScanner: some View {
        gallerySection("QR scanner", snippet: """
            HudPermissionGate(.camera, rationale: "Scan a pairing QR.") {
                HudQRScanner { code in
                    handle(scannedCode: code)
                }
            }
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudPermissionGate(
                    .camera,
                    rationale: "Demo of HudQRScanner — scan any QR. Simulator shows a black preview; build on a real device for the full experience."
                ) {
                    HudQRScanner { code in
                        lastScannedCode = code
                    }
                    .frame(height: HudLayout.dialogWidth)
                }
                HudInset {
                    HudKVRow("last scanned", value: lastScannedCode.isEmpty ? "—" : lastScannedCode)
                }
            }
        }
    }

    private var sectionPermissions: some View {
        gallerySection("Permissions", snippet: """
            HudPermissionGate(.microphone, rationale: "Talkie listens to your dictation.") {
                RecordingView()
            }

            // imperative
            let status = await HudPermissions.request(.camera)
            """) {
            VStack(spacing: HudSpacing.md) {
                HudPermissionGate(
                    .microphone,
                    rationale: "We listen for the demo only — this just shows the gate states."
                ) {
                    HudInset {
                        HudKVRow("microphone", value: "GRANTED — your content here")
                    }
                }
                HudPermissionGate(
                    .speech,
                    rationale: "Speech recognition turns dictation into text on-device."
                ) {
                    HudInset {
                        HudKVRow("speech", value: "GRANTED")
                    }
                }
                HudPermissionGate(
                    .camera,
                    rationale: "Used for QR-code pairing and photo capture demos."
                ) {
                    HudInset {
                        HudKVRow("camera", value: "GRANTED")
                    }
                }
                HudPermissionGate(
                    .photos,
                    rationale: "Pick screenshots to attach to a memo."
                ) {
                    HudInset {
                        HudKVRow("photos", value: "GRANTED")
                    }
                }
                HudPermissionGate(
                    .notifications,
                    rationale: "Surface session reminders and arrival notifications."
                ) {
                    HudInset {
                        HudKVRow("notifications", value: "GRANTED")
                    }
                }
            }
        }
    }

    private var sectionVault: some View {
        gallerySection("Vault", snippet: """
            let vault = HudVault(service: "com.hudsonkit.demo.api-keys")
            try vault.setString("openai", value)
            let key = try vault.getString("openai")

            HudSecretField("API key", text: $apiKey)
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudField("Key name (e.g. openai)", text: $vaultKey, icon: "tag")
                HudSecretField("Secret value", text: $vaultValue)
                HStack(spacing: HudSpacing.md) {
                    HudButton("Save", icon: "square.and.arrow.down", style: .primary(.green)) {
                        runVault {
                            try demoVault.setString(vaultKey, vaultValue)
                            vaultMessage = "saved \(vaultKey)"
                            vaultValue = ""
                        }
                    }
                    HudButton("Load", icon: "arrow.down.doc", style: .secondary) {
                        runVault {
                            if let value = try demoVault.getString(vaultKey) {
                                vaultValue = value
                                vaultMessage = "loaded \(vaultKey)"
                            } else {
                                vaultMessage = "\(vaultKey) is empty"
                            }
                        }
                    }
                    HudButton("Delete", icon: "trash", style: .ghost) {
                        runVault {
                            try demoVault.delete(vaultKey)
                            vaultMessage = "deleted \(vaultKey)"
                        }
                    }
                }
                HStack(spacing: HudSpacing.md) {
                    HudButton("Refresh keys", icon: "arrow.clockwise", style: .ghost) {
                        runVault {
                            vaultKeys = try demoVault.list()
                            vaultMessage = "\(vaultKeys.count) key\(vaultKeys.count == 1 ? "" : "s")"
                        }
                    }
                    HudButton("Clear all", icon: "xmark.circle", style: .ghost) {
                        runVault {
                            try demoVault.clear()
                            vaultKeys = []
                            vaultMessage = "vault cleared"
                        }
                    }
                }
                HudInset {
                    VStack(alignment: .leading, spacing: HudSpacing.sm) {
                        Text(vaultMessage.isEmpty ? "Save a value, then refresh to see the key listed." : vaultMessage)
                            .font(HudFont.mono(HudTextSize.xxs))
                            .foregroundStyle(HudPalette.muted)
                        if !vaultKeys.isEmpty {
                            HudDivider()
                            ForEach(vaultKeys, id: \.self) { k in
                                HudKVRow(k, value: "stored")
                            }
                        }
                    }
                }
            }
        }
    }

    private func runVault(_ block: () throws -> Void) {
        do {
            try block()
        } catch {
            vaultMessage = "error: \(error.localizedDescription)"
        }
    }

    private var sectionShare: some View {
        gallerySection("Share", snippet: """
            @State private var showSharing = false

            HudButton("Share", icon: "square.and.arrow.up", style: .secondary) {
                showSharing = true
            }
            .hudShare(isPresented: $showSharing, items: [
                .text("Hudson primitives — try them out."),
                .url(URL(string: "https://hudsonkit.com")!),
            ])
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.md) {
                HudButton(
                    "Share",
                    icon: "square.and.arrow.up",
                    style: .secondary
                ) {
                    showSharing = true
                }
                .hudShare(isPresented: $showSharing, items: [
                    .text("Hudson primitives — try them out."),
                    .url(URL(string: "https://hudsonkit.com")!),
                ])
                HudInset {
                    HudKVRow("payload", value: "1 string + 1 url")
                }
            }
        }
    }

    private var sectionListRows: some View {
        gallerySection("List rows", snippet: """
            HudListRow(
                title: "alpha.main.mini",
                subtitle: "agent · idle · 3 flights",
                icon: "circle.grid.2x2.fill",
                iconTint: .green,
                isSelected: selectedRow == "alpha"
            ) { selectedRow = "alpha" } trailing: {
                HudBadge("3", tint: HudPalette.muted)
            }
            """) {
            VStack(spacing: HudSpacing.md) {
                HudListRow(
                    title: "alpha.main.mini",
                    subtitle: "agent · idle · 3 flights",
                    icon: "circle.grid.2x2.fill",
                    iconTint: .green,
                    isSelected: selectedRow == "alpha"
                ) { selectedRow = "alpha" } trailing: {
                    HudBadge("3", tint: HudPalette.muted)
                }
                HudListRow(
                    title: "beta.main.mini",
                    subtitle: "agent · running",
                    icon: "waveform.circle.fill",
                    iconTint: .cyan,
                    isSelected: selectedRow == "beta"
                ) { selectedRow = "beta" } trailing: {
                    HudStatusDot(color: HudPalette.statusOk, pulses: true)
                }
                HudListRow(
                    title: "gamma.main.mini",
                    subtitle: "agent · offline",
                    icon: "exclamationmark.triangle.fill",
                    iconTint: .amber,
                    isSelected: selectedRow == "gamma"
                ) { selectedRow = "gamma" }
            }
        }
    }

    private var sectionTable: some View {
        gallerySection("Table", snippet: """
            HudTable(agents, columns: [
                HudTableColumn("Name") { Text($0.name) },
                HudTableColumn("Status", alignment: .center) { row in
                    HudBadge(row.status, tint: row.statusTint, dot: true)
                },
                HudTableColumn("Updated", alignment: .trailing) { Text($0.updated) },
            ], selection: $selection) { agent in
                navigate(to: agent)
            }
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.lg) {
                HudTable(
                    DemoTableRow.samples,
                    columns: [
                        HudTableColumn("Name") { row in
                            Text(row.name)
                                .font(HudFont.mono(HudTextSize.sm))
                        },
                        HudTableColumn("Status", alignment: .center) { row in
                            HudBadge(row.status, tint: row.statusTint, dot: true)
                        },
                        HudTableColumn("Updated", alignment: .trailing) { row in
                            Text(row.updated)
                                .foregroundStyle(HudPalette.muted)
                        },
                    ],
                    density: .regular,
                    selection: $tableSelection
                ) { row in
                    tableSelection = row.id
                }
                Text("Compact density")
                    .font(HudFont.ui(HudTextSize.xxs, weight: .medium))
                    .foregroundStyle(HudPalette.dim)
                HudTable(
                    DemoTableRow.samples,
                    columns: [
                        HudTableColumn("Name") { row in
                            Text(row.name)
                                .font(HudFont.mono(HudTextSize.sm))
                        },
                        HudTableColumn("Status", alignment: .center) { row in
                            HudStatusDot(color: row.statusTint, size: HudDotSize.medium)
                        },
                    ],
                    density: .compact
                )
            }
        }
    }

    private var sectionKVRows: some View {
        gallerySection("KV rows", snippet: """
            HudKVRow("cpu",     value: "32%")
            HudKVRow("uptime",  value: "4h 22m", valueColor: HudPalette.statusOk)
            """) {
            HudCard {
                VStack(spacing: HudSpacing.lg) {
                    HudKVRow("cpu",     value: "32%")
                    HudKVRow("mem",     value: "68%")
                    HudKVRow("flights", value: "12")
                    HudKVRow("uptime",  value: "4h 22m", valueColor: HudPalette.statusOk)
                }
            }
        }
    }

    private var sectionCards: some View {
        gallerySection("Cards & insets", snippet: """
            HudCard {
                Text("alpha.main.mini")
                HudInset { HudKVRow("status", value: "online") }
                HudDivider()
            }
            """) {
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.lg) {
                    Text("alpha.main.mini")
                        .font(HudFont.mono(HudTextSize.base, weight: .semibold))
                        .foregroundStyle(HudPalette.ink)
                    HudInset {
                        VStack(spacing: HudSpacing.md) {
                            HudKVRow("status", value: "online", valueColor: HudPalette.statusOk)
                            HudKVRow("agent",  value: "claude")
                            HudKVRow("branch", value: "main")
                        }
                    }
                    HudDivider()
                    HStack {
                        Text("Last activity 22:14")
                            .font(HudFont.mono(HudTextSize.xxs))
                            .foregroundStyle(HudPalette.dim)
                        Spacer()
                        HudBadge("LIVE", tint: HudPalette.statusOk, dot: true)
                    }
                }
            }
        }
    }

    private var sectionEmptyState: some View {
        gallerySection("Empty state", snippet: """
            HudEmptyState(
                title: "No agents online",
                subtitle: "Pair your first device to start.",
                icon: "antenna.radiowaves.left.and.right"
            )
            """) {
            HudEmptyState(
                title: "No agents online",
                subtitle: "Pair your first device to start a session.",
                icon: "antenna.radiowaves.left.and.right"
            )
        }
    }


    private var sectionLiquidBar: some View {
        gallerySection("Liquid bar", snippet: """
            HudLiquidBar(tabs: tabs, selection: $selection)
            HudLiquidBar(actions: actions, tint: .tinted(HudPalette.accent))
            HudLiquidBar(tint: .clear) { HStack { ... } }
            """) {
            VStack(alignment: .leading, spacing: HudSpacing.xxl) {
                liquidTabsDemo
                liquidActionsDemo
                liquidTintVariantsDemo
                liquidComplicationDemo
            }
        }
    }

    private var liquidTabsDemo: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("LIQUID BAR — TABS")
            HudInset {
                HudKVRow("selected", value: selectedLiquidTab)
            }
            HudLiquidBar(
                tabs: liquidTabs,
                selection: $selectedLiquidTab
            )
        }
    }

    private var liquidActionsDemo: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("LIQUID BAR — ACTIONS")
            HudLiquidBar(actions: liquidActions, tint: .tinted(HudPalette.accent))
            HudInset {
                HudKVRow("last action", value: lastLiquidAction)
            }
        }
    }

    private var liquidTintVariantsDemo: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("LIQUID BAR — TINT VARIANTS")
            VStack(spacing: HudSpacing.md) {
                HudLiquidBar(tint: .regular) {
                    liquidVariantLabel("Regular", icon: "circle.lefthalf.filled")
                }
                HudLiquidBar(tint: .tinted(HudPalette.accent)) {
                    liquidVariantLabel("Tinted", icon: "paintbrush.pointed.fill")
                }
                HudLiquidBar(tint: .clear) {
                    liquidVariantLabel("Clear", icon: "circle.dashed")
                }
            }
        }
    }

    private var liquidComplicationDemo: some View {
        VStack(alignment: .leading, spacing: HudSpacing.md) {
            HudSectionLabel("LIQUID BAR — HOSTING A COMPLICATION")
            HudLiquidBar(tint: .regular) {
                HStack(spacing: HudSpacing.xl) {
                    Image(systemName: "house.fill")
                    Spacer()
                    HStack(spacing: HudSpacing.sm) {
                        HudStatusDot(color: HudPalette.statusOk, pulses: true, label: "live")
                        Text("LIVE")
                            .font(HudFont.mono(HudTextSize.xxs, weight: .semibold))
                    }
                    Spacer()
                    Image(systemName: "person.crop.circle")
                }
                .foregroundStyle(HudPalette.ink)
            }
        }
    }

    private var liquidTabs: [HudLiquidBarTab] {
        [
            .init(id: "home", icon: "house.fill", title: "Home"),
            .init(id: "search", icon: "magnifyingglass", title: "Search"),
            .init(id: "profile", icon: "person.crop.circle", title: "Profile"),
        ]
    }

    private var liquidActions: [HudLiquidBarAction] {
        [
            .init(id: "compose", icon: "square.and.pencil", title: "Compose") { lastLiquidAction = "compose" },
            .init(id: "sync", icon: "arrow.triangle.2.circlepath", title: "Sync") { lastLiquidAction = "sync" },
            .init(id: "delete", icon: "trash", title: "Delete", role: .destructive) { lastLiquidAction = "delete" },
        ]
    }

    private func liquidVariantLabel(_ label: String, icon: String) -> some View {
        HStack(spacing: HudSpacing.md) {
            Image(systemName: icon)
            Text(label)
                .font(HudFont.mono(HudTextSize.sm, weight: .semibold))
        }
        .foregroundStyle(HudPalette.ink)
    }

    private var sectionDividers: some View {
        gallerySection("Dividers", snippet: """
            HudDivider()
            HudDivider(color: HudHairline.standard)
            """) {
            VStack(spacing: HudSpacing.lg) {
                HudDivider()
                HudDivider(color: HudHairline.standard)
            }
        }
    }

    // MARK: Section chrome

    @ViewBuilder
    private func gallerySection<Demo: View>(
        _ title: String,
        snippet: String,
        @ViewBuilder demo: () -> Demo
    ) -> some View {
        VStack(alignment: .leading, spacing: HudSpacing.lg) {
            HudSectionLabel(title)
            demo()
            HudInset {
                Text(snippet)
                    .font(HudFont.mono(HudTextSize.xxs))
                    .foregroundStyle(HudPalette.muted)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)
            }
        }
        .id(title)
    }
}

private struct DemoTableRow: Identifiable {
    let id: String
    let name: String
    let status: String
    let statusTint: Color
    let updated: String

    static let samples: [DemoTableRow] = [
        .init(id: "alpha", name: "alpha.main.mini", status: "ONLINE",  statusTint: HudPalette.statusOk,    updated: "2m ago"),
        .init(id: "beta",  name: "beta.main.mini",  status: "RUNNING", statusTint: HudPalette.statusInfo,  updated: "12s ago"),
        .init(id: "gamma", name: "gamma.main.mini", status: "WARN",    statusTint: HudPalette.statusWarn,  updated: "4h ago"),
        .init(id: "delta", name: "delta.main.mini", status: "OFFLINE", statusTint: HudPalette.statusError, updated: "2d ago"),
    ]
}

private struct ThemePreviewCard: View {
    let label: String
    let theme: HudTheme

    var body: some View {
        VStack(alignment: .leading, spacing: HudSpacing.sm) {
            Text(label.uppercased())
                .font(HudFont.mono(HudTextSize.micro, weight: .medium))
                .foregroundStyle(HudPalette.dim)
            HudCard {
                VStack(alignment: .leading, spacing: HudSpacing.md) {
                    ThemedKVRow(key: "status",  value: "online")
                    ThemedKVRow(key: "flights", value: "12")
                    ThemedKVRow(key: "uptime",  value: "4h 22m")
                }
            }
            .hudTheme(theme)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Theme-aware row used inside the theme preview cards. Reads palette from
/// @Environment(\.hudTheme) so the same struct renders correctly under both
/// .default and .lightDraft.
private struct ThemedKVRow: View {
    let key: String
    let value: String
    @Environment(\.hudTheme) private var theme

    var body: some View {
        HStack {
            Text(key)
                .font(HudFont.mono(HudTextSize.xxs))
                .foregroundStyle(theme.palette.dim)
            Spacer()
            Text(value)
                .font(HudFont.mono(HudTextSize.sm, weight: .medium))
                .foregroundStyle(theme.palette.ink)
        }
    }
}
