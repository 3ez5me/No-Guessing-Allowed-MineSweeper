import Emitter from "../../lib/eventEmitter";
import { clamp, delta, floor2D, neighborhood } from "../../lib/utils";
import { MASKS } from "./constants";
import { PressReleaseAction, RevealAction, TransformAction } from "../history/actions";

const CELL_SIZE_CHANGE = 4;
const MIN_CELL_SIZE = 16;
const MAX_CELL_SIZE = 64;
const DEFAULT_CELL_SIZE = 32;

export default class Board {
  rows: number;
  cols: number;
  size: number;
  grid: Uint8Array<ArrayBuffer>;
  origin: [number, number];
  coveredClues: number;
  emitter: Emitter;
  coords: { x: number; y: number };
  cellSize: number;
  pressing: { target: number; isPressing: boolean };
  constructor(grid: number[][], origin: [number, number]) {
    const rows = grid.length;
    const cols = grid[0].length;
    const size = rows * cols;

    this.rows = rows;
    this.cols = cols;
    this.size = size;
    this.grid = Uint8Array.from({ length: size }, (_, i) => grid[Math.floor(i / cols)][i % cols]);
    this.origin = origin;
    this.coveredClues = 0;

    this.emitter = new Emitter();
    this.coords = { x: 0, y: 0 };
    this.cellSize = DEFAULT_CELL_SIZE;
    this.pressing = {
      target: 0,
      isPressing: false,
    };

    for (let i = 0; i < this.size; i++) {
      if (!this.isClue(i)) continue;
      if (!this.isRevealed(i)) this.coveredClues++;
      this.grid[i] &= ~MASKS.VALUE;
      this.grid[i] |= this.nearbyMineCount(i);
    }
  }

  merge(container: { width: number; height: number }, prevBoard: Board) {
    const dr = this.origin[0] - prevBoard.origin[0];
    const dc = this.origin[1] - prevBoard.origin[1];
    const rows = dr + prevBoard.rows;
    const cols = dc + prevBoard.cols;

    // 1. clear all visible where old board was and adjust flags
    for (let r = dr; r < rows; r++) {
      for (let c = dc; c < cols; c++) {
        const i = this.pairToIndex(r, c);
        const j = prevBoard.pairToIndex(r - dr, c - dc);

        const wasFlagged = prevBoard.isFlagged(j);
        this.grid[i] &= ~MASKS.FLAG;
        this.grid[i] &= ~MASKS.REVEALED;
        if (this.isMine(i) && wasFlagged) this.grid[i] |= MASKS.FLAG;
      }
    }

    // 2. re-click all visible without tracking
    for (let r = dr; r < rows; r++) {
      for (let c = dc; c < cols; c++) {
        const i = this.pairToIndex(r, c);
        const j = prevBoard.pairToIndex(r - dr, c - dc);
        if (!this.isClue(i) || !prevBoard.isRevealed(j)) continue;
        this.reveal(r, c);
      }
    }

    // 3. recount covered clues
    this.coveredClues = 0;
    for (let i = 0; i < this.grid.length; i++) {
      if (this.isCoveredClue(i)) this.coveredClues++;
    }

    // 4. Move current board to position of old board
    this.cellSize = prevBoard.cellSize;
    this.coords = { ...prevBoard.coords };
    const start = this.cellToCoords(...this.origin);
    const end = this.cellToCoords(...prevBoard.origin);
    const dx = Math.floor(end.x - start.x);
    const dy = Math.floor(end.y - start.y);
    this.move(container, dx, dy);
  }

  chord(r: number, c: number) {
    const i = this.pairToIndex(r, c);
    if (this.isOutside(r, c) || !this.hasSufficientFlags(i)) return false;
    return this.neighborhood(i).some(j => this.reveal(...this.indexToPair(j)));
  }

  reveal(r: number, c: number) {
    const i = this.pairToIndex(r, c);
    if (this.isOutside(r, c) || !this.isRevealable(i)) return false;

    const revealed: [number, number][] = [[i, this.grid[i]]];

    this.revealCell(i);
    const queue = [i];
    while (queue.length) {
      const j = queue.shift()!;
      const nearbyMines = this.value(j);
      if (nearbyMines > 0) continue;
      // this.isMine(j) = grid[j] = 9

      for (let k of this.neighborhood(j)) {
        if (!this.isCoveredClue(k)) continue;

        const prevState = this.grid[k];
        revealed.push([k, prevState]);

        this.revealCell(k);
        queue.push(k);
      }
    }

    this.emitter.emit("action", new RevealAction(revealed));
    return this.isMine(i);
  }

  release() {
    if (!this.pressing.isPressing) return;

    const i = this.pressing.target;
    const cells = this.isRevealed(i) ? this.neighborhood(i) : [i];
    for (let j of cells) this.grid[j] &= ~MASKS.PRESSED;
    this.pressing.isPressing = false;

    this.emitter.emit("action", new PressReleaseAction(true, i));
  }

  press(r: number, c: number) {
    const i = this.pairToIndex(r, c);
    if (this.isOutside(r, c) || this.isFlagged(i) || this.isBackground(i)) return;
    if (this.pressing.isPressing) throw new Error("Clear pressed first");

    this.pressing.target = i;
    const cells = this.isRevealed(i) ? this.neighborhood(i) : [i];
    for (let j of cells) {
      if (!this.isRevealable(j)) continue;
      this.grid[j] |= MASKS.PRESSED;
      this.pressing.isPressing = true;
    }

    if (this.pressing.isPressing) this.emitter.emit("action", new PressReleaseAction(false, i));
  }

