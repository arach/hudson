import Foundation
import IOSurface
import Metal

// Shared only by this isolated fixture. All allocation is bounded before IPC.
enum ProbeFrame {
    static let width = 512
    static let height = 256
    static let bytesPerRow = width * 4
    static let allocationSize = bytesPerRow * height
    static func pixel(_ sequence: UInt64) -> UInt32 { 0xff009900 | UInt32(sequence & 0xff) }
    static func texture(_ surface: IOSurface, device: MTLDevice) -> MTLTexture? {
        guard surface.width == width, surface.height == height,
              surface.bytesPerElement == 4, surface.bytesPerRow == bytesPerRow,
              surface.allocationSize == allocationSize,
              surface.pixelFormat == 0x42475241 else { return nil }
        let descriptor = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm,
            width: width, height: height, mipmapped: false)
        descriptor.storageMode = .shared
        descriptor.usage = [.renderTarget, .shaderRead]
        return device.makeTexture(descriptor: descriptor, iosurface: surface, plane: 0)
    }
}

// Worker owns one device/queue and a fixed pool. Publish only in the GPU's
// completion callback; CPU writes are never used to produce frame pixels.
final class GPUProducer {
    let device: MTLDevice
    let queue: MTLCommandQueue
    let surfaces: [IOSurface]
    let textures: [MTLTexture]
    init?() {
        guard let device = MTLCreateSystemDefaultDevice(), let queue = device.makeCommandQueue() else { return nil }
        self.device = device; self.queue = queue
        let surfaces = (0..<3).compactMap { _ in IOSurface(properties: [
            .width: ProbeFrame.width, .height: ProbeFrame.height, .bytesPerElement: 4,
            .bytesPerRow: ProbeFrame.bytesPerRow, .allocSize: ProbeFrame.allocationSize,
            .pixelFormat: 0x42475241]) }
        guard surfaces.count == 3 else { return nil }
        let textures = surfaces.compactMap { ProbeFrame.texture($0, device: device) }
        guard textures.count == 3 else { return nil }
        self.surfaces = surfaces; self.textures = textures
    }
    func render(slot: Int, sequence: UInt64, completion: @escaping (Bool) -> Void) {
        guard let buffer = queue.makeCommandBuffer() else { completion(false); return }
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = textures[slot]
        pass.colorAttachments[0].loadAction = .clear
        pass.colorAttachments[0].storeAction = .store
        pass.colorAttachments[0].clearColor = MTLClearColor(red: 0, green: 0.6,
            blue: Double(sequence & 0xff) / 255, alpha: 1)
        guard let encoder = buffer.makeRenderCommandEncoder(descriptor: pass) else { completion(false); return }
        encoder.endEncoding()
        buffer.addCompletedHandler { completion($0.status == .completed) }
        buffer.commit()
    }
}
