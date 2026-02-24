'use client';

import { useEffect, useRef } from 'react';

// ── Types ───────────────────────────────────────────────────────

export interface GlyphWavesProps {
  /** Characters used for dithering, dark → light */
  charset?: string;
  /** Glyph cell size in pixels */
  cellSize?: number;
  /** Dark color (hex) */
  colorDark?: string;
  /** Light / accent color (hex) */
  colorLight?: string;
  /** Perlin noise scale */
  noiseScale?: number;
  /** Noise skew angle in degrees */
  noiseSkew?: number;
  /** Noise animation speed (0 = frozen) */
  noiseSpeed?: number;
  /** Noise drift speed */
  noiseDrift?: number;
  /** Brightness gamma (lower = more contrast) */
  gamma?: number;
  /** Overlay blend mix (0–1) */
  overlayMix?: number;
  /** Mouse trail radius (normalized 0–1) */
  mouseRadius?: number;
  /** Mouse trail displacement strength */
  mouseStrength?: number;
  /** Mouse trail dissipation rate (0–1, higher = longer trail) */
  mouseDissipation?: number;
  /** Grain intensity (0–1) */
  grainAmount?: number;
  /** Grain animation speed */
  grainSpeed?: number;
  /** Canvas opacity (0–1) */
  opacity?: number;
  /** Max device pixel ratio */
  maxDpr?: number;
  /** CSS class for the canvas element */
  className?: string;
}

// ── Hex → RGB helper ────────────────────────────────────────────

function hexToGL(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

// ── Shader sources ──────────────────────────────────────────────

const VERT = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

// Pass 1: Perlin noise + mouse trail → framebuffer
const NOISE_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_mouseStr;

// Params
uniform float u_noiseScale;
uniform float u_noiseSkew;
uniform float u_noiseSpeed;
uniform float u_noiseDrift;
uniform float u_overlayMix;
uniform float u_mouseRadius;
uniform float u_mouseStrength;

// ── Perlin noise ──
vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x / 289.0) * 289.0; }
vec4 permute(vec4 x) { return mod289((x * 34.0 + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0,0,1,1);
  vec4 Pf = fract(P.xyxy) - vec4(0,0,1,1);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz, iy = Pi.yyww;
  vec4 fx = Pf.xzxz, fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i / 41.0) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx -= tx;
  vec2 g00 = vec2(gx.x,gy.x), g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z), g11 = vec2(gx.w,gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00),dot(g01,g01),dot(g10,g10),dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x,fy.x));
  float n10 = dot(g10, vec2(fx.y,fy.y));
  float n01 = dot(g01, vec2(fx.z,fy.z));
  float n11 = dot(g11, vec2(fx.w,fy.w));
  vec2 f = fade(Pf.xy);
  float n_x0 = mix(n00, n10, f.x);
  float n_x1 = mix(n01, n11, f.x);
  return mix(n_x0, n_x1, f.y);
}

void main() {
  vec2 uv = v_uv;
  float aspect = u_resolution.x / u_resolution.y;

  float skewRad = radians(u_noiseSkew);
  vec2 skewed = vec2(uv.x * aspect + uv.y * sin(skewRad) * 0.5, uv.y);
  float drift = u_time * u_noiseDrift * 0.001;
  vec2 noiseCoord = skewed * u_noiseScale + vec2(drift, drift * 0.5);

  float n = cnoise(noiseCoord);
  n += cnoise(noiseCoord * 2.1 + 3.7) * 0.5;
  n += cnoise(noiseCoord * 4.3 + 7.1) * 0.25;
  n = n / 1.75;

  float val = smoothstep(-0.1, 0.4, n);

  // Overlay blend for contrast
  float overlay = val < 0.5
    ? 2.0 * val * val
    : 1.0 - 2.0 * (1.0 - val) * (1.0 - val);
  val = mix(val, overlay, u_overlayMix);

  // Mouse interaction: brighten + displace near cursor
  float dist = distance(uv, u_mouse);
  float proximity = smoothstep(u_mouseRadius, 0.0, dist);
  // Always-on glow near mouse (no decay needed)
  float glow = proximity * u_mouseStrength;
  // Noise displacement for organic feel
  float displaceNoise = cnoise(uv * 12.0 + u_time * 2.0);
  val += glow * (0.6 + displaceNoise * 0.4);
  // Extra ripple on recent movement
  val += proximity * u_mouseStr * displaceNoise * u_mouseStrength * 0.5;
  val = clamp(val, 0.0, 1.0);

  fragColor = vec4(val, val, val, 1.0);
}`;

// Pass 2: Glyph dither + duotone + grain
const GLYPH_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_noise;
uniform sampler2D u_glyphs;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_glyphCols;
uniform vec2 u_cellSize;

// Params
uniform vec3 u_colorDark;
uniform vec3 u_colorLight;
uniform float u_gamma;
uniform float u_grainAmount;
uniform float u_grainSpeed;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

void main() {
  vec2 pixel = v_uv * u_resolution;
  vec2 cell = floor(pixel / u_cellSize);
  vec2 cellUV = fract(pixel / u_cellSize);

  vec2 cellCenter = (cell + 0.5) * u_cellSize / u_resolution;
  float brightness = texture(u_noise, cellCenter).r;

  brightness = pow(brightness, u_gamma);

  float charIndex = floor(brightness * (u_glyphCols - 0.01));
  charIndex = clamp(charIndex, 0.0, u_glyphCols - 1.0);

  float atlasX = (charIndex + cellUV.x) / u_glyphCols;
  float glyph = texture(u_glyphs, vec2(atlasX, cellUV.y)).r;

  vec3 color = mix(u_colorDark, u_colorLight, glyph * brightness);

  // Grain (soft light blend)
  float grain = hash(v_uv * u_resolution + u_time * u_grainSpeed);
  grain = (grain - 0.5) * u_grainAmount;
  vec3 softLight = mix(2.0 * (1.0 - color), 2.0 * color, step(vec3(0.5), color));
  color = color + grain * softLight;

  fragColor = vec4(color, 1.0);
}`;

