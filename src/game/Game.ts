import StateMachine from "../../lib/state";
import Board from "../board/Board";
import HistoryNode from "../history/HistoryNode";
import { BoardAction } from "../history/actions";
import Cursor from "../Cursor";
import type { Initialize, Expand } from "../maps/types";
import type { GameAction, SecondaryAction } from "../history/types";

export default class Game {
  #currNode;
  state: StateMachine;
  container: { width: number; height: number };
  seed: string;
  expansions: number;
  init: Initialize;
  expand: Expand;
  cursors: { primary: Cursor; secondary: Cursor };
  board: Board;
  root: HistoryNode;
  lastActionTick: number;
  currentTick: number;
  pendingActions: SecondaryAction[];

  constructor(
    init: Initialize,
    expand: Expand,
    seed: string,
    depth: number,
    container: { width: number; height: number }
  ) {
    this.state = new StateMachine("playing", ["playing", "win", "loss", "rewinding", "reviewing", "releasing"]);
    this.container = container;
    this.seed = seed;
    this.expansions = depth;

    this.init = init;
    this.expand = expand;

    // primary -> player
    // secondary -> replay/controlled
    this.cursors = {
      primary: new Cursor(0, 0, false, false, false),
      secondary: new Cursor(0, 0, false, false, false),
    };
    const { board, origin } = this.init(seed);
    this.board = new Board(board, origin);
    this.board.center(this.container);
    this.board.emitter.on("action", (/** @type {GameAction}*/ action: GameAction) => this.state.emit("action", action));

    // history
    this.root = new HistoryNode(this.cursors.primary, new BoardAction(null, this.board));
    this.#currNode = this.root;

    this.lastActionTick = 0;
    this.currentTick = 0;

    /** @type {SecondaryAction[]} */
    this.pendingActions = [];
  }

  restart(init: Initialize, expand: Expand, seed: string, depth: number) {
    this.init = init;
    this.expand = expand;
    this.seed = seed;
    this.expansions = depth;

    const { board, origin } = this.init(seed);
    this.board = new Board(board, origin);
    this.board.center(this.container);
    this.board.emitter.on("action", (/** @type {GameAction}*/ action: GameAction) => this.state.emit("action", action));

    // history
    this.root = new HistoryNode(this.cursors.primary, new BoardAction(null, this.board));
    this.currNode = this.root;

    this.lastActionTick = 0;
    this.currentTick = 0;

    /** @type {SecondaryAction[]} */
    this.pendingActions = [];
  }

  isAtRoot() {
    return this.#currNode === this.root;
  }

  set currNode(node: HistoryNode) {
    this.#currNode = node;
    this.currentTick = node.action.tick; // not needed?
    this.cursors.secondary = node.cursor.clone();
    this.lastActionTick = node.action.tick;
    this.state.emit("currNodeChange", this.root, node); // notify history tree
  }

  get currNode() {
    return this.#currNode;
  }
}

// Might have to change the emitter to not be async as it could add actions at wrong times

// I am cloning a lot of cursors

// Maybe check if node already exists in children of current node
// Only redraw if it doesn't, highlight if it does
// this.emit("currNodeChange", root, currNode);
// re-draw tree if need be
// change active node

