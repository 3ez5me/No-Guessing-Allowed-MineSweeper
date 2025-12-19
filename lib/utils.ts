const LEFT = 1;
const RIGHT = 2;
const MIDDLE = 4;

export const isLeftPressed = (e: MouseEvent): boolean => Boolean(e.buttons & LEFT);

export const isMiddlePressed = (e: MouseEvent): boolean => Boolean(e.buttons & MIDDLE);

export const isRightPressed = (e: MouseEvent): boolean => Boolean(e.buttons & RIGHT);

export const p = <T>(x: T): T => (console.log(x), x);

export const wait = async (ms: number) => new Promise(res => setTimeout(res, ms));

export const pn = (n: number) => n.toString().padStart(2, " ");

export const clamp = (min: number, max: number, num: number) => Math.max(Math.min(num, max), min);

export const randomString = (chars: string, length: number) =>
  Array.from({ length }, () => chars[randomInt(chars.length)]).join("");

export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i >= 0; i--) {
    const j = randomInt(i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const randomInt = (n: number) => Math.floor(Math.random() * n);

export function bitCount(n: number) {
  n -= (n >> 1) & 0x55555555;
  n = (n & 0x33333333) + ((n >> 2) & 0x33333333);
  return (((n + (n >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
}

export const rotateByteLeft = (x: number, n: number) => ((x << n) | (x >>> (8 - n))) & 0xff;

export const rotateByteRight = (x: number, n: number) => ((x >> n) | (x << (8 - n))) & 0xff;

export function reverseByte(b: number) {
  b = ((b >> 1) & 0x55) | ((b & 0x55) << 1);
  b = ((b >> 2) & 0x33) | ((b & 0x33) << 2);
  return ((b >> 4) & 0xf) | ((b & 0xf) << 4);
}

export type Point2D = { x: number; y: number };

const map2D =
  (f: (p1: number) => number) =>
  (p1: Point2D): Point2D => ({ x: f(p1.x), y: f(p1.y) });

const map2DPairwise =
  (f: (n: number, m: number) => number) =>
  (p1: Point2D, p2: Point2D): Point2D => ({ x: f(p2.x, p1.x), y: f(p2.y, p1.y) });

export const floor2D = map2D(Math.floor);
export const delta = map2DPairwise((n, m) => n - m);
export const max2D = map2DPairwise(Math.max);
export const min2D = map2DPairwise(Math.min);

export function circularIndex(dr: number, dc: number) {
  const d = Math.max(Math.abs(dr), Math.abs(dc));
  return d * (dr - dc) + dr > 0 ? 6 * d - (dr + dc) : 2 * d + dr + dc;
}

export function neighborhood(rows: number, cols: number, i: number) {
  const row = Math.floor(i / cols);
  const size = rows * cols;
  const dRow = [-1, -1, -1, 0, 1, 1, 1, 0];
  const dCol = [-1, 0, 1, 1, 1, 0, -1, -1];
  const neighbors = [];
  for (let b = 0; b < 8; b++) {
    const dr = dRow[b];
    const dc = dCol[b];
    const j = i + cols * dr + dc;
    if (Math.floor(j / cols) === row + dr && j >= 0 && j < size) neighbors.push(j);
  }
  return neighbors;
}

