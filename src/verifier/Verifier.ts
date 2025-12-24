import { circularIndex, neighborhood, p, reverseByte, rotateByteRight } from "../../lib/utils";
import { MASKS, BYTE_SET } from "./constants";
import { FilterCombinationsAction, UpdateCellAction } from "./actions";
import combinations from "./combinations";
import { bitToOffsetPair, offsetPairToBit } from "./helpers";
import Pairs from "./pairs";

export default class Verifier {
  rows: number;
  cols: number;
  size: number;
  attempts: number;
  lastEpoch: number;
  grid: Uint8Array<ArrayBuffer>;
  mineCounts: Uint16Array<ArrayBuffer>;
  safeCounts: Uint16Array<ArrayBuffer>;
  failures: Float32Array<ArrayBuffer>;
  neighborsMap: number[][];
  combinations: Uint8Array<ArrayBuffer>[];
  actionStack: (FilterCombinationsAction | UpdateCellAction)[];
  constructor(rows: number, cols: number) {
    const size = rows * cols;
    this.rows = rows;
    this.cols = cols;
    this.size = size;
    this.attempts = 0;
    this.lastEpoch = 0;
    this.grid = new Uint8Array(size);
    this.mineCounts = new Uint16Array(size);
    this.safeCounts = new Uint16Array(size);
    this.failures = new Float32Array(size).fill(1);
    this.neighborsMap = Array.from({ length: size }, (_, i) => neighborhood(rows, cols, i));
    this.combinations = Array.from({ length: size }, () => Uint8Array.from(combinations[0]));
    this.actionStack = [];
  }

  print() {
    p(this.toMatrix().map(r => r.join(" ")).join("\n")); // prettier-ignore
  }

  update(revealed: [number, number][], background: number[]) {
    for (let i of background) {
      this.grid[i] = MASKS.BACKGROUND;
    }

    for (let [i, value] of revealed) {
      this.grid[i] = value | MASKS.REVEALED;
      this.mineCounts[i] = 0;
      this.safeCounts[i] = 0;
      this.failures[i] = 1;
    }
    const visitedCovered = new Set<number>();
    const affectedClues = new Set<number>();
    for (let [i] of revealed) {
      affectedClues.add(i);
      // Go over all covered cells around newly revealed cells
      for (let j of this.neighborhood(i)) {
        if (!this.isCovered(j) || visitedCovered.has(j)) continue;
        // Shouldn't need to reset covered cell state
        visitedCovered.add(j);

        // Get all clues / revealed cells around them (new and old)
        // This will have to re-calculate some cells, but it's less prone to bugs
        for (let k of this.neighborhood(j)) {
          if (this.isRevealed(k)) affectedClues.add(k);
        }
      }
    }

    for (let i of affectedClues) {
      let covered = 0;
      let safe = 0;
      let mines = 0;
      for (let j of this.neighborhood(i)) {
        const mask = 1 << this.neighborToBit(i, j);
        if (this.isCovered(j)) covered |= mask;
        if (this.isSafe(j)) safe |= mask;
        if (this.isMine(j)) mines |= mask;
      }
      const excluded = ~covered & BYTE_SET;
      // (c & excluded) = remove combinations which have '1' (mine) at illegal positions (revealed, background, and outside grid)
      // (c & safe || ~c & mines) = remove combinations which disagree with already known covered values (if there are any)
      const value = this.value(i);
      this.combinations[i] = combinations[value].filter(c => !(c & excluded || c & safe || ~c & mines));
    }

    // this.propagatePairs(affectedClues);
    // for (let i of affectedClues) this.justSolved(i);
    const solved = [...affectedClues].flatMap(i => this.justSolved(i));
    this.propagatePairs(affectedClues.union(this.propagateSingles(solved)[1]));

    return this;
  }

  *verify(i: number) {
    if (this.isMine(i)) return false;
    if (this.isSafe(i)) return true;
    // already known^

    // [revealed, covered]
    const [_, covered] = this.gatherRegion(i);
    while (this.actionStack.length) this.actionStack.pop(); // clear action stack

    const isGuaranteedSafe = !(this.setAndPropagate(i, true) && (yield* this.exist(covered)));

    this.restore(0);
    this.attempts = 0;
    this.lastEpoch = 0;
    // this.failures.fill(1); // could reset
    return isGuaranteedSafe;
  }

