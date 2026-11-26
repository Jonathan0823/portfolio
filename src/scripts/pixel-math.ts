export { HEAT_PALETTE } from '@/lib/palette';

export function hash(a: number, b: number, c = 0): number {
  const h = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return h - Math.floor(h);
}

export function noise(x: number, y: number): number {
  const cellX = Math.floor(x),
    cellY = Math.floor(y);
  const fracX = x - cellX,
    fracY = y - cellY;
  const smoothX = fracX * fracX * (3 - 2 * fracX),
    smoothY = fracY * fracY * (3 - 2 * fracY);
  const topLeft = hash(cellX, cellY),
    topRight = hash(cellX + 1, cellY);
  const bottomLeft = hash(cellX, cellY + 1),
    bottomRight = hash(cellX + 1, cellY + 1);
  return (
    topLeft +
    (topRight - topLeft) * smoothX +
    (bottomLeft - topLeft) * smoothY +
    (topLeft - topRight - bottomLeft + bottomRight) * smoothX * smoothY
  );
}

export function fbm(x: number, y: number): number {
  return 0.6 * noise(x, y) + 0.3 * noise(x * 2.1 + 5, y * 2.1) + 0.1 * noise(x * 4.3, y * 4.3 + 9);
}

export function bucketFor(value: number): number {
  return value < 0.46 ? 0 : value < 0.6 ? 1 : value < 0.7 ? 2 : value < 0.82 ? 3 : value < 0.94 ? 4 : 5;
}

export function heatLevel(
  cellX: number,
  cellY: number,
  distance: number,
  speedFactor: number,
  fieldTime: number,
  warmth: number,
): number {
  const base = fbm(cellX * 0.07 - fieldTime * 0.9, cellY * 0.11 + cellX * 0.03);
  const grain = hash(cellX, cellY) - 0.5;
  const value = 0.18 + 0.45 * base + 0.5 * (1 - Math.min(1, distance)) + 0.18 * speedFactor + grain * 0.18;
  return Math.min(bucketFor(value), Math.floor(warmth * 5.99));
}

export interface Field {
  width: number;
  height: number;
  cellSize: number;
  columns: number;
  rows: number;
  horizonRow: number;
  heat: Float32Array;
  bucket: Int8Array;
  lowestRow: Int16Array;
  lowestBucket: Int8Array;
  hottest: number;
}

export function createField(width: number, height: number): Field {
  const cellSize = width < 700 ? 8 : 10;
  const columns = Math.ceil(width / cellSize),
    rows = Math.ceil(height / cellSize);
  return {
    width,
    height,
    cellSize,
    columns,
    rows,
    horizonRow: Math.floor(rows * 0.68),
    heat: new Float32Array(columns * rows),
    bucket: new Int8Array(columns * rows).fill(-1),
    lowestRow: new Int16Array(columns).fill(-1),
    lowestBucket: new Int8Array(columns),
    hottest: 0,
  };
}

export function stepField(field: Field, time: number, seed: number, density = 1, decay = 0.94): void {
  const { columns, rows, horizonRow, heat, bucket, lowestRow, lowestBucket } = field;
  bucket.fill(-1);
  lowestRow.fill(-1);
  lowestBucket.fill(0);
  let hottest = 0;
  for (let x = 0; x < columns; x++) {
    const across = x / columns;
    const drip = Math.floor(
      Math.max(0, noise(x * 0.17, 3.1 + seed + time * 0.15) - 0.35) * 16 * density + hash(x, 7) * 2,
    );
    for (let y = 0; y < rows; y++) {
      const i = y * columns + x;
      heat[i] *= decay;
      hottest = Math.max(hottest, heat[i]);
      if (heat[i] < 0.3) {
        if (y >= horizonRow + drip) continue;
        if (y >= horizonRow && hash(x, y, Math.floor(time * 2) + seed) < ((y - horizonRow) / (drip + 1)) * 0.55)
          continue;
      }
      const depth = y / horizonRow;
      const base = fbm(x * 0.07 - time * 0.9 + seed, y * 0.11 + x * 0.03);
      const ridgeLine = 0.42 + 0.2 * Math.sin(across * 6.2 + time * 0.6 + seed) + 0.08 * Math.sin(across * 17 - time);
      const ridge = Math.exp(-Math.pow(depth - ridgeLine, 2) / 0.018);
      const grain = hash(x, y) - 0.5;
      const value =
        0.1 + 0.5 * base + 0.42 * ridge * density + 0.18 * density + (heat[i] < 0.3 ? heat[i] : 0) + grain * 0.2;
      if (base + grain * 0.25 < 0.36 + (1 - density) * 0.38 && ridge * density < 0.35 && heat[i] < 0.25) continue;
      const level = bucketFor(heat[i] >= 0.3 ? Math.max(value, 0.1 + heat[i] + grain * 0.1) : value);
      bucket[i] = level;
      if (y > lowestRow[x]) {
        lowestRow[x] = y;
        lowestBucket[x] = level;
      }
    }
  }
  field.hottest = hottest;
}
