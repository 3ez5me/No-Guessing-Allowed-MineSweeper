import type { BoardAction, RevealAction } from "./actions";
import type { PressReleaseAction, ToggleFlagAction, TransformAction, CursorChangeAction } from "./actions";
export interface TreeNode<T extends TreeNode<T>> {
  children: T[];
  parent: T | null;
}

export type SecondaryAction = PressReleaseAction | ToggleFlagAction | TransformAction | CursorChangeAction;
export type TreeNodeAction = BoardAction | RevealAction;
export type GameAction = SecondaryAction | TreeNodeAction;

