
import geometry from '../data/acceleratorGeometry.json';

export type HallView = 'plan' | 'aisle';
type Vec3 = readonly [number, number, number];
type ScreenPoint = { x: number; y: number; visible: boolean };
export type HallCamera = { view: HallView; yaw: number; pitch: number; zoom: number };
type HallFrame = { camera: HallCamera; built: number; raised: number; beam: number };
const stride = 16;
const radii = { plan: Math.hypot(62, 79.7, 55), aisle: Math.hypot(16, 12.2, .2) };
const shadowSize = 1024;

const normalize = (v: Vec3): Vec3 => {
  const l = Math.hypot(...v);
  return [v[0] / l, v[1] / l, v[2] / l];
};
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

function multiply(a: Float32Array, b: Float32Array) {
  return Float32Array.from({ length: 16 }, (_, i) => {
    const row = i % 4, col = i - row;
    return a[row] * b[col] + a[row + 4] * b[col + 1] + a[row + 8] * b[col + 2] + a[row + 12] * b[col + 3];
  });
}

function lookAt(eye: Vec3, center: Vec3) {
  const back = normalize([eye[0] - center[0], eye[1] - center[1], eye[2] - center[2]]);
  const right = normalize(cross([0, 0, 1], back));
  const up = cross(back, right);
  return new Float32Array([
    right[0], up[0], back[0], 0, right[1], up[1], back[1], 0, right[2], up[2], back[2], 0,
    -dot(right, eye), -dot(up, eye), -dot(back, eye), 1
  ]);
}

function cameraMatrices(camera: HallCamera, aspect: number) {
  const plan = camera.view === 'plan';
  const azimuth = (plan ? -0.91 : 0.65) + camera.yaw;
  const elevation = plan ? .52 + camera.pitch : -camera.pitch;
  const radius = radii[camera.view] / (plan ? camera.zoom : 1);
  const delta: Vec3 = [
    Math.cos(azimuth) * Math.cos(elevation) * radius,
    Math.sin(azimuth) * Math.cos(elevation) * radius,
    Math.sin(elevation) * radius,
  ];
  const eye: Vec3 = plan ? [-1 + delta[0], 1.7 + delta[1], 1 + delta[2]] : [8, -30, 2.02];
  const center: Vec3 = plan ? [-1, 1.7, 1] : [8 + delta[0], -30 + delta[1], 1.82 + delta[2]];
  const q = (plan ? 1 : camera.zoom) / Math.tan(plan ? .262 : .40);
  const xScale = plan ? Math.min(q / aspect, aspect < 1 ? 2.42 : 2.14) : q / aspect;
  const yScale = plan ? xScale * aspect : q;
  const near = plan ? .18 : .06, far = 350;
  const projection = new Float32Array([
    xScale, 0, 0, 0, 0, yScale, 0, 0, 0, 0, (near + far) / (near - far), -1,
    0, 0, 2 * near * far / (near - far), 0,
  ]);
  // Keep the hall slightly above the bottom controls on tall screens.
  if (plan && aspect < 1) projection[9] = -.14;
  return { eye, vp: multiply(projection, lookAt(eye, center)) };
}

function project(vp: Float32Array, [x, y, z]: number[]): ScreenPoint {
  const fx = x * vp[0] + y * vp[4] + z * vp[8] + vp[12];
  const fy = x * vp[1] + y * vp[5] + z * vp[9] + vp[13];
  const w = x * vp[3] + y * vp[7] + z * vp[11] + vp[15];
  const sx = .5 + .5 * fx / w, sy = .5 - .5 * fy / w;
  return { x: sx, y: sy, visible: w > 0 && sx > .04 && sx < .96 && sy > .14 && sy < .89 };
}


const vertex = `#version 300 es
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec3 materialColor;
layout(location=3) in vec3 properties;
uniform mat4 vp;
uniform mat4 sunVP;
uniform float lift;
out vec3 p, n, tint, surface, shadowUVW;
void main() {
  p = position / 256.0 + vec3(0.0, 0.0, lift);
  n = normal;
  tint = materialColor;
  surface = properties;
  shadowUVW = (sunVP * vec4(p, 1.0)).xyz * 0.5 + 0.5;
  gl_Position = vp * vec4(p, 1.0);
}`;

