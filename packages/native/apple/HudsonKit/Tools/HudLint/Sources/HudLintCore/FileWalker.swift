import Foundation

public enum FileWalker {
    /// Enumerate every `.swift` file under `root`, returning tuples of
    /// (absolutePath, pathRelativeToRoot). Hidden directories and `.build`
    /// are skipped.
    public static func swiftFiles(under root: String) -> [(absolute: String, relative: String)] {
        let fm = FileManager.default
        let rootURL = URL(fileURLWithPath: root, isDirectory: true).standardizedFileURL
        let rootPath = rootURL.path
        guard let enumerator = fm.enumerator(
            at: rootURL,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }
        var results: [(String, String)] = []
        for case let fileURL as URL in enumerator {
            let isDir = (try? fileURL.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory ?? false
            let name = fileURL.lastPathComponent
            if isDir {
                if name == ".build" || name == "DerivedData" || name == ".swiftpm" {
                    enumerator.skipDescendants()
                }
                continue
            }
            guard fileURL.pathExtension == "swift" else { continue }
            let absolute = fileURL.standardizedFileURL.path
            var relative = absolute
            if absolute.hasPrefix(rootPath) {
                relative = String(absolute.dropFirst(rootPath.count))
                while relative.hasPrefix("/") { relative.removeFirst() }
            }
            results.append((absolute, relative))
        }
        return results
    }
}