  *exist(covered: number[]): Generator<undefined, boolean, void> {
    yield;
    const candidate = this.pickCandidate(covered);
    if (candidate === -1) {
      this.updateCounts(covered);
      return true;
    }
    const breakPoint = this.actionStack.length;
    const i = covered[candidate];
    const total = this.safeCounts[i] + this.mineCounts[i];
    const pr = total ? this.safeCounts[i] / total : Math.random();
    const order = pr >= 0.5 && pr < 1 ? [false, true] : [true, false];
    if (Math.random() < 0.3) order.reverse();
    for (let isMine of order) {
      this.attempts++;
      if (this.setAndPropagate(i, isMine) && (yield* this.exist(covered))) return true;
      this.failures[i]++;
      this.restore(breakPoint);
    }
    return false;
  }

  pickCandidate(covered: number[]) {
    let suspect = -1;
    let bestScore = -1;
    const shouldUpdate = this.attempts >= this.lastEpoch + 100;
    if (shouldUpdate) this.lastEpoch = this.attempts;
    for (let i = 0; i < covered.length; i++) {
      const j = covered[i];
      if (this.isSolved(j)) continue;
      if (shouldUpdate) this.failures[j] *= 0.1;
      const total = this.safeCounts[j] + this.mineCounts[j];
      const restrictedness = total ? Math.max(this.safeCounts[j], this.mineCounts[j]) / total : 1;
      const score = restrictedness * this.failures[j];
      if (score <= bestScore) continue;
      suspect = i;
      bestScore = score;
    }
    return suspect;
  }

  setAndPropagate(i: number, isMine: boolean) {
    this.setCell(i, isMine);
    const [consistent, visited] = this.propagateSingles([i]);
    return consistent && this.propagatePairs(visited);
  }

  restore(length: number) {
    while (this.actionStack.length > length) this.actionStack.pop()!.undo(this);
  }

  propagatePairs(revealed: Set<number>) {
    const pairs = new Pairs();
    for (let i of revealed) {
      if (this.isSolved(i)) continue;
      for (let j of this.nearbyRevealedWithOverlap(i)) pairs.enqueue(i, j);
    }
    while (!pairs.isEmpty()) {
      const [i, j] = pairs.dequeue();
      if (this.isSolved(i) || this.isSolved(j)) continue;
      const li = this.combinations[i].length;
      const lj = this.combinations[j].length;
      if (!this.makePairConsistent(i, j)) return false;
      if (li === this.combinations[i].length && lj === this.combinations[j].length) continue;
      const [consistent, visited] = this.propagateSingles([...this.justSolved(i), ...this.justSolved(j)]);
      if (!consistent) return false;
      for (let v of visited) {
        if (this.isSolved(v)) continue;
        for (let u of this.nearbyRevealedWithOverlap(v)) pairs.enqueue(v, u);
      }
      for (let k of this.nearbyRevealedWithOverlap(i)) if (k !== j) pairs.enqueue(i, k);
      for (let k of this.nearbyRevealedWithOverlap(j)) if (k !== i) pairs.enqueue(j, k);
    }
    return true;
  }

  makePairConsistent(i: number, j: number) {
    const [dr, dc] = this.neighborOffset(i, j);
    const distance = Math.max(Math.abs(dr), Math.abs(dc));
    const n = circularIndex(dr, dc);
    let consistenti = true;
    let consistentj = true;
    let seena = 0;
    let seenb = 0;
    if (distance === 1) {
      const m = (n & 1) + 1;
      const start1a = ((8 | n) - m) & 7;
      const start2a = ((8 | n) + 1) & 7;
      const start1b = (n + 4 - m) & 7;
      const start2b = (n + 4 + 1) & 7;
      const mask = (m << 1) - 1;
      for (let a of this.combinations[i]) {
        seena |= 1 << ((rotateByteRight(a, start1a) & mask) | ((rotateByteRight(a, start2a) & mask) << m));
      }
      for (let b of this.combinations[j]) {
        seenb |= 1 << ((rotateByteRight(b, start2b) & mask) | ((rotateByteRight(b, start1b) & mask) << m));
      }
      if (seena === seenb) return true;
      consistenti = this.filterCombinations(i, a => {
        const bit = 1 << ((rotateByteRight(a, start1a) & mask) | ((rotateByteRight(a, start2a) & mask) << m));
        if (seenb & bit) return true;
        seena &= ~bit;
        return false;
      });
      if (!consistenti) return false;
      if (seena === seenb) return true;
      consistentj = this.filterCombinations(j, b => {
        return !!(seena & (1 << ((rotateByteRight(b, start2b) & mask) | ((rotateByteRight(b, start1b) & mask) << m))));
      });
    } else if (distance === 2) {
      const m = n & 3;
      const side = (n >> 2) << 1;
      const start = (m + 1) >> 2;
      const end = m ^ (m & (m >> 1));
      const take = end - start + 1;
      const mask = (1 << take) - 1;

      for (let a of this.combinations[i]) {
        seena |= 1 << (rotateByteRight(a, side + start) & mask);
      }
      for (let b of this.combinations[j]) {
        seenb |= 1 << (reverseByte(rotateByteRight(b, (end + side + 5) & 7)) & mask);
      }
      if (seena === seenb) return true;
      consistenti = this.filterCombinations(i, a => {
        const bit = 1 << (rotateByteRight(a, side + start) & mask);
        if (seenb & bit) return true;
        seena &= ~bit;
        return false;
      });
      if (!consistenti) return false;
      if (seena === seenb) return true;
      consistentj = this.filterCombinations(j, b => {
        return !!(seena & (1 << (reverseByte(rotateByteRight(b, (end + side + 5) & 7)) & mask)));
      });
    }

    return consistenti && consistentj;
  }