  zoom(container: { width: number; height: number }, coords: { x: number; y: number }, zoomIn: boolean) {
    const sizeChange = zoomIn ? CELL_SIZE_CHANGE : -CELL_SIZE_CHANGE;
    const cellSize = clamp(MIN_CELL_SIZE, MAX_CELL_SIZE, this.cellSize + sizeChange);
    if (this.cellSize === cellSize) return;

    const scaleFactor = (cellSize - this.cellSize) / this.cellSize;
    const dx = Math.round(scaleFactor * (this.coords.x - coords.x));
    const dy = Math.round(scaleFactor * (this.coords.y - coords.y));
    this.move(container, dx, dy, cellSize - this.cellSize);
  }

  move(container: { width: number; height: number }, dx: number, dy: number, dSize: number = 0) {
    const prevCoords = this.coords;
    const prevCellSize = this.cellSize;
    const height = this.rows * prevCellSize;
    const width = this.cols * prevCellSize;

    const newCoords = {
      x: Math.max(-width + 1, Math.min(container.width - 1, prevCoords.x + dx)),
      y: Math.max(-height + 1, Math.min(container.height - 1, prevCoords.y + dy)),
    };

    this.coords = newCoords;
    this.cellSize += dSize;
    this.emitter.emit("action", new TransformAction(prevCoords, prevCellSize, newCoords, this.cellSize));
  }

  center(container: { width: number; height: number }) {
    const originCoords = this.cellToCoords(...this.origin);
    originCoords.x += this.cellSize / 2;
    originCoords.y += this.cellSize / 2;
    const center = { x: container.width / 2, y: container.height / 2 };
    this.coords = floor2D(delta(originCoords, center));
  }

  restoreCell(i: number, prevState: number) {
    this.grid[i] = prevState;
    this.coveredClues++;
  }

  revealCell(i: number) {
    this.grid[i] &= ~MASKS.FLAG;
    this.grid[i] |= MASKS.REVEALED;
    if (!this.isMine(i)) this.coveredClues--;
  }

  toggleFlag(i: number) {
    this.grid[i] ^= MASKS.FLAG;
  }

  hasSufficientFlags(i: number) {
    return this.nearbyFlagCount(i) === this.value(i);
  }

  nearbyMineCount(i: number) {
    return this.neighborhood(i).reduce((a, j) => a + +this.isMine(j), 0);
  }

  nearbyFlagCount(i: number) {
    return this.neighborhood(i).reduce((a, j) => a + +this.isFlagged(j), 0);
  }

  isUnreachable(i: number) {
    return this.neighborhood(i).every(j => !this.isRevealed(j));
  }

  firstAvailableReveal(i: number) {
    if (this.isRevealable(i)) return i;
    if (!this.hasSufficientFlags(i)) return -1;
    return this.neighborhood(i).find(j => this.isRevealable(j)) ?? -1;
  }

  neighborhood(i: number) {
    return neighborhood(this.rows, this.cols, i);
  }

  isOrigin(r: number, c: number) {
    const [or, oc] = this.origin;
    return r === or && c === oc;
  }

  isCoveredClue(i: number) {
    return this.isCovered(i) && this.isClue(i);
  }

  isClue(i: number) {
    return !(this.isMine(i) || this.isBackground(i));
  }

  isRevealable(i: number) {
    return this.isCovered(i) && !this.isFlagged(i);
  }

  isCovered(i: number) {
    return !(this.isBackground(i) || this.isRevealed(i));
  }

  isMine(i: number) {
    return this.value(i) === MASKS.MINE;
  }

  isBackground(i: number) {
    return !!(this.grid[i] & MASKS.BACKGROUND);
  }

  isPressed(i: number) {
    return !!(this.grid[i] & MASKS.PRESSED);
  }

  isFlagged(i: number) {
    return !!(this.grid[i] & MASKS.FLAG);
  }

  isRevealed(i: number) {
    return !!(this.grid[i] & MASKS.REVEALED);
  }

  value(i: number) {
    return this.grid[i] & MASKS.VALUE;
  }

  isOutside(r: number, c: number) {
    return r < 0 || c < 0 || r >= this.rows || c >= this.cols;
  }

  isSolved() {
    return this.coveredClues === 0;
  }

  coordsToCell(coords: { x: number; y: number }) {
    const { x, y } = coords;
    const r = Math.floor((y - this.coords.y) / this.cellSize);
    const c = Math.floor((x - this.coords.x) / this.cellSize);
    return [r, c];
  }

  cellToCoords(r: number, c: number) {
    const x = c * this.cellSize + this.coords.x;
    const y = r * this.cellSize + this.coords.y;
    return { x, y };
  }

  cleaned() {
    return Array.from({ length: this.rows }, (_, r) => {
      return Array.from({ length: this.cols }, (_, c) => {
        return this.grid[this.pairToIndex(r, c)] & ~MASKS.FLAG & ~MASKS.PRESSED;
      });
    });
  }

  indexToPair(i: number): [number, number] {
    return [Math.floor(i / this.cols), i % this.cols];
  }

  pairToIndex(r: number, c: number) {
    return this.cols * r + c;
  }
}

