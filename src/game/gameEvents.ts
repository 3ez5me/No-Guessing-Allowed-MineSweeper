import { delta, floor2D } from "../../lib/utils";
import Board from "../board/Board";
import { BoardAction, isTreeNodeAction, CursorChangeAction, ToggleFlagAction } from "../history/actions";
import HistoryNode from "../history/HistoryNode";
import review from "./review";
import rewind from "./rewind";
import type { GameAction } from "../history/types";
import type { Point2D } from "../../lib/utils";
import type { GameStates } from "./types";
import type Game from "./Game";
const MAX_PAUSE = 50;

export default function initGameEvents(game: Game) {
  game.state.in("*").on("restart", (init, expand, seed, depth) => {
    game.restart(init, expand, seed, depth);
    game.state.enter("playing");
  });

  game.state.in("*").on("preMouseEvent", (_prev, curr) => {
    game.cursors.primary = curr;
  });
  game.state.in("playing").on("preMouseEvent", (prev, curr) => {
    game.state.emit("action", new CursorChangeAction(prev, curr));
  });

  game.state.onUpdate("playing", () => {
    if (Math.abs(game.currentTick - game.lastActionTick) < MAX_PAUSE) game.currentTick++;
  });

  game.state.in("playing").on("action", action => {
    action.tick = game.currentTick;
    game.lastActionTick = game.currentTick;
    if (isTreeNodeAction(action)) {
      const node = new HistoryNode(game.cursors.primary, action, game.pendingActions);
      game.pendingActions = [];
      game.currNode = game.currNode.add(node);
    } else {
      game.pendingActions.push(action);
    }
  });

  game.state.in("playing").on("mouseMove", (prev, curr) => {
    if (curr.middle) move(game, prev, curr);
    else if (curr.left) press(game, curr);
  });

  game.state.in("playing").on("wheel", (cursor, dy) => {
    game.board.zoom(game.container, cursor, dy < 0);
  });

  game.state.in("playing").on("leftUp", cursor => {
    const board = game.board;
    const [r, c] = board.coordsToCell(cursor);
    const i = board.pairToIndex(r, c);
    if (board.isOutside(r, c) || board.isFlagged(i) || board.isBackground(i)) return;
    board.release();
    reveal(game, r, c);
  });

  game.state.in("playing").on("leftDown", cursor => press(game, cursor));

  game.state.in("playing").on("rightDown", cursor => {
    const [r, c] = game.board.coordsToCell(cursor);
    if (game.board.isOutside(r, c)) return;
    if (game.isAtRoot()) return; // ignore right clicks at the beginning

    const i = game.board.pairToIndex(r, c);
    if (!game.board.isCovered(i)) return;

    game.board.release();
    game.board.toggleFlag(i);
    game.state.emit("action", new ToggleFlagAction(i));

    if (cursor.left) game.board.press(r, c);
  });

  game.state.onEnter("releasing", attemptRelease);
  game.state.in("releasing").on("preMouseEvent", attemptRelease);

  function attemptRelease() {
    if (canUnlock(game)) game.state.enter("playing");
  }

  game.state.in("playing").on("review", () => controlled(game, "reviewing", review(game)));
  game.state.in("playing").on("rewind", (start, end) => controlled(game, "rewinding", rewind(game, start, end)));
}

export async function controlled(game: Game, state: GameStates, gen: Generator | AsyncGenerator) {
  await game.state.enter(state);
  let finished = false;
  function cleanup() {
    if (finished) return;
    finished = true;
    offUpdate();
    offExit();
  }
  const offUpdate = game.state.onUpdate(state, async () => {
    if ((await gen.next()).done) cleanup();
  });
  const offExit = game.state.onExit(state, cleanup);
}

function reveal(game: Game, r: number, c: number) {
  // Assumed: !isOutside(r, c) && !isFlagged(i) && !isBackground(i)

  const i = game.board.pairToIndex(r, c);
  const j = game.board.firstAvailableReveal(i);
  if (j === -1) return; // No revealable cells in 9x9 or not enough flags at `i`

  // If the reveal already exists on currNode then:
  //   If `i` was a revealable cell then j === i
  //   If `i` was a chord then `j` will be the first neighbor that can be revealed
  if (game.currNode.hasRevealAt(j)) {
    // enter rewinding
    game.state.emit("rewind", game.currNode, game.currNode.getRevealAt(j)!);
    return;
  }

  if (game.isAtRoot() && !game.board.isOrigin(r, c)) return; // stay in playing

  const hitMine = game.board.isRevealed(i) ? game.board.chord(r, c) : game.board.reveal(r, c);
  if (hitMine) {
    game.state.enter("loss");
    return;
  }

  progress(game);
  if (game.board.isSolved() && !game.expansions) game.state.emit("review");
}

function press(game: Game, coords: Point2D) {
  const [r, c] = game.board.coordsToCell(coords);
  const { isPressing, target } = game.board.pressing;
  const [pr, pc] = game.board.indexToPair(target);
  const isSameLocation = r === pr && c === pc;
  if (isPressing && isSameLocation) return;

  game.board.release();
  if (game.isAtRoot() && !game.board.isOrigin(r, c)) return;
  game.board.press(r, c);
}

function move(game: Game, prev: Point2D, curr: Point2D) {
  const d = floor2D(delta(prev, curr));
  game.board.move(game.container, d.x, d.y);
}

function progress(game: Game) {
  while (game.board.isSolved() && game.expansions) {
    const prevBoard = game.board;
    const history = game.currNode.history();
    const expansion = game.expand(game.seed, history);
    const newBoard = new Board(expansion.board, expansion.origin);
    newBoard.merge(game.container, prevBoard);
    newBoard.emitter.on("action", (action: GameAction) => game.state.emit("action", action));

    game.state.emit("action", new BoardAction(prevBoard, newBoard));
    game.currNode.action.do(game);
  }
}

function canUnlock(game: Game) {
  if (game.isAtRoot()) return true;
  const closeEnough = 4;
  const dist = game.board.cellSize / closeEnough;
  const current = game.cursors.primary;
  const final = game.currNode.cursor;
  const d = delta(current, final);
  return final.sameButtons(current) && Math.hypot(d.x, d.y) <= dist;
}

