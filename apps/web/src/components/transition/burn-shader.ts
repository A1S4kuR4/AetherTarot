export const BURN_VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const BURN_FRAGMENT_SHADER = `#version 300 es
precision highp float;

uniform sampler2D u_snapshot;
uniform float u_progress;
uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_ignition;
uniform float u_seed;

in vec2 v_uv;
out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rotation = mat2(0.80, -0.60, 0.60, 0.80);
  for (int octave = 0; octave < 4; octave++) {
    value += valueNoise(p) * amplitude;
    p = rotation * p * 2.03 + 17.17;
    amplitude *= 0.5;
  }
  return value;
}

float ridgedFbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.55;
  for (int octave = 0; octave < 3; octave++) {
    float ridge = 1.0 - abs(valueNoise(p) * 2.0 - 1.0);
    value += ridge * ridge * amplitude;
    p = p * 2.13 + vec2(11.7, 7.3);
    amplitude *= 0.48;
  }
  return value;
}

vec2 aspectCorrected(vec2 uv) {
  vec2 corrected = uv;
  corrected.x *= u_resolution.x / u_resolution.y;
  return corrected;
}

float maxCornerDistance(vec2 ignition) {
  vec2 origin = aspectCorrected(ignition);
  float d0 = distance(origin, aspectCorrected(vec2(0.0, 0.0)));
  float d1 = distance(origin, aspectCorrected(vec2(1.0, 0.0)));
  float d2 = distance(origin, aspectCorrected(vec2(0.0, 1.0)));
  float d3 = distance(origin, aspectCorrected(vec2(1.0, 1.0)));
  return max(max(d0, d1), max(d2, d3));
}

float burnThreshold(vec2 uv) {
  vec2 diff = aspectCorrected(uv) - aspectCorrected(u_ignition);
  float distanceFromOrigin = length(diff);
  float angle = atan(diff.y, diff.x);

  float broadWarp = fbm(diff * 3.1 + vec2(u_seed, u_seed * 0.37)) - 0.5;
  float fineWarp = valueNoise(diff * 13.0 + u_seed * 2.4) - 0.5;
  float crackField = ridgedFbm(vec2(angle * 1.75, distanceFromOrigin * 7.0) + u_seed);
  float crack = smoothstep(0.78, 1.18, crackField) * 0.13;
  float upwardBias = -max(diff.y, -0.25) * 0.27;

  float field = distanceFromOrigin + broadWarp * 0.23 + fineWarp * 0.055 + upwardBias - crack;
  float normalized = field / max(maxCornerDistance(u_ignition) + 0.18, 0.5);
  return clamp(normalized * 0.91, 0.0, 0.94);
}

vec3 fireGradient(float t) {
  vec3 whiteHot = vec3(1.00, 0.976, 0.961);
  vec3 gold = vec3(0.961, 0.773, 0.259);
  vec3 terracotta = vec3(0.788, 0.392, 0.259);
  vec3 ember = vec3(0.706, 0.263, 0.173);
  vec3 charred = vec3(0.165, 0.102, 0.082);

  if (t < 0.25) return mix(whiteHot, gold, t / 0.25);
  if (t < 0.50) return mix(gold, terracotta, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(terracotta, ember, (t - 0.50) / 0.25);
  return mix(ember, charred, (t - 0.75) / 0.25);
}

float risingSparks(vec2 uv, float progress) {
  vec2 sparkUv = vec2(uv.x * 54.0, (uv.y + u_time * 0.14) * 36.0);
  vec2 cell = floor(sparkUv);
  vec2 local = fract(sparkUv) - 0.5;
  float random = hash21(cell + u_seed * 19.0);
  local.x += (random - 0.5) * 0.72 + sin(u_time * 1.7 + random * 9.0) * 0.12;
  local.y += (hash21(cell + 4.2) - 0.5) * 0.55;

  float particle = smoothstep(0.10, 0.0, length(local));
  float sparse = step(0.91, random);
  float aboveOrigin = smoothstep(u_ignition.y - 0.08, u_ignition.y + 0.42, uv.y);
  float lifetime = smoothstep(0.04, 0.24, progress) * (1.0 - smoothstep(0.80, 1.0, progress));
  return particle * sparse * aboveOrigin * lifetime;
}

void main() {
  vec4 paper = texture(u_snapshot, v_uv);
  float threshold = burnThreshold(v_uv);
  float front = threshold - u_progress;

  float intact = smoothstep(-0.010, 0.014, front);
  float hotEdge = 1.0 - smoothstep(0.0, 0.030, abs(front));
  float charBand = smoothstep(0.004, 0.018, front) * (1.0 - smoothstep(0.035, 0.105, front));
  float emberShape = fbm(v_uv * 18.0 + vec2(u_seed, -u_time * 0.08));
  float emberEdge = hotEdge * mix(0.68, 1.0, emberShape);
  float sparks = risingSparks(v_uv, u_progress);

  vec3 charColor = mix(paper.rgb * 0.18, vec3(0.10, 0.055, 0.035), 0.72);
  vec3 color = mix(paper.rgb, charColor, charBand);
  color += fireGradient(clamp(abs(front) / 0.030, 0.0, 1.0)) * emberEdge * 1.18;
  color += vec3(1.0, 0.72, 0.28) * sparks;

  float alpha = max(paper.a * intact, emberEdge * 0.94);
  alpha = max(alpha, sparks * 0.88);
  fragColor = vec4(color, alpha);
}
`;
