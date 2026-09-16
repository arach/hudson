#if os(macOS)
import AppKit
import IOSurface
import Metal
import QuartzCore

final class HudTerminalIPCPresenter {
    private let queue = DispatchQueue(label: "hudson.terminal.presentation", qos: .userInteractive)
    private let layer: CAMetalLayer
    private let proxy: HudTerminalWorkerService
    private let identifier: String
    private let failure: (String) -> Void
    private let device: MTLDevice
    private let commands: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState
    private var visible = false
    private var stopped = false
    private var generation: UInt64 = 0
    private var inFlight = false
    private var stopCompletion: (() -> Void)?
    init(layer: CAMetalLayer, proxy: HudTerminalWorkerService, identifier: String, failure: @escaping (String) -> Void) throws {
        self.layer = layer; self.proxy = proxy; self.identifier = identifier; self.failure = failure
        guard let device = layer.device, let commands = device.makeCommandQueue() else { throw NSError(domain: "Terminal Metal", code: 1) }
        self.device = device; self.commands = commands
        let library = try device.makeLibrary(source: """
        #include <metal_stdlib>
        using namespace metal;
        struct Vertex { float4 position [[position]]; float2 uv; };
        vertex Vertex terminalVertex(uint i [[vertex_id]]) {
            float2 p = float2((i << 1) & 2, i & 2);
            return {float4(p * 2 - 1, 0, 1), float2(p.x, 1 - p.y)};
        }
        fragment float4 terminalFragment(Vertex in [[stage_in]], texture2d<float> frame [[texture(0)]]) {
            constexpr sampler sample(filter::nearest, address::clamp_to_edge);
            return frame.sample(sample, in.uv);
        }
        """, options: nil)
        let description = MTLRenderPipelineDescriptor()
        description.vertexFunction = library.makeFunction(name: "terminalVertex")
        description.fragmentFunction = library.makeFunction(name: "terminalFragment")
        description.colorAttachments[0].pixelFormat = .bgra8Unorm
        pipeline = try device.makeRenderPipelineState(descriptor: description)
    }
    func setVisible(_ value: Bool) {
        queue.async {
            guard !self.stopped, self.visible != value else { return }
            self.visible = value; self.generation += 1
            if value { self.next() } else if self.inFlight { self.proxy.cancelAcquire(self.identifier) {} }
        }
    }
    func stop(_ completion: @escaping () -> Void) {
        queue.async {
            self.stopped = true; self.visible = false; self.generation += 1
            if self.inFlight { self.stopCompletion = completion; self.proxy.cancelAcquire(self.identifier) {} }
            else { completion() }
        }
    }
    private func next() {
        guard visible, !stopped, !inFlight else { return }
        inFlight = true
        let generation = self.generation
        proxy.acquire(identifier) { surface, sequence in
            self.queue.async {
                guard let surface, sequence > 0 else {
                    if self.visible && generation == self.generation { self.failed("Terminal frame unavailable") }
                    self.finish(); return
                }
                self.present(surface, sequence: sequence, generation: generation)
            }
        }
    }
    private func present(_ surface: IOSurface, sequence: UInt64, generation: UInt64, attempt: Int = 0) {
        guard self.visible, !self.stopped, generation == self.generation else { self.release(sequence); return }
        guard surface.width > 0, surface.height > 0, surface.width <= 8192, surface.height <= 8192,
              surface.bytesPerElement == 4, surface.pixelFormat == 0x42475241,
              surface.bytesPerRow >= surface.width * 4,
              surface.allocationSize >= surface.bytesPerRow * surface.height,
              surface.allocationSize <= 96 * 1024 * 1024 else {
            self.failed("Invalid terminal frame"); self.release(sequence); return
        }
        let description = MTLTextureDescriptor.texture2DDescriptor(pixelFormat: .bgra8Unorm, width: surface.width, height: surface.height, mipmapped: false)
        description.storageMode = .shared; description.usage = .shaderRead
        guard let drawable = self.layer.nextDrawable() else {
            // Retain the current lease across a transient drawable timeout. No new
            // frame demand or idle timer is created, and hide/stop invalidates the
            // retry through generation. Never silently strand a visible pane.
            guard attempt < 5 else {
                self.failed("Terminal drawable unavailable — restart the terminal"); self.release(sequence); return
            }
            self.queue.asyncAfter(deadline: .now() + 0.1) {
                self.present(surface, sequence: sequence, generation: generation, attempt: attempt + 1)
            }
            return
        }
        guard let texture = self.device.makeTexture(descriptor: description, iosurface: surface, plane: 0),
              let command = self.commands.makeCommandBuffer() else {
            self.failed("Terminal GPU resource unavailable"); self.release(sequence); return
        }
        let pass = MTLRenderPassDescriptor()
        pass.colorAttachments[0].texture = drawable.texture
        pass.colorAttachments[0].loadAction = .dontCare; pass.colorAttachments[0].storeAction = .store
        guard let encoder = command.makeRenderCommandEncoder(descriptor: pass) else {
            self.failed("Terminal GPU encoder unavailable"); self.release(sequence); return
        }
        encoder.setRenderPipelineState(self.pipeline); encoder.setFragmentTexture(texture, index: 0)
        encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3); encoder.endEncoding()
        command.present(drawable)
        command.addCompletedHandler { command in
            self.queue.async {
                withExtendedLifetime((surface, texture, drawable)) {
                    if command.status != .completed { self.failed("Terminal GPU submission failed") }
                    self.release(sequence)
                }
            }
        }
        command.commit()
    }

    private func failed(_ message: String) { visible = false; failure(message) }
    private func release(_ sequence: UInt64) {
        proxy.release(identifier, sequence: sequence) { accepted in
            self.queue.async {
                if !accepted && !self.stopped { self.failed("Terminal frame ownership mismatch") }
                self.finish()
            }
        }
    }
    private func finish() {
        inFlight = false
        if let completion = stopCompletion { stopCompletion = nil; completion() }
        if visible && !stopped { queue.async { self.next() } }
    }
}
#endif
