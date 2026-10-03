// Shading: what colour a point on a surface is, given its normal, the light and
// the eye. Each model here is a formula, written once in GLSL for the viewport
// and once in words for the panel. PBR is three.js's physically based material;
// the rest are built here so their code can be read and changed.
//
//   N  surface normal (unit), L  direction to the light (unit), V  direction to the eye
//   H = normalize(L + V), the half vector between them
//
//   Lambert       c = base · (ambient + max(N·L, 0) · light)
//   Blinn–Phong   Lambert + max(N·H, 0)^shininess · light · specular
//   Toon          N·L rounded down to a few bands, plus a rim where N·V is small
//   Normals       c = N · ½ + ½       (x → red, y → green, z → blue)
//   UV            c = (u, v, 0)       (where the texture's corners land)

export type ShaderModel = 'pbr' | 'lambert' | 'blinn-phong' | 'toon' | 'normals' | 'uv' | 'custom';
export const SHADER_MODELS: ShaderModel[] = ['pbr', 'lambert', 'blinn-phong', 'toon', 'normals', 'uv', 'custom'];
export type TextureName = 'none' | 'checker' | 'grid' | 'bricks' | 'wood' | 'stripes' | 'grass';
export const TEXTURES: TextureName[] = ['none', 'checker', 'grid', 'bricks', 'wood', 'stripes', 'grass'];

export const SHADER_INFO: Record<ShaderModel, { label: string; equation: string; about: string }> = {
  pbr: { label: 'PBR (three.js)', equation: 'Cook–Torrance: diffuse + D·F·G / (4 (N·L)(N·V)), with roughness and metalness', about: 'Physically based: energy is conserved, rough surfaces spread highlights, metals tint them. What glTF and Blender\'s Principled BSDF use.' },
  lambert: { label: 'Lambert', equation: 'c = base · (ambient + max(N·L, 0) · light)', about: 'Matte: brightness depends only on how squarely the light hits (the cosine law), not on where you look from.' },
  'blinn-phong': { label: 'Blinn–Phong', equation: 'c = Lambert + max(N·H, 0)^shininess · light · specular,  H = normalize(L + V)', about: 'Adds a highlight where the surface would reflect the light toward the eye. Higher shininess, smaller and sharper highlight.' },
  toon: { label: 'Toon', equation: 'd = floor(max(N·L, 0) · bands) / bands;  c = base · (ambient + d · light) + rim · (1 − N·V)⁴', about: 'Cartoon shading: the cosine is rounded to a few flat bands, and a rim light outlines the silhouette.' },
  normals: { label: 'Normals', equation: 'c = N · ½ + ½', about: 'A debugging view: each direction is a colour. Faces pointing along +x are red, +y green, +z blue.' },
  uv: { label: 'UV', equation: 'c = (u, v, 0)', about: 'Where each point lands in the texture square: black at (0, 0), red at (1, 0), green at (0, 1). Seams show as jumps in colour.' },
  custom: { label: 'Custom GLSL', equation: 'your shade(N, L, V, uv, base, light)', about: 'Write the function yourself. It gets the vectors above and returns a colour.' },
};

export const DEFAULT_CUSTOM = `// N: surface normal, L: toward the light, V: toward the eye (all unit length, world space)
// uv: texture coordinate, base: the material colour (with the texture), light: the light's colour
// Return the colour of this point.
float d = max(dot(N, L), 0.0);
vec3 H = normalize(L + V);
float s = pow(max(dot(N, H), 0.0), 40.0);
return base * (0.25 + d * light) + s * light * 0.5;`;

// ── procedural textures ───────────────────────────────────────────────────

