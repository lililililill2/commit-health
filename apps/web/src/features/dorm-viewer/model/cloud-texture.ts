const WIDTH = 256;
const HEIGHT = 128;

function smoothstep(min: number, max: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

function hash(x: number, y: number, seed: number) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function noise(x: number, y: number, seed: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smoothstep(0, 1, x - ix);
  const fy = smoothstep(0, 1, y - iy);
  const bottom = hash(ix, iy, seed) * (1 - fx) + hash(ix + 1, iy, seed) * fx;
  const top = hash(ix, iy + 1, seed) * (1 - fx) + hash(ix + 1, iy + 1, seed) * fx;
  return bottom * (1 - fy) + top * fy;
}

function turbulence(x: number, y: number, seed: number) {
  let value = 0;
  let amplitude = 0.5;
  for (let octave = 0; octave < 5; octave++) {
    value += noise(x, y, seed + octave) * amplitude;
    x = x * 2.03 + 7.1;
    y = y * 2.03 - 3.7;
    amplitude *= 0.5;
  }
  return value;
}

// Deterministic, soft RGBA density: no external images, runtime randomness, or animation.
export function cloudPixels(seed: number) {
  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  for (let y = 0; y < HEIGHT; y++) {
    const v = (y + 0.5) / HEIGHT;
    for (let x = 0; x < WIDTH; x++) {
      const u = (x + 0.5) / WIDTH;
      const px = (u - 0.5) * 4.8;
      const py = (v - 0.5) * 3.2;
      const qx = px + (noise(px + 17, py, seed) - 0.5) * 0.65;
      const qy = py + (noise(px, py - 9, seed + 1) - 0.5) * 0.45;
      const body = Math.max(
        Math.exp(-((qx + 0.65) ** 2 * 0.85 + (qy + 0.1) ** 2 * 1.9)),
        0.85 * Math.exp(-((qx - 0.6) ** 2 * 1.3 + (qy - 0.15) ** 2 * 2.1)),
        0.7 * Math.exp(-((qx + 1.3) ** 2 * 2.3 + (qy + 0.35) ** 2 * 4)),
      );
      const detail = turbulence(qx * 2.1, qy * 2.1, seed);
      const density = body * (0.4 + detail);
      const edge =
        smoothstep(0, 0.14, u) *
        smoothstep(0, 0.14, 1 - u) *
        smoothstep(0, 0.16, v) *
        smoothstep(0, 0.16, 1 - v);
      const alpha = smoothstep(0.1, 0.75, density) * edge * 0.82;
      const light = Math.max(0, Math.min(1, smoothstep(-0.8, 0.7, qy) + (detail - 0.5) * 0.15));
      const offset = (y * WIDTH + x) * 4;
      data[offset] = Math.round(214 + light * 41);
      data[offset + 1] = Math.round(229 + light * 25);
      data[offset + 2] = Math.round(242 + light * 10);
      data[offset + 3] = Math.round(alpha * 255);
    }
  }
  return { data, width: WIDTH, height: HEIGHT };
}