// ── Glyph atlas generation ──────────────────────────────────────

function createGlyphAtlas(charset: string, size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const cols = charset.length;
  canvas.width = cols * size;
  canvas.height = size * 2;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#fff';
  ctx.font = `${size}px monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';

  for (let i = 0; i < cols; i++) {
    ctx.fillText(charset[i], i * size + size / 2, size * 0.25);
  }

  return canvas;
}

// ── WebGL helpers ───────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error: ${info}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const program = gl.createProgram()!;
  gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error: ${info}`);
  }
  return program;
}

// ── Defaults ────────────────────────────────────────────────────

const DEFAULTS: Required<Omit<GlyphWavesProps, 'className'>> = {
  charset: ':::..;.-',
  cellSize: 12,
  colorDark: '#0A0A0A',
  colorLight: '#10B981',
  noiseScale: 11,
  noiseSkew: 53,
  noiseSpeed: 11,
  noiseDrift: 100,
  gamma: 0.7,
  overlayMix: 0.91,
  mouseRadius: 0.1,
  mouseStrength: 0.4,
  mouseDissipation: 0.96,
  grainAmount: 0.15,
  grainSpeed: 1000,
  opacity: 0.5,
  maxDpr: 2,
};

// ── Component ───────────────────────────────────────────────────