const fragment = `#version 300 es
precision highp float;
uniform vec3 eye;
uniform bool indoors;
uniform sampler2D depthMap;
in vec3 p, n, tint, surface, shadowUVW;
out vec4 outColor;
float hash(vec3 v) {
  v = fract(v * 0.3183099 + vec3(0.1, 0.15, 0.21));
  v *= 17.0;
  return fract(v.x * v.y * v.z * (v.x + v.y + v.z));
}
void main() {
  vec3 N = normalize(n), V = normalize(eye - p);
  vec3 L = normalize(vec3(0.24, -0.31, 0.92));
  float diffuse = max(0.0, dot(N, L));
  float visibility = 1.0;
  if (all(greaterThan(shadowUVW, vec3(0.0))) && all(lessThan(shadowUVW, vec3(1.0)))) {
    visibility = 0.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      float sampledZ = texture(depthMap, shadowUVW.xy + vec2(x,y) / 1024.0).r;
      visibility += step(shadowUVW.z - 0.0028, sampledZ) / 9.0;
    }
  }
  vec3 color = pow(tint, vec3(2.2));
  float grit = 0.92 + 0.10 * hash(floor(p * 26.0)) + 0.09 * hash(floor(p * 1.7));
  float fill = max(0.0, dot(N, normalize(vec3(-0.4, 0.55, 0.75))));
  float sky = 0.30 + 0.15 * max(0.0, N.z);
  float energy = indoors ? 0.78 : 1.0;
  vec3 H = normalize(L + V);
  float specular = pow(max(0.0, dot(N, H)), mix(65.0, 12.0, surface.y));
  float rim = pow(1.0 - max(0.0, dot(N, V)), 2.5) * surface.x;
  vec3 shade = color * grit * (sky + energy * (visibility * diffuse * 0.63 + fill * 0.20));
  shade += vec3(0.66, 0.82, 0.91) * (0.06 + 0.30 * surface.x) * specular * visibility;
  shade += vec3(0.10, 0.16, 0.20) * rim + color * surface.z * 1.9;
  float haze = 1.0 - exp(-length(eye - p) * (indoors ? 0.0025 : 0.0014));
  shade = mix(shade, vec3(0.16,0.21,0.25), haze);
  outColor = vec4(pow(max(shade, vec3(0.0)), vec3(0.455)), 1.0);
}`;

const depthVertex = `#version 300 es
layout(location=0) in vec3 position;
uniform mat4 vp;
void main() { gl_Position = vp * vec4(position / 256.0, 1.0); }
`;

const depthFragment = `#version 300 es
precision mediump float;
void main() {}
`;

const pulseVertex = `#version 300 es
uniform mat4 vp;
uniform float progress;
out float strength;
void main() {
  float tail = float(gl_VertexID) / 52.0;
  float a = 2.583 + (progress - tail * 0.17) * 6.2831853;
  gl_Position = vp * vec4(cos(a) * 33.0, sin(a) * 33.0, 2.69, 1.0);
  gl_PointSize = mix(2.0, 15.0, pow(1.0 - tail, 2.0));
  strength = (1.0 - tail) * 0.84;
}
`;

const pulseFragment = `#version 300 es
precision mediump float;
in float strength;
out vec4 outColor;
void main() {
  float r = length(gl_PointCoord - vec2(0.5)) * 2.0;
  outColor = vec4(mix(vec3(0.12,0.75,0.92), vec3(0.94,0.99,1.0), max(0.0, 1.0 - r)), strength * max(0.0, 1.0 - r));
}`;

function program(gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) {
  const result = gl.createProgram()!;
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader) ?? 'Shader compilation failed');
    gl.attachShader(result, shader);
    gl.deleteShader(shader);
  }
  gl.linkProgram(result);
  if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(result) ?? 'Shader linking failed');
  return result;
}

export async function loadHallMesh(url: string, signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok || !response.body) throw Error('Could not load accelerator model');
  const unpacked = response.body.pipeThrough(new DecompressionStream('gzip'));
  const buffer = await new Response(unpacked).arrayBuffer();
  const last = geometry.groups.at(-1)!;
  if (buffer.byteLength !== (last[0] + last[1]) * stride) throw Error('Accelerator geometry is incomplete');
  return buffer;
}

