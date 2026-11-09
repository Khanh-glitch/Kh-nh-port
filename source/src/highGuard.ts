/**
 * ORBITA conservative High safety gate.
 * No artistic / scene / postprocessing parameters are changed by this module.
 * Default is Low. A manual Q request is approved only after stable Low FPS,
 * a capability check, and an offscreen WebGL2 MSAA framebuffer read-back test.
 * The probe cannot guarantee future driver stability on all hardware.
 */
export type FrameQuality = 'high' | 'low'

type Frame = { t: number; dt: number }
type GateResult = { ok: boolean; reason: string }

class HighGuard {
  private frames: Frame[] = []
  private renderer: { getContext: () => WebGLRenderingContext | WebGL2RenderingContext } | null = null
  private denied = false
  private checked = false
  private enabled = false
  private lastFrameAt = 0

  record(deltaSeconds: number, quality: FrameQuality, renderer: { getContext: () => WebGLRenderingContext | WebGL2RenderingContext }) {
    this.renderer = renderer
    if (quality !== 'low' || typeof document === 'undefined' || document.hidden) {
      this.frames.length = 0
      this.lastFrameAt = 0
      return
    }
    const now = performance.now()
    if (this.lastFrameAt && now - this.lastFrameAt > 250) this.frames.length = 0
    this.lastFrameAt = now
    const dt = Math.max(0, deltaSeconds * 1000)
    if (!Number.isFinite(dt) || dt > 250) { this.frames.length = 0; return }
    this.frames.push({ t: now, dt })
    const minTime = now - 3500
    while (this.frames.length && this.frames[0].t < minTime) this.frames.shift()
    if (this.frames.length > 500) this.frames.shift()
  }

  block() {
    this.denied = true
    this.enabled = false
  }

