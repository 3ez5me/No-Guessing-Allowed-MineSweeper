export const bitToOffset = (b: number) => Math.sign(((b & 7) - 3) & -5);
export const bitToOffsetPair = (b: number): [number, number] => [bitToOffset(b), bitToOffset(b + 2)];
export const offsetPairToBit = (dr: number, dc: number) =>
  ((Math.abs(3 * dr - dc) + 2) & 3) + ((Math.sign(3 * dr - dc) + 1) << 1);