export function GlyphWaves(props: GlyphWavesProps) {
  const p = { ...DEFAULTS, ...props };
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  // Store params in a ref so the render loop always reads latest values
  const paramsRef = useRef(p);
  paramsRef.current = p;

  useEffect(() => {
    const _canvas = canvasRef.current;
    if (!_canvas) return;
    const canvas = _canvas;

    const _gl = canvas.getContext('webgl2', { antialias: false, alpha: false });
    if (!_gl) {
      console.warn('WebGL2 not available');
      return;
    }
    const gl = _gl;

    const params = paramsRef.current;

    // ── Programs ──
    const noiseProg = linkProgram(gl, VERT, NOISE_FRAG);
    const glyphProg = linkProgram(gl, VERT, GLYPH_FRAG);

    // ── Fullscreen quad ──
    const quadVAO = gl.createVertexArray()!;
    gl.bindVertexArray(quadVAO);
    const quadBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    const posLocN = gl.getAttribLocation(noiseProg, 'a_position');
    const posLocG = gl.getAttribLocation(glyphProg, 'a_position');

    // ── Glyph atlas ──
    const atlasCanvas = createGlyphAtlas(params.charset, params.cellSize);
    const glyphTex = gl.createTexture()!;
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, glyphTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlasCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    // ── Framebuffer ──
    const fbTex = gl.createTexture()!;
    const fb = gl.createFramebuffer()!;
    let fbW = 0, fbH = 0;

    function resizeFB(w: number, h: number) {
      if (w === fbW && h === fbH) return;
      fbW = w; fbH = h;
      gl.bindTexture(gl.TEXTURE_2D, fbTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, fbTex, 0);
    }

    // ── Uniform locations ──
    const nLocs = {
      time: gl.getUniformLocation(noiseProg, 'u_time'),
      resolution: gl.getUniformLocation(noiseProg, 'u_resolution'),
      mouse: gl.getUniformLocation(noiseProg, 'u_mouse'),
      mouseStr: gl.getUniformLocation(noiseProg, 'u_mouseStr'),
      noiseScale: gl.getUniformLocation(noiseProg, 'u_noiseScale'),
      noiseSkew: gl.getUniformLocation(noiseProg, 'u_noiseSkew'),
      noiseSpeed: gl.getUniformLocation(noiseProg, 'u_noiseSpeed'),
      noiseDrift: gl.getUniformLocation(noiseProg, 'u_noiseDrift'),
      overlayMix: gl.getUniformLocation(noiseProg, 'u_overlayMix'),
      mouseRadius: gl.getUniformLocation(noiseProg, 'u_mouseRadius'),
      mouseStrength: gl.getUniformLocation(noiseProg, 'u_mouseStrength'),
    };
    const gLocs = {
      noise: gl.getUniformLocation(glyphProg, 'u_noise'),
      glyphs: gl.getUniformLocation(glyphProg, 'u_glyphs'),
      time: gl.getUniformLocation(glyphProg, 'u_time'),
      resolution: gl.getUniformLocation(glyphProg, 'u_resolution'),
      glyphCols: gl.getUniformLocation(glyphProg, 'u_glyphCols'),
      cellSize: gl.getUniformLocation(glyphProg, 'u_cellSize'),
      colorDark: gl.getUniformLocation(glyphProg, 'u_colorDark'),
      colorLight: gl.getUniformLocation(glyphProg, 'u_colorLight'),
      gamma: gl.getUniformLocation(glyphProg, 'u_gamma'),
      grainAmount: gl.getUniformLocation(glyphProg, 'u_grainAmount'),
      grainSpeed: gl.getUniformLocation(glyphProg, 'u_grainSpeed'),
    };

    // ── Mouse tracking (on window so pointer-events-none doesn't block) ──
    let mouseX = 0.5, mouseY = 0.5;
    let mouseStr = 0;

    function onMouseMove(e: MouseEvent) {
      const rect = canvas.getBoundingClientRect();
      mouseX = (e.clientX - rect.left) / rect.width;
      mouseY = 1.0 - (e.clientY - rect.top) / rect.height;
      mouseStr = 1.0;
    }
    window.addEventListener('mousemove', onMouseMove);

    // ── Resize ──
    function resize() {
      const dpr = Math.min(window.devicePixelRatio, paramsRef.current.maxDpr);
      const rect = canvas.getBoundingClientRect();
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    // ── Render loop ──
    const startTime = performance.now();

    function render() {
      const w = canvas.width, h = canvas.height;
      if (w === 0 || h === 0) { rafRef.current = requestAnimationFrame(render); return; }

      const cp = paramsRef.current;
      const t = (performance.now() - startTime) / 1000;
      mouseStr *= cp.mouseDissipation;

      const [dR, dG, dB] = hexToGL(cp.colorDark);
      const [lR, lG, lB] = hexToGL(cp.colorLight);

      // Pass 1: noise → framebuffer
      resizeFB(w, h);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, w, h);
      gl.useProgram(noiseProg);

      gl.bindVertexArray(quadVAO);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(posLocN);
      gl.vertexAttribPointer(posLocN, 2, gl.FLOAT, false, 0, 0);

      gl.uniform1f(nLocs.time, t);
      gl.uniform2f(nLocs.resolution, w, h);
      gl.uniform2f(nLocs.mouse, mouseX, mouseY);
      gl.uniform1f(nLocs.mouseStr, mouseStr);
      gl.uniform1f(nLocs.noiseScale, cp.noiseScale);
      gl.uniform1f(nLocs.noiseSkew, cp.noiseSkew);
      gl.uniform1f(nLocs.noiseSpeed, cp.noiseSpeed);
      gl.uniform1f(nLocs.noiseDrift, cp.noiseDrift);
      gl.uniform1f(nLocs.overlayMix, cp.overlayMix);
      gl.uniform1f(nLocs.mouseRadius, cp.mouseRadius);
      gl.uniform1f(nLocs.mouseStrength, cp.mouseStrength);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Pass 2: glyph dither → screen
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(glyphProg);

      gl.enableVertexAttribArray(posLocG);
      gl.vertexAttribPointer(posLocG, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbTex);
      gl.uniform1i(gLocs.noise, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, glyphTex);
      gl.uniform1i(gLocs.glyphs, 1);

      gl.uniform1f(gLocs.time, t);
      gl.uniform2f(gLocs.resolution, w, h);
      gl.uniform1f(gLocs.glyphCols, cp.charset.length);
      gl.uniform2f(gLocs.cellSize, cp.cellSize, cp.cellSize * 2);
      gl.uniform3f(gLocs.colorDark, dR, dG, dB);
      gl.uniform3f(gLocs.colorLight, lR, lG, lB);
      gl.uniform1f(gLocs.gamma, cp.gamma);
      gl.uniform1f(gLocs.grainAmount, cp.grainAmount);
      gl.uniform1f(gLocs.grainSpeed, cp.grainSpeed);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafRef.current = requestAnimationFrame(render);
    }

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      ro.disconnect();
      gl.deleteProgram(noiseProg);
      gl.deleteProgram(glyphProg);
      gl.deleteTexture(glyphTex);
      gl.deleteTexture(fbTex);
      gl.deleteFramebuffer(fb);
      gl.deleteBuffer(quadBuf);
      gl.deleteVertexArray(quadVAO);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={p.className ?? 'absolute inset-0 w-full h-full'}
      style={{ opacity: p.opacity }}
    />
  );
}