  nearbyRevealedWithOverlap(i: number) {
    const active = this.activeNeighborsByte(i);
    const [ri, ci] = this.indexToPair(i);
    const rs = Math.max(ri - 2, 0);
    const cs = Math.max(ci - 2, 0);
    const re = Math.min(ri + 2, this.rows - 1);
    const ce = Math.min(ci + 2, this.cols - 1);
    const sharedNeighbors = [];
    for (let r = rs; r <= re; r++) {
      for (let c = cs; c <= ce; c++) {
        if (r === ri && c === ci) continue;
        const j = this.pairToIndex(r, c);
        if (!this.isRevealed(j) || this.isSolved(j) || this.isBackground(j)) continue;
        const distance = Math.max(Math.abs(ri - r), Math.abs(ci - c));
        const n = circularIndex(r - ri, c - ci);
        if (distance === 1) {
          const m = (n & 1) + 1;
          const start1a = ((8 | n) - m) & 7;
          const start2a = ((8 | n) + 1) & 7;
          const mask = (m << 1) - 1;
          if ((rotateByteRight(active, start1a) | rotateByteRight(active, start2a)) & mask) sharedNeighbors.push(j);
        } else {
          const m = n & 3;
          const side = (n >> 2) << 1;
          const start = (m + 1) >> 2;
          const end = m ^ (m & (m >> 1));
          const take = end - start + 1;
          const mask = (1 << take) - 1;
          if (rotateByteRight(active, side + start) & mask) sharedNeighbors.push(j);
        }
      }
    }
    return sharedNeighbors;
  }

  propagateSingles(solved: number[]): [boolean, Set<number>] {
    const visited = new Set<number>();
    while (solved.length) {
      const revealed = new Set<number>();
      while (solved.length) {
        const i = solved.pop()!;
        for (const j of this.activeNeighbors(i)) revealed.add(j);
      }
      for (const i of revealed) {
        visited.add(i);
        let safe = 0;
        let mines = 0;
        for (const j of this.neighborhood(i)) {
          if (!this.isCovered(j) || !this.isSolved(j)) continue;
          const bit = this.neighborToBit(i, j);
          if (this.isMine(j)) mines |= 1 << bit;
          else safe |= 1 << bit;
        }
        const li = this.combinations[i].length;
        if (!this.filterCombinations(i, c => !(c & safe || ~c & mines))) return [false, visited];
        if (li !== this.combinations[i].length) solved.push(...this.justSolved(i));
      }
    }
    return [true, visited];
  }

  justSolved(i: number) {
    const [mines, safe] = this.combinationsOverlap(i);
    if (!(mines || safe)) return [];

    const solved = [];
    for (let b = 0; b < 8; b++) {
      const isMine = (mines >> b) & 1;
      const isSafe = (safe >> b) & 1;
      if (!(isMine || isSafe)) continue;
      const neighbor = this.bitToNeighbor(b, i);
      solved.push(neighbor);
      this.setCell(neighbor, !!isMine);
    }
    return solved;
  }

  combinationsOverlap(i: number): [mines: number, safe: number] {
    let unsolved = 0;
    for (let j of this.neighborhood(i)) {
      if (this.isEmpty(j)) unsolved |= 1 << this.neighborToBit(i, j);
    }

    let mines = unsolved;
    let safe = unsolved;
    for (let combination of this.combinations[i]) {
      mines &= combination;
      safe &= ~combination;
    }
    return [mines, safe];
  }

  updateCounts(covered: number[]) {
    const m = this.mineCounts;
    const s = this.safeCounts;
    for (let i of covered) this.isMine(i) ? m[i]++ : s[i]++;
  }

