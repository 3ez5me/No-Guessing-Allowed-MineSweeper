import type { Initialize, Expand } from "../maps/types";
import type Cursor from "../Cursor";
import type { GameAction } from "../history/types";
import type { Point2D } from "../../lib/utils";
import type Game from "./Game";
import type HistoryNode from "../history/HistoryNode";
import type Verifier from "../verifier/Verifier";

export type GameStates = "playing" | "win" | "loss" | "rewinding" | "reviewing" | "releasing";

export type GameEvents = {
  update: [dt: number];
  restart: [init: Initialize, expand: Expand, seed: string, depth: number];
  preMouseEvent: [prev: Cursor, curr: Cursor]; // Use tuple for [data]
  mouseMove: [prev: Cursor, curr: Cursor];
  wheel: [cursor: Cursor, dy: number];
  leftUp: [cursor: Cursor];
  leftDown: [cursor: Cursor];
  rightDown: [cursor: Cursor];
  rightUp: [cursor: Cursor];
  middleDown: [cursor: Cursor];
  middleUp: [cursor: Cursor];
  releasing: [];
  review: [];
  rewind: [start: HistoryNode, end: HistoryNode];
  currNodeChange: [start: HistoryNode, end: HistoryNode];
  loadVerifier: [verifier: Verifier];
  hover: [node: HistoryNode];
  hoverStop: [node: HistoryNode];
  action: [action: GameAction];
};

