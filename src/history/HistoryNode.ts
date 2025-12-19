import { pathFromRoot } from "./helpers";
import { BoardAction, RevealAction } from "./actions";
import type Board from "../board/Board.js";
import type Cursor from "../Cursor";
import type { SecondaryAction, TreeNode, TreeNodeAction } from "./types";

type AnyHistoryNode = HistoryNode<BoardAction> | HistoryNode<RevealAction>;

export default class HistoryNode<A extends TreeNodeAction = TreeNodeAction> implements TreeNode<HistoryNode> {
  action: A;
  cursor: Cursor;
  edge: SecondaryAction[];
  parent: HistoryNode | null;
  children: HistoryNode[];
  constructor(cursor: Cursor, action: A, edge: SecondaryAction[] = [], parent: HistoryNode | null = null) {
    this.cursor = cursor.clone();
    this.action = action;
    this.edge = edge;
    this.parent = parent;
    this.children = [];
  }

  history() {
    const path = pathFromRoot(this as HistoryNode) as AnyHistoryNode[];
    let board: Board;
    const history: { board: number[][]; origin: [number, number]; reveals: [number, number][] }[] = [];

    for (let node of path) {
      if (node.isReveal()) {
        const [ar, ac] = board!.indexToPair(node.action.location);
        const [or, oc] = board!.origin;
        history.at(-1)!.reveals.push([ar - or, ac - oc]);
      } else if (node.isBoard()) {
        board = node.action.curr;
        const origin: [number, number] = [...board.origin];
        const cleaned = board.cleaned();
        history.push({ board: cleaned, origin, reveals: [] });
      }
    }

    return history;
  }

  revealOrder() {
    const path = pathFromRoot(this as HistoryNode) as AnyHistoryNode[];

    const reveals: [number, number][] = [];
    let board: Board;

    for (let node of path) {
      if (node.isReveal()) {
        const [ar, ac] = board!.indexToPair(node.action.location);
        const [or, oc] = board!.origin;
        reveals.push([ar - or, ac - oc]);
      } else {
        board = node.action.curr;
      }
    }

    return reveals;
  }

  add(node: HistoryNode) {
    this.children.push(node);
    if (!node.parent) node.parent = this;
    return node;
  }

  getRevealAt(location: number) {
    return this.children.find(
      (node): node is HistoryNode<RevealAction> => node.isReveal() && node.action.location === location
    );
  }

  hasRevealAt(location: number) {
    return this.children.some(
      (node): node is HistoryNode<RevealAction> => node.isReveal() && node.action.location === location
    );
  }

  isFinal() {
    return this.children.length === 1 && this.children[0].isBoard();
  }

  isReveal(): this is HistoryNode<RevealAction> {
    return this.action instanceof RevealAction;
  }

  isBoard(): this is HistoryNode<BoardAction> {
    return this.action instanceof BoardAction;
  }
}