  filterCombinations(i: number, pred: (value: number, index: number, array: Uint8Array<ArrayBuffer>) => boolean) {
    const included = this.combinations[i].filter(pred);
    if (included.length === this.combinations[i].length) return true;
    this.actionStack.push(new FilterCombinationsAction(i, this.combinations[i]));
    this.combinations[i] = included;
    if (included.length === 1) this.setCell(i, false);
    return included.length !== 0;
  }

  setCell(i: number, isMine: boolean) {
    const prevState = this.grid[i];
    this.grid[i] |= isMine ? MASKS.SOLVED | MASKS.MINE : MASKS.SOLVED;
    this.actionStack.push(new UpdateCellAction(i, prevState));
  }

  gatherRegions(initial: number[]) {
    const visited = new Set<number>();
    const regions: [number[], number[]][] = [];
    for (let i of initial) {
      if (this.isInactive(i) || visited.has(i)) continue;
      const [revealed, covered] = this.gatherRegion(i, visited);
      if (revealed.length || covered.length) regions.push([revealed, covered]);
    }
    return regions;
  }

  gatherRegion(start: number, visited: Set<number> = new Set()): [number[], number[]] {
    const revealed = [];
    const covered = [];
    const queue = [start];
    visited.add(start);
    while (queue.length) {
      const i: number = queue.shift()!;
      if (this.isInactive(i)) continue;

      if (this.isRevealed(i)) revealed.push(i);
      else covered.push(i);

      for (const j of this.neighborhood(i)) {
        if (!this.isActiveTo(i, j) || visited.has(j)) continue;
        visited.add(j);
        queue.push(j);
      }
    }
    return [revealed, covered];
  }

  solvedCount(covered: number[]) {
    let solved = 0;
    for (const i of covered) {
      if (this.isSolved(i) || (this.safeCounts[i] && this.mineCounts[i])) solved++;
    }
    return solved;
  }

  toMatrix() {
    return Array.from({ length: this.rows }, (_, r) =>
      Array.from({ length: this.cols }, (_, c) => {
        const i = this.pairToIndex(r, c);

        if (this.isBackground(i)) return "B";
        if (this.isRevealed(i)) return this.value(i).toString();
        if (this.isMine(i)) return "M";
        if (this.isSafe(i)) return "S";
        return ".";
      })
    );
  }

  activeNeighborsByte(i: number) {
    let active = 0;
    for (let j of this.neighborhood(i)) {
      if (!this.isActiveTo(i, j)) continue;
      active |= 1 << this.neighborToBit(i, j);
    }
    return active;
  }

  activeNeighbors(i: number) {
    return this.neighborhood(i).filter(j => this.isActiveTo(i, j));
  }

  bitToNeighbor(b: number, i: number) {
    return i + this.pairToIndex(...bitToOffsetPair(b));
  }

  neighborToBit(i: number, j: number) {
    const [dr, dc] = this.neighborOffset(i, j);
    return offsetPairToBit(dr, dc);
  }

  neighborOffset(i: number, j: number): [number, number] {
    const cols = this.cols;
    const dr = Math.floor(j / cols) - Math.floor(i / cols);
    const dc = (j % cols) - (i % cols);
    return [dr, dc];
  }

  neighborhood(i: number) {
    return this.neighborsMap[i];
  }

  /** Does `i` consider `j` an active neighbor */
  isActiveTo(i: number, j: number) {
    return !this.isInactive(j) && this.isRevealed(j) !== this.isRevealed(i);
  }

  isInactive(i: number) {
    return this.isBackground(i) || this.isSolved(i);
  }

  isSafe(i: number) {
    return this.isRevealed(i) || (this.isSolved(i) && !this.isMine(i));
  }

  isCovered(i: number) {
    return !(this.isRevealed(i) || this.isBackground(i));
  }

  isRevealed(i: number) {
    return !!(this.grid[i] & MASKS.REVEALED);
  }

  isSolved(i: number) {
    return !!(this.grid[i] & MASKS.SOLVED);
  }

  isEmpty(i: number) {
    return this.grid[i] === MASKS.EMPTY;
  }

  isMine(i: number) {
    return !!(this.grid[i] & MASKS.MINE);
  }

  isBackground(i: number) {
    return !!(this.grid[i] & MASKS.BACKGROUND);
  }

  value(i: number) {
    return this.grid[i] & MASKS.NUMBER;
  }

  isOutside(i: number) {
    return i < 0 || i >= this.size;
  }

  pairToIndex(r: number, c: number) {
    return this.cols * r + c;
  }

  indexToPair(i: number): [number, number] {
    return [Math.floor(i / this.cols), i % this.cols];
  }
}

