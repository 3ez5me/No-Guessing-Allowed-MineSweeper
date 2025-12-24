import type { RevealAction } from "../history/actions";
import { findPaths } from "../history/helpers";
import type HistoryNode from "../history/HistoryNode";
import Verifier from "../verifier/Verifier";
import type Game from "./Game";

export default function* review(game: Game) {
  const end = game.currNode;
  const start = game.root;

  const { up } = findPaths(end, start);

  // 1. Clear pending
  yield* clearPending(game);

  // 2. Walk back to root
  yield* walkUp(game, up);

  // 3. review
  const isWin = yield* reviewGame(game, up);

  if (isWin) game.state.enter("win");
  else game.state.enter("loss");
}

function* reviewGame(game: Game, down: HistoryNode[]) {
  let verifier = load(game);

  for (let i = 0; i < down.length; i++) {
    // yield; // visuals?
    const treeNode = down[i];

    const actions = treeNode.edge;
    for (let j = 0; j < actions.length; j++) {
      const action = actions[j];
      while (action.tick > game.currentTick) {
        game.currentTick++;
        yield;
      }
      action.do(game);
    }

    while (treeNode.action.tick > game.currentTick) {
      game.currentTick++;
      yield;
    }
    game.currNode = treeNode;

    if (treeNode.isReveal()) {
      const isGuaranteed = yield* verifyAction(game, verifier, treeNode.action);
      if (!isGuaranteed) return false;
      const revealed: [number, number][] = treeNode.action.revealed.map(([i]) => [i, game.board.value(i)]);
      verifier.update(revealed, []);
    }

    treeNode.action.do(game);
    if (treeNode.isBoard()) verifier = load(game);
  }

  return true;
}

function* walkUp(game: Game, up: HistoryNode[]) {
  for (let i = up.length - 1; i >= 0; i--) {
    const treeNode = up[i];

    while (treeNode.action.tick < game.currentTick) {
      game.currentTick--;
      yield;
    }
    game.currNode = treeNode;
    treeNode.action.undo(game);

    const actions = treeNode.edge;
    for (let j = actions.length - 1; j >= 0; j--) {
      const action = actions[j];
      while (action.tick < game.currentTick) {
        game.currentTick--;
        yield;
      }
      action.undo(game);
    }

    game.currNode = treeNode.parent!;
  }
  // Walk up to LCA, but don't do/undo its action.
}

function* clearPending(game: Game) {
  const pending = game.pendingActions;

  while (pending.length) {
    const action = pending.pop()!;
    while (action.tick < game.currentTick) {
      game.currentTick--;
      yield;
    }
    action.undo(game);
  }
}

function load(game: Game) {
  const board = game.board;

  const revealed: [number, number][] = [];
  const background: number[] = [];

  for (let i = 0; i < board.grid.length; i++) {
    if (board.isBackground(i)) background.push(i);
    else if (board.isRevealed(i)) revealed.push([i, board.value(i)]);
  }
  const verifier = new Verifier(board.rows, board.cols).update(revealed, background);
  game.state.emit("loadVerifier", verifier);
  return verifier;
}

function* verifyAction(game: Game, verifier: Verifier, action: RevealAction) {
  const board = game.board;
  const i = action.location;
  const [r, c] = board.indexToPair(i);
  return !board.isMine(i) && (board.isOrigin(r, c) || (yield* verifier.verify(i)) || isOnlyUnreachable(game, i));
}

function isOnlyUnreachable(game: Game, i: number) {
  const board = game.board;
  if (board.coveredClues !== 1 || !board.isUnreachable(i)) return false;
  return !board.grid.some((_, j) => j !== i && board.isCovered(j) && board.isUnreachable(j));
}

