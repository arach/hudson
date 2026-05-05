import SwiftUI

// Deprecated `Hudson*` aliases retained for source compatibility. New code
// should use the `Hud*` canonical names directly.

@available(*, deprecated, renamed: "HudAppShell")
public typealias HudsonAppShell<
    Leading: View,
    Trailing: View,
    TopDrawer: View,
    BottomDrawer: View,
    Content: View,
    StatusBar: View
> = HudAppShell<Leading, Trailing, TopDrawer, BottomDrawer, Content, StatusBar>

@available(*, deprecated, renamed: "HudCanvas")
public typealias HudsonCanvas<Header: View, Content: View> = HudCanvas<Header, Content>

@available(*, deprecated, renamed: "HudCommand")
public typealias HudsonCommand = HudCommand

@available(*, deprecated, renamed: "HudCommandPalette")
public typealias HudsonCommandPalette = HudCommandPalette

@available(*, deprecated, renamed: "HudInspector")
public typealias HudsonInspector<Header: View, Content: View> = HudInspector<Header, Content>

@available(*, deprecated, renamed: "HudInspectorToggle")
public typealias HudsonInspectorToggle = HudInspectorToggle

@available(*, deprecated, renamed: "HudNavigationRail")
public typealias HudsonNavigationRail<Footer: View> = HudNavigationRail<Footer>

@available(*, deprecated, renamed: "HudRailItem")
public typealias HudsonNavRailItem = HudRailItem

@available(*, deprecated, renamed: "HudRailItem")
public typealias HudsonRailItem = HudRailItem

@available(*, deprecated, renamed: "HudNavigationSidebar")
public typealias HudsonNavigationSidebar<
    Selection: Hashable,
    RailHeader: View,
    LabelHeader: View,
    Footer: View
> = HudNavigationSidebar<Selection, RailHeader, LabelHeader, Footer>

@available(*, deprecated, renamed: "HudSidebarEntry")
public typealias HudsonSidebarEntry<Selection: Hashable> = HudSidebarEntry<Selection>

@available(*, deprecated, renamed: "HudSidebarIconStyle")
public typealias HudsonSidebarIconStyle = HudSidebarIconStyle

@available(*, deprecated, renamed: "HudSidebarIndicatorStyle")
public typealias HudsonSidebarIndicatorStyle = HudSidebarIndicatorStyle

@available(*, deprecated, renamed: "HudSidebarItem")
public typealias HudsonSidebarItem<Selection: Hashable> = HudSidebarItem<Selection>

@available(*, deprecated, renamed: "HudSidebarLayout")
public typealias HudsonSidebarLayout = HudSidebarLayout

@available(*, deprecated, renamed: "HudSidebarMotion")
public typealias HudsonSidebarMotion = HudSidebarMotion

@available(*, deprecated, renamed: "HudSidebarMotionStyle")
public typealias HudsonSidebarMotionStyle = HudSidebarMotionStyle

@available(*, deprecated, renamed: "HudSidebarStyle")
public typealias HudsonSidebarStyle = HudSidebarStyle

@available(*, deprecated, renamed: "HudSidebarSurfaceStyle")
public typealias HudsonSidebarSurfaceStyle = HudSidebarSurfaceStyle

@available(*, deprecated, renamed: "HudTakeover")
public typealias HudsonTakeover<Header: View, Content: View> = HudTakeover<Header, Content>

@available(*, deprecated, renamed: "HudTerminalDrawer")
public typealias HudsonTerminalDrawer<Content: View> = HudTerminalDrawer<Content>
