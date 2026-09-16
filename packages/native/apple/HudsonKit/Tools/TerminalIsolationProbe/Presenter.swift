import AppKit
import Metal
import QuartzCore

// AppKit-only host. Geometry stays on the main thread; IPC, texture import and
// GPU submission live on the dedicated presenter queue. No SwiftUI dependency.
final class ProbeTerminalView: NSView {
    let metalLayer = CAMetalLayer()
    override init(frame: NSRect) {
        super.init(frame: frame)
        metalLayer.device = MTLCreateSystemDefaultDevice()
        metalLayer.pixelFormat = .bgra8Unorm
        metalLayer.framebufferOnly = false // fixture reads one pixel for verification
        metalLayer.maximumDrawableCount = 3
        metalLayer.allowsNextDrawableTimeout = true
        metalLayer.isOpaque = true
        layer = metalLayer
        wantsLayer = true
    }
    required init?(coder: NSCoder) { fatalError("Programmatic fixture only") }
    override func layout() {
        super.layout()
        let scale = window?.backingScaleFactor ?? 1
        metalLayer.contentsScale = scale
        metalLayer.drawableSize = CGSize(width: max(1, bounds.width * scale), height: max(1, bounds.height * scale))
    }
    override func viewDidChangeBackingProperties() { super.viewDidChangeBackingProperties(); needsLayout = true }
}

final class ProbePresenter {
    private let work = DispatchQueue(label: "hudson.terminal.probe.presenter", qos: .userInteractive)
    private let layer: CAMetalLayer
    private let proxy: ProbeService
    private let device: MTLDevice
    private let commands: MTLCommandQueue
    private let pipeline: MTLRenderPipelineState
    private let readback: MTLBuffer
    private var running = false
    private var inFlight = false
    private var completed = 0
    private var failures: [String] = []
    private var stopReply: (() -> Void)?

    init(layer: CAMetalLayer, proxy: ProbeService) throws {
        self.layer = layer; self.proxy = proxy
        guard let device = layer.device, let commands = device.makeCommandQueue(),
              let readback = device.makeBuffer(length: 256, options: .storageModeShared) else {
            throw NSError(domain: "ProbePresenter", code: 1)
        }
        self.device = device; self.commands = commands; self.readback = readback
        let library = try device.makeLibrary(source: """
        #include <metal_stdlib>
        using namespace metal;
        struct Vertex { float4 position [[position]]; float2 uv; };
        vertex Vertex vertexMain(uint i [[vertex_id]]) {
            float2 p = float2((i << 1) & 2, i & 2);
            return {float4(p * 2 - 1, 0, 1), float2(p.x, 1 - p.y)};
        }
        fragment float4 fragmentMain(Vertex in [[stage_in]], texture2d<float> frame [[texture(0)]]) {
            constexpr sampler sample(filter::nearest, address::clamp_to_edge);
            return frame.sample(sample, in.uv);
        }
        """, options: nil)
        let descriptor = MTLRenderPipelineDescriptor()
        descriptor.vertexFunction = library.makeFunction(name: "vertexMain")
        descriptor.fragmentFunction = library.makeFunction(name: "fragmentMain")
        descriptor.colorAttachments[0].pixelFormat = .bgra8Unorm
        pipeline = try device.makeRenderPipelineState(descriptor: descriptor)
    }
    func start() { work.async { self.running = true; self.nextFrame() } }
    // Only the test coordinator uses sync; never called by the AppKit main thread.
    func snapshot() -> (completed: Int, failures: [String]) { work.sync { (completed, failures) } }
    func stop(completion: @escaping () -> Void) {
        work.async {
            self.running = false
            if self.inFlight { self.stopReply = completion } else { completion() }
        }
    }
    private func nextFrame() {
        guard running, !inFlight else { return }
        inFlight = true
        proxy.acquireFrame { surface, sequence in
            self.work.async {
                guard let surface, sequence > 0 else {
                    self.failures.append("Frame unavailable"); self.running = false; self.finish(); return
                }
                guard self.running else { self.release(sequence); return }
                guard let texture = ProbeFrame.texture(surface, device: self.device),
                      let drawable = self.layer.nextDrawable(),
                      let command = self.commands.makeCommandBuffer() else {
                    self.failures.append("Invalid frame or unavailable drawable"); self.running = false
                    self.release(sequence); return
                }
                let pass = MTLRenderPassDescriptor()
                pass.colorAttachments[0].texture = drawable.texture
                pass.colorAttachments[0].loadAction = .dontCare
                pass.colorAttachments[0].storeAction = .store
                guard let encoder = command.makeRenderCommandEncoder(descriptor: pass) else {
                    self.failures.append("Missing render encoder"); self.running = false; self.release(sequence); return
                }
                encoder.setRenderPipelineState(self.pipeline)
                encoder.setFragmentTexture(texture, index: 0)
                encoder.drawPrimitives(type: .triangle, vertexStart: 0, vertexCount: 3)
                encoder.endEncoding()
                guard let blit = command.makeBlitCommandEncoder() else {
                    self.failures.append("Missing verification encoder"); self.running = false; self.release(sequence); return
                }
                blit.copy(from: drawable.texture, sourceSlice: 0, sourceLevel: 0, sourceOrigin: MTLOrigin(),
                    sourceSize: MTLSize(width: 1, height: 1, depth: 1), to: self.readback,
                    destinationOffset: 0, destinationBytesPerRow: 256, destinationBytesPerImage: 256)
                blit.endEncoding()
                command.present(drawable)
                command.addCompletedHandler { command in
                    self.work.async {
                        // Retain imported storage through GPU completion. Only now
                        // may the helper overwrite this lease's shared texture.
                        withExtendedLifetime((surface, texture, drawable)) {
                            if command.status != .completed || self.readback.contents().load(as: UInt32.self) != ProbeFrame.pixel(sequence) {
                                self.failures.append("GPU completion or drawable pixel integrity"); self.running = false
                            } else { self.completed += 1 }
                            self.release(sequence)
                        }
                    }
                }
                command.commit()
            }
        }
    }
    private func release(_ sequence: UInt64) {
        proxy.releaseFrame(sequence) { accepted in
            self.work.async {
                if !accepted { self.failures.append("GPU-completed lease release rejected"); self.running = false }
                self.finish()
            }
        }
    }
    private func finish() {
        inFlight = false
        if let reply = stopReply { stopReply = nil; reply() }
        // Synthetic source cadence only. A real terminal must wake on dirty
        // state/display demand, not poll idle panes at this fixture cadence.
        if running { work.asyncAfter(deadline: .now() + .milliseconds(16)) { self.nextFrame() } }
    }
}
