import StateMachine from "../../lib/state.ts";
import Board from "../board/Board";
import HistoryNode from "../history/HistoryNode";
import { BoardAction } from "../history/actions";
import Cursor from "../Cursor";
import type { Initialize, Expand } from "../maps/types";
import type { GameAction, SecondaryAction } from "../history/types";
import type { GameEvents, GameStates } from "./types.d.ts";

export default class Game {
  #currNode;
  state: StateMachine<GameEvents, GameStates>;
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
    this.board.emitter.on("action", (action: GameAction) => this.state.emit("action", action));

    // history
    this.root = new HistoryNode(this.cursors.primary, new BoardAction(null, this.board));
    this.#currNode = this.root;

    this.lastActionTick = 0;
    this.currentTick = 0;

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
    this.board.emitter.on("action", action => this.state.emit("action", action));

    // history
    this.root = new HistoryNode(this.cursors.primary, new BoardAction(null, this.board));
    this.currNode = this.root;

    this.lastActionTick = 0;
    this.currentTick = 0;

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

