import { BURN_FRAGMENT_SHADER, BURN_VERTEX_SHADER } from "./burn-shader";
import type { BurnIgnition } from "./page-burn-transition";

interface BurnFrame {
  progress: number;
  time: number;
}

interface BurnUniforms {
  progress: WebGLUniformLocation;
  time: WebGLUniformLocation;
  resolution: WebGLUniformLocation;
  ignition: WebGLUniformLocation;
  seed: WebGLUniformLocation;
  snapshot: WebGLUniformLocation;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Unable to create page burn shader.");

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "Unknown shader compilation error.";
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function requireUniform(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name);
  if (!location) throw new Error(`Missing page burn uniform: ${name}`);
  return location;
}

export class BurnWebGLRenderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly program: WebGLProgram;
  private readonly buffer: WebGLBuffer;
  private readonly texture: WebGLTexture;
  private readonly vertexArray: WebGLVertexArrayObject;
  private readonly uniforms: BurnUniforms;
  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    snapshot: HTMLCanvasElement,
    ignition: BurnIgnition,
    seed: number,
  ) {
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    });
    if (!gl) throw new Error("WebGL2 is unavailable.");
    this.gl = gl;

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, BURN_VERTEX_SHADER);
    const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, BURN_FRAGMENT_SHADER);
    const program = gl.createProgram();
    if (!program) throw new Error("Unable to create page burn program.");
    this.program = program;

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) ?? "Unable to link page burn program.");
    }

    const buffer = gl.createBuffer();
    const texture = gl.createTexture();
    const vertexArray = gl.createVertexArray();
    if (!buffer || !texture || !vertexArray) {
      throw new Error("Unable to allocate page burn WebGL resources.");
    }
    this.buffer = buffer;
    this.texture = texture;
    this.vertexArray = vertexArray;

    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snapshot);
    if (gl.getError() !== gl.NO_ERROR) {
      throw new Error("Unable to upload the page snapshot to WebGL.");
    }

    gl.useProgram(program);
    this.uniforms = {
      progress: requireUniform(gl, program, "u_progress"),
      time: requireUniform(gl, program, "u_time"),
      resolution: requireUniform(gl, program, "u_resolution"),
      ignition: requireUniform(gl, program, "u_ignition"),
      seed: requireUniform(gl, program, "u_seed"),
      snapshot: requireUniform(gl, program, "u_snapshot"),
    };
    gl.uniform1i(this.uniforms.snapshot, 0);
    gl.uniform2f(this.uniforms.ignition, ignition.x, ignition.y);
    gl.uniform1f(this.uniforms.seed, seed);
    gl.clearColor(0, 0, 0, 0);
  }

  render({ progress, time }: BurnFrame): void {
    if (this.disposed) return;

    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vertexArray);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.uniform1f(this.uniforms.progress, progress);
    gl.uniform1f(this.uniforms.time, time);
    gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.gl.deleteTexture(this.texture);
    this.gl.deleteBuffer(this.buffer);
    this.gl.deleteVertexArray(this.vertexArray);
    this.gl.deleteProgram(this.program);
  }
}