  tryEnable(): GateResult {
    if (this.denied) return { ok: false, reason: '' }
    if (this.enabled) return { ok: true, reason: '' }
    if (!this.renderer || typeof document === 'undefined' || document.hidden) {
      return { ok: false, reason: 'High đang được kiểm tra; hãy thử lại sau.' }
    }

    // Fail closed when we have insufficient evidence from the actual Low scene.
    const frames = this.frames
    const span = frames.length > 1 ? frames[frames.length - 1].t - frames[0].t : 0
    if (span < 2900 || frames.length < 145) {
      return { ok: false, reason: 'Chưa đủ dữ liệu hiệu năng để mở High.' }
    }
    const dt = frames.map(f => f.dt).sort((a, b) => a - b)
    const averageFps = 1000 * (frames.length - 1) / Math.max(1, span)
    const p95 = dt[Math.min(dt.length - 1, Math.floor(dt.length * .95))]
    const max = dt[dt.length - 1]
    if (averageFps < 57 || p95 > 26 || max > 70) {
      this.denied = true
      return { ok: false, reason: 'High bị khóa: Low chưa đủ ổn định.' }
    }

    const gl = this.renderer.getContext()
    if (!gl || (typeof gl.isContextLost === 'function' && gl.isContextLost())) {
      this.denied = true
      return { ok: false, reason: 'High bị khóa: WebGL chưa ổn định.' }
    }
    if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) {
      this.denied = true
      return { ok: false, reason: 'High yêu cầu WebGL2.' }
    }
    if (gl.getParameter(gl.MAX_SAMPLES) < 4 || gl.getParameter(gl.MAX_TEXTURE_SIZE) < 4096 ||
        gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) < Math.ceil(Math.max(innerWidth, innerHeight) * 1.6)) {
      this.denied = true
      return { ok: false, reason: 'High bị khóa: giới hạn GPU không đủ.' }
    }
    const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
    if ((typeof memory === 'number' && memory < 8) ||
        (typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency < 6)) {
      this.denied = true
      return { ok: false, reason: 'High bị khóa: tài nguyên máy hạn chế.' }
    }

    // Run only once on user request, on a separate, tiny offscreen WebGL2
    // context. No change to the actual Three.js context / render targets.
    if (!this.checked) {
      const tested = this.probeMsaa()
      this.checked = tested.ok
      if (!tested.ok) {
        this.denied = true
        return tested
      }
    }
    this.enabled = true
    this.frames.length = 0
    return { ok: true, reason: '' }
  }

  resetToLow() {
    this.enabled = false
    this.frames.length = 0
    this.lastFrameAt = 0
  }

  private probeMsaa(): GateResult {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 64
    const g = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, preserveDrawingBuffer: true,
      powerPreference: 'high-performance' })
    if (!g) return { ok: false, reason: 'High bị khóa: không tạo được WebGL2 thử nghiệm.' }
    let msaa: WebGLFramebuffer | null = null
    let resolved: WebGLFramebuffer | null = null
    let color: WebGLRenderbuffer | null = null
    let tex: WebGLTexture | null = null
    let floatColor: WebGLRenderbuffer | null = null
    let floatFbo: WebGLFramebuffer | null = null
    try {
      if (g.getParameter(g.MAX_SAMPLES) < 4) throw new Error('MSAA 4x không hỗ trợ')
      color = g.createRenderbuffer()
      msaa = g.createFramebuffer()
      resolved = g.createFramebuffer()
      tex = g.createTexture()
      if (!color || !msaa || !resolved || !tex) throw new Error('Không cấp phát được framebuffer')
      g.bindRenderbuffer(g.RENDERBUFFER, color)
      g.renderbufferStorageMultisample(g.RENDERBUFFER, 4, g.RGBA8, 64, 64)
      g.bindFramebuffer(g.FRAMEBUFFER, msaa)
      g.framebufferRenderbuffer(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.RENDERBUFFER, color)
      if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) throw new Error('MSAA framebuffer chưa hoàn chỉnh')
      g.bindTexture(g.TEXTURE_2D, tex)
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, 64, 64, 0, g.RGBA, g.UNSIGNED_BYTE, null)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST)
      g.bindFramebuffer(g.FRAMEBUFFER, resolved)
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0)
      if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) throw new Error('Resolve framebuffer chưa hoàn chỉnh')
      g.bindFramebuffer(g.FRAMEBUFFER, msaa)
      g.viewport(0, 0, 64, 64)
      g.clearColor(0.15, 0.5, 0.75, 1)
      g.clear(g.COLOR_BUFFER_BIT)
      g.bindFramebuffer(g.READ_FRAMEBUFFER, msaa)
      g.bindFramebuffer(g.DRAW_FRAMEBUFFER, resolved)
      g.blitFramebuffer(0, 0, 64, 64, 0, 0, 64, 64, g.COLOR_BUFFER_BIT, g.NEAREST)
      g.bindFramebuffer(g.READ_FRAMEBUFFER, resolved)
      const px = new Uint8Array(4)
      g.readPixels(32, 32, 1, 1, g.RGBA, g.UNSIGNED_BYTE, px)
      if (Math.abs(px[0] - 38) > 12 || Math.abs(px[1] - 128) > 12 || Math.abs(px[2] - 191) > 12) {
        throw new Error('MSAA resolve cho kết quả sai/đen')
      }
      // Bloom/composer implementations may require floating-point targets.
      // If multisampled half-float targets cannot be created, fail closed.
      if (!g.getExtension('EXT_color_buffer_float')) throw new Error('Floating-point color targets không hỗ trợ')
      floatColor = g.createRenderbuffer()
      floatFbo = g.createFramebuffer()
      if (!floatColor || !floatFbo) throw new Error('Không cấp phát được HDR framebuffer')
      g.bindRenderbuffer(g.RENDERBUFFER, floatColor)
      g.renderbufferStorageMultisample(g.RENDERBUFFER, 4, g.RGBA16F, 64, 64)
      g.bindFramebuffer(g.FRAMEBUFFER, floatFbo)
      g.framebufferRenderbuffer(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.RENDERBUFFER, floatColor)
      if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) throw new Error('HDR framebuffer MSAA không hỗ trợ')
      if (g.getError() !== g.NO_ERROR || g.isContextLost()) throw new Error('WebGL báo lỗi thử nghiệm')
      return { ok: true, reason: '' }
    } catch (error) {
      return { ok: false, reason: `High bị khóa: ${error instanceof Error ? error.message : 'GPU test không đạt'}.` }
    } finally {
      g.bindFramebuffer(g.FRAMEBUFFER, null)
      g.bindRenderbuffer(g.RENDERBUFFER, null)
      if (floatFbo) g.deleteFramebuffer(floatFbo)
      if (floatColor) g.deleteRenderbuffer(floatColor)
      if (resolved) g.deleteFramebuffer(resolved)
      if (msaa) g.deleteFramebuffer(msaa)
      if (color) g.deleteRenderbuffer(color)
      if (tex) g.deleteTexture(tex)
      g.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }
}

export const highGuard = new HighGuard()
