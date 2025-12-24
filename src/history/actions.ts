import type Board from "../board/Board";
import type Cursor from "../Cursor";
import type Game from "../game/Game";
import type { GameAction, TreeNodeAction } from "./types";

export function isTreeNodeAction(action: GameAction): action is TreeNodeAction {
  return action instanceof RevealAction || action instanceof BoardAction;
}

export class ToggleFlagAction {
  tick: number;
  location: number;
  constructor(location: number) {
    this.tick = 0;
    this.location = location;
  }

  do(game: Game) {
    game.lastActionTick = this.tick;
    const i = this.location;
    game.board.toggleFlag(i);
  }

  undo(game: Game) {
    game.lastActionTick = this.tick;
    this.do(game);
  }
}

export class PressReleaseAction {
  tick: number;
  target: number;
  isRelease: boolean;
  constructor(isRelease: boolean, target: number) {
    this.tick = 0;
    this.target = target;
    this.isRelease = isRelease;
  }

  do(game: Game) {
    game.lastActionTick = this.tick;
    if (this.isRelease) game.board.release();
    else game.board.press(...game.board.indexToPair(this.target));
  }

  undo(game: Game) {
    game.lastActionTick = this.tick;
    if (this.isRelease) game.board.press(...game.board.indexToPair(this.target));
    else game.board.release();
  }
}

export class TransformAction {
  tick: number;
  prevCoords: { x: number; y: number };
  nextCoords: { x: number; y: number };
  prevCellSize: number;
  nextCellSize: number;

  constructor(
    prevCoords: { x: number; y: number },
    prevCellSize: number,
    nextCoords: { x: number; y: number },
    nextCellSize: number
  ) {
    this.tick = 0;
    this.prevCoords = { ...prevCoords };
    this.nextCoords = { ...nextCoords };
    this.prevCellSize = prevCellSize;
    this.nextCellSize = nextCellSize;
  }

  do(game: Game) {
    game.lastActionTick = this.tick;
    game.board.coords = { ...this.nextCoords };
    game.board.cellSize = this.nextCellSize;
  }

  undo(game: Game) {
    game.lastActionTick = this.tick;
    game.board.coords = { ...this.prevCoords };
    game.board.cellSize = this.prevCellSize;
  }
}

export class CursorChangeAction {
  tick: number;
  prev: Cursor;
  curr: Cursor;

  constructor(prev: Cursor, curr: Cursor) {
    this.tick = 0;
    this.prev = prev.clone();
    this.curr = curr.clone();
  }

  do(game: Game) {
    game.lastActionTick = this.tick;
    game.cursors.secondary = this.curr.clone();
  }

  undo(game: Game) {
    game.lastActionTick = this.tick;
    game.cursors.secondary = this.prev.clone();
  }
}

export class RevealAction {
  tick: number;
  revealed: [number, number][];

  constructor(revealed: [number, number][]) {
    this.tick = 0;
    this.revealed = revealed;
    // this.location = location;
    // location technically is just revealed[0][0]
  }

  do(game: Game) {
    game.lastActionTick = this.tick;
    for (let [i, _] of this.revealed) game.board.revealCell(i);
  }

  undo(game: Game) {
    game.lastActionTick = this.tick;
    for (let [i, prevState] of this.revealed) game.board.restoreCell(i, prevState);
  }

  get location() {
    return this.revealed[0][0];
  }
}

export class BoardAction {
  tick: number;
  prev: null | Board;
  curr: Board;
  constructor(prev: null | Board, curr: Board) {
    this.tick = 0;
    this.prev = prev;
    this.curr = curr;
  }

  do(game: Game) {
    game.lastActionTick = this.tick;
    game.board = this.curr;
    game.expansions -= 1;
  }

  undo(game: Game) {
    game.lastActionTick = this.tick;
    if (!this.prev) throw new Error("Can't undo initial board!");
    game.board = this.prev;
    game.expansions += 1;
  }
}

