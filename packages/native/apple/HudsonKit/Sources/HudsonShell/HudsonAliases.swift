import SwiftUI

// Deprecated `Hudson*` aliases retained for source compatibility. New code
// should use the `H*` canonical names directly.

@available(*, deprecated, renamed: "HAppShell")
public typealias HudsonAppShell<
    Leading: View,
    Trailing: View,
    TopDrawer: View,
    BottomDrawer: View,
    Content: View,
    StatusBar: View
> = HAppShell<Leading, Trailing, TopDrawer, BottomDrawer, Content, StatusBar>

@available(*, deprecated, renamed: "HCanvas")
public typealias HudsonCanvas<Header: View, Content: View> = HCanvas<Header, Content>

@available(*, deprecated, renamed: "HCommand")
public typealias HudsonCommand = HCommand

@available(*, deprecated, renamed: "HCommandPalette")
public typealias HudsonCommandPalette = HCommandPalette

@available(*, deprecated, renamed: "HInspector")
public typealias HudsonInspector<Header: View, Content: View> = HInspector<Header, Content>

@available(*, deprecated, renamed: "HInspectorToggle")
public typealias HudsonInspectorToggle = HInspectorToggle

@available(*, deprecated, renamed: "HNavigationRail")
public typealias HudsonNavigationRail<Footer: View> = HNavigationRail<Footer>

@available(*, deprecated, renamed: "HRailItem")
public typealias HudsonNavRailItem = HRailItem

@available(*, deprecated, renamed: "HRailItem")
public typealias HudsonRailItem = HRailItem

@available(*, deprecated, renamed: "HNavigationSidebar")
public typealias HudsonNavigationSidebar<
    Selection: Hashable,
    RailHeader: View,
    LabelHeader: View,
    Footer: View
> = HNavigationSidebar<Selection, RailHeader, LabelHeader, Footer>

@available(*, deprecated, renamed: "HSidebarEntry")
public typealias HudsonSidebarEntry<Selection: Hashable> = HSidebarEntry<Selection>

@available(*, deprecated, renamed: "HSidebarIconStyle")
public typealias HudsonSidebarIconStyle = HSidebarIconStyle

@available(*, deprecated, renamed: "HSidebarIndicatorStyle")
public typealias HudsonSidebarIndicatorStyle = HSidebarIndicatorStyle

@available(*, deprecated, renamed: "HSidebarItem")
public typealias HudsonSidebarItem<Selection: Hashable> = HSidebarItem<Selection>

@available(*, deprecated, renamed: "HSidebarLayout")
public typealias HudsonSidebarLayout = HSidebarLayout

@available(*, deprecated, renamed: "HSidebarMotion")
public typealias HudsonSidebarMotion = HSidebarMotion

@available(*, deprecated, renamed: "HSidebarMotionStyle")
public typealias HudsonSidebarMotionStyle = HSidebarMotionStyle

@available(*, deprecated, renamed: "HSidebarStyle")
public typealias HudsonSidebarStyle = HSidebarStyle

@available(*, deprecated, renamed: "HSidebarSurfaceStyle")
public typealias HudsonSidebarSurfaceStyle = HSidebarSurfaceStyle

@available(*, deprecated, renamed: "HTakeover")
public typealias HudsonTakeover<Header: View, Content: View> = HTakeover<Header, Content>

@available(*, deprecated, renamed: "HTerminalDrawer")
public typealias HudsonTerminalDrawer<Content: View> = HTerminalDrawer<Content>
