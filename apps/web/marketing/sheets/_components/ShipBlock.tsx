export function SurfaceMapBlock() {
  return (
    <pre className="code" style={{ margin: 0, minHeight: 168 }}>
      <span className="at">workspace vocabulary</span>
      {'\n'}
      <span className="com">  implemented per surface</span>
      {'\n\n'}
      <span className="kw">web</span>     → React / hudsonkit
      {'\n'}
      <span className="kw">macOS</span>   → SwiftUI / HudsonKit
      {'\n'}
      <span className="kw">iOS</span>     → SwiftUI / HudsonKit
      {'\n\n'}
      <span className="com">shared model · platform-native code</span>
    </pre>
  );
}
