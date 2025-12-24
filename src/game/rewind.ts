import type { BoardAction } from "../history/actions";
import { findPaths } from "../history/helpers";
import type HistoryNode from "../history/HistoryNode";
import type Game from "./Game";

export default function* rewind(game: Game, start: HistoryNode, end: HistoryNode) {
  const { up, down } = findPaths(start, end);

  // 1. Undo and flush uncommited pending actions
  yield* clearPending(game);

  // 2. Undo up path
  yield* walkUp(game, up);

  // 3. Do down path
  yield* walkDown(game, down);

  // 4. Fall through from final reveals and completed boards
  restoreProgress(game);

  // game.cursors.secondary = end.cursor;
  // game.currNode = end;
  // 5. enter waiting for cursor
  game.state.enter("releasing");
  // end.cursor === game.currNode.cursor === secondary.cursor
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
  // Walk up to LCA, but don't do/undo its action
}

function* walkDown(game: Game, down: HistoryNode[]) {
  for (let i = 0; i < down.length; i++) {
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
    treeNode.action.do(game);
  }
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

function restoreProgress(game: Game) {
  while (game.board.isSolved() && game.currNode.isFinal()) {
    // (game.currNode.isFinal() && game.board.isSolved()) => game.currNode.children[0].action is BoardAction:
    const node = game.currNode.children[0] as HistoryNode<BoardAction>;
    node.action.do(game);
    game.currNode = node;
  }
}

