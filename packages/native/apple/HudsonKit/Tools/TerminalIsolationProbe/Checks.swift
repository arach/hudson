import Foundation
import IOSurface

func require(_ condition: @autoclosure () -> Bool, _ message: String) {
    guard condition() else { fputs("FAIL: \(message)\n", stderr); exit(1) }
}
func reply<T>(_ invoke: (@escaping (T) -> Void) -> Void) -> T {
    let semaphore = DispatchSemaphore(value: 0)
    var value: T?
    invoke { result in value = result; semaphore.signal() }
    require(semaphore.wait(timeout: .now() + 5) == .success, "XPC reply deadline")
    return value!
}
func pixel(_ surface: IOSurface) -> UInt32 {
    require(surface.lock(options: .readOnly, seed: nil) == 0, "Surface read lock")
    defer { _ = surface.unlock(options: .readOnly, seed: nil) }
    return surface.baseAddress.load(as: UInt32.self)
}