/** An RGBA texture, `size` × `size`, drawn by a formula per pixel (repeatable, no image files). */
/** The colour (0–255 sRGB) of a procedural texture at (u, v) in the unit square: one formula per texture. */
export function texelColor(name: TextureName, u: number, v: number): [number, number, number] {
  if (name === 'checker') {
    // 8 × 8 squares; each row tinted so orientation and stretching are easy to read.
    const on = (Math.floor(u * 8) + Math.floor(v * 8)) % 2 === 0;
    const row = Math.floor(v * 8) / 7;
    return on ? [235, 235, 235] : [Math.round(40 + 180 * row), 70, Math.round(220 - 150 * row)];
  }
  if (name === 'grid') {
    const line = Math.min(Math.abs(u * 8 - Math.round(u * 8)), Math.abs(v * 8 - Math.round(v * 8))) < 0.04;
    return line ? [30, 30, 36] : [225, 228, 232];
  }
  if (name === 'bricks') {
    const rows = 8, cols = 4, ry = v * rows, row = Math.floor(ry);
    const rx = u * cols + (row % 2) * 0.5;
    const mortar = ry - row < 0.08 || rx - Math.floor(rx) < 0.04;
    // Each brick its own shade; taken modulo the 4 bricks and 8 rows, so a half brick split by the repeat keeps one shade.
    const shade = 0.85 + 0.15 * Math.sin((row % 8) * 12.9898 + (Math.floor(rx) % 4) * 78.233);
    return mortar ? [200, 196, 188] : [Math.round(168 * shade), Math.round(74 * shade), Math.round(52 * shade)];
  }
  if (name === 'wood') {
    // Rings: distance from an axis off the square, wobbled by a sine. Not periodic, so it does not tile: with a
    // texture scale above 1 the copies meet at a visible join.
    const r = Math.hypot(u - 0.5, (v - 0.5) * 0.25 + 1.2) * 24 + 0.8 * Math.sin(u * 13) + 0.4 * Math.sin(v * 31);
    const t = 0.5 + 0.5 * Math.sin(r * 2 * Math.PI);
    return [Math.round(150 + 50 * t), Math.round(98 + 35 * t), Math.round(52 + 22 * t)];
  }
  if (name === 'grass') {
    // Speckled greens: products of sines stand in for noise. Each sine turns a whole number of times across the
    // square (2π × an integer), so the pattern matches itself at the edges and tiles without a join.
    const T = 2 * Math.PI;
    const n = Math.sin(T * (15 * u + 2 * v)) * Math.sin(T * (12 * v - u)) + 0.5 * Math.sin(T * 34 * (u + v)) * Math.sin(T * 28 * (u - v));
    const t = 0.5 + 0.35 * n;
    return [Math.round(70 + 60 * t), Math.round(120 + 70 * t), Math.round(45 + 25 * t)];
  }
  if (name === 'stripes') return Math.floor(u * 10) % 2 ? [255, 159, 28] : [36, 40, 48];
  return [255, 255, 255];
}

/** An RGBA texture, `size` × `size`, drawn by a formula per pixel (repeatable, no image files). */
export function textureRGBA(name: TextureName, size = 256): Uint8Array {
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const c = texelColor(name, (x + 0.5) / size, (y + 0.5) / size), i = (y * size + x) * 4;
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  return px;
}

// ── GLSL ──────────────────────────────────────────────────────────────────

export const VERTEX_SHADER = /* glsl */ `
uniform vec2 uUvScale;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vUv;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vPosW = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * normal);
  vUv = uv * uUvScale;
  gl_Position = projectionMatrix * viewMatrix * world;
}`;

const MODEL_GLSL: Record<Exclude<ShaderModel, 'pbr' | 'custom'>, string> = {
  lambert: `float d = max(dot(N, L), 0.0);
return base * (ambient + d * light);`,
  'blinn-phong': `float d = max(dot(N, L), 0.0);
vec3 H = normalize(L + V);
float s = d > 0.0 ? pow(max(dot(N, H), 0.0), uShininess) : 0.0;
return base * (ambient + d * light) + s * light * uSpecular;`,
  toon: `float d = floor(max(dot(N, L), 0.0) * uBands) / uBands;
float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0);
return base * (ambient + d * light) + rim * 0.35 * light;`,
  normals: `return N * 0.5 + 0.5;`,
  uv: `return vec3(uv, 0.0);`,
};

/** The fragment shader for a model: the fixed frame around a `shade` function whose body is the model. */
export function fragmentShader(model: Exclude<ShaderModel, 'pbr'>, customBody = DEFAULT_CUSTOM, flat = false): string {
  const body = model === 'custom' ? customBody : MODEL_GLSL[model];
  return /* glsl */ `
uniform vec3 uBase;
uniform sampler2D uMap;
uniform float uHasMap;
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uSky;
uniform vec3 uGround;
uniform float uShininess;
uniform float uSpecular;
uniform float uBands;
uniform float uOpacity;
varying vec3 vNormalW;
varying vec3 vPosW;
varying vec2 vUv;
vec3 ambient;

vec3 shade(vec3 N, vec3 L, vec3 V, vec2 uv, vec3 base, vec3 light) {
${body.split('\n').map((l) => '  ' + l).join('\n')}
}

void main() {
  vec3 N = ${flat ? 'normalize(cross(dFdx(vPosW), dFdy(vPosW)))' : 'normalize(vNormalW)'};
  if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vPosW);
  vec3 L = normalize(uLightDir);
  ambient = mix(uGround, uSky, N.y * 0.5 + 0.5);
  vec3 base = uHasMap > 0.5 ? uBase * texture2D(uMap, vUv).rgb : uBase;
  gl_FragColor = vec4(shade(N, L, V, vUv, base, uLightColor), uOpacity);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
}
