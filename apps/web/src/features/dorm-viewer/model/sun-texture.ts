const SIZE = 256;

function smoothstep(min: number, max: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return t * t * (3 - 2 * t);
}

export function sunPixels() {
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const dx = ((x + 0.5) / SIZE - 0.5) * 2;
      const dy = ((y + 0.5) / SIZE - 0.5) * 2;
      const radiusSquared = dx * dx + dy * dy;
      const radius = Math.sqrt(radiusSquared);
      const disc = 1 - smoothstep(0.06, 0.075, radius);
      const halo =
        (0.18 * Math.exp(-radiusSquared * 13) + 0.025 * Math.exp(-radiusSquared * 3.2)) *
        (1 - smoothstep(0.75, 1, radius));
      const offset = (y * SIZE + x) * 4;
      data[offset] = 255;
      data[offset + 1] = Math.round(236 + disc * 18);
      data[offset + 2] = Math.round(193 + disc * 55);
      data[offset + 3] = Math.round((disc + (1 - disc) * halo) * 255);
    }
  }
  return { data, width: SIZE, height: SIZE };
}