export function createHallRenderer(canvas: HTMLCanvasElement, mesh: ArrayBuffer) {
  const context = canvas.getContext('webgl2', { alpha: false, antialias: true });
  if (!context) throw Error('WebGL2 unavailable');
  const gl = context;
  const main = program(gl, vertex, fragment), depth = program(gl, depthVertex, depthFragment);
  const pulse = program(gl, pulseVertex, pulseFragment);
  const array = gl.createVertexArray(), buffer = gl.createBuffer();
  gl.bindVertexArray(array);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW);
  for (const [index, type, normalized, offset] of [
    [0, gl.SHORT, false, 0], [1, gl.BYTE, true, 6], [2, gl.UNSIGNED_BYTE, true, 9], [3, gl.UNSIGNED_BYTE, true, 12],
  ] as const) {
    gl.enableVertexAttribArray(index);
    gl.vertexAttribPointer(index, 3, type, normalized, stride, offset);
  }

  const shadow = gl.createTexture(), shadowTarget = gl.createFramebuffer();
  gl.bindTexture(gl.TEXTURE_2D, shadow);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, shadowSize, shadowSize, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowTarget);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, shadow, 0);
  gl.drawBuffers([gl.NONE]);
  gl.readBuffer(gl.NONE);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw Error('Could not allocate hall shadows');
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.enable(gl.DEPTH_TEST);
  const sunVP = multiply(
    new Float32Array([1 / 61, 0, 0, 0, 0, 1 / 61, 0, 0, 0, 0, -2 / 157, 0, 0, 0, -1.025, 1]),
    lookAt([23, -30, 90], [0, 0, 0]),
  );
  const uniforms = (p: WebGLProgram, names: string[]) => Object.fromEntries(names.map(name => [name, gl.getUniformLocation(p, name)]));
  const mu = uniforms(main, ['vp', 'sunVP', 'eye', 'indoors', 'lift', 'depthMap']);
  const du = uniforms(depth, ['vp']);
  const pu = uniforms(pulse, ['vp', 'progress']);
  let shadowBuilt = -1;

  function drawGroup(index: number) {
    const [start, count] = geometry.groups[index];
    gl.drawArrays(gl.TRIANGLES, start, count);
  }

  function draw({ camera, built, raised, beam }: HallFrame) {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    if (!width || !height) return [];
    const density = Math.min(globalThis.devicePixelRatio, 1.5, 1620 / width);
    const pixelWidth = Math.floor(width * density), pixelHeight = Math.floor(height * density);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const { eye, vp } = cameraMatrices(camera, width / height);
    const indoors = camera.view === 'aisle';
    gl.bindVertexArray(array);
    if (shadowBuilt !== built) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, shadowTarget);
      gl.viewport(0, 0, shadowSize, shadowSize);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.useProgram(depth);
      gl.uniformMatrix4fv(du.vp, false, sunVP);
      drawGroup(0);
      for (let i = 0; i < built; i++) drawGroup(i + 2);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      shadowBuilt = built;
    }

    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.clearColor(.19, .23, .26, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(main);
    gl.uniformMatrix4fv(mu.vp, false, vp);
    gl.uniformMatrix4fv(mu.sunVP, false, sunVP);
    gl.uniform3f(mu.eye, ...eye);
    gl.uniform1i(mu.indoors, indoors ? 1 : 0);
    gl.uniform1i(mu.depthMap, 0);
    gl.uniform1f(mu.lift, 0);
    drawGroup(0);
    if (indoors) drawGroup(1);
    for (let i = 0; i < built; i++) {
      gl.uniform1f(mu.lift, i === built - 1 ? raised : 0);
      drawGroup(i + 2);
    }
    if (beam >= 0) {
      gl.useProgram(pulse);
      gl.uniformMatrix4fv(pu.vp, false, vp);
      gl.uniform1f(pu.progress, beam);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      gl.depthMask(false);
      gl.drawArrays(gl.POINTS, 0, 52);
      gl.depthMask(true);
      gl.disable(gl.BLEND);
    }
    return geometry.anchors.map(anchor => project(vp, anchor));
  }

  return { draw, dispose: () => {
    gl.deleteVertexArray(array); gl.deleteBuffer(buffer); gl.deleteFramebuffer(shadowTarget); gl.deleteTexture(shadow);
    gl.deleteProgram(main); gl.deleteProgram(depth); gl.deleteProgram(pulse);
  } };
}
