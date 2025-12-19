// @ts-check
import { MASKS } from "../board/constants.js";
import type { Expand, Initialize } from "./types";

const M = MASKS.MINE;
// const B = MASKS.BACKGROUND;
const V = MASKS.REVEALED;

const init: Initialize = () => {
  return {
    board: [
      [0, 0, 0, 0, 0, 0, 0],
      [0, M, 0, 0, 0, M, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, M, 0],
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, M, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ],
    origin: [3, 3],
  };
};

const expand: Expand = () => {
  return {
    board: [
      [V, V, V, V, V, V, V, V, V, V],
      [V, V, M, V, V, V, M, V, V, V],
      [V, V, V, V, V, V, V, V, V, V],
      [V, V, V, V, V, V, M, V, V, V],
      [V, V, V, V, V, V, V, V, V, V],
      [V, V, V, V, V, M, V, V, V, V],
      [V, V, V, V, V, V, V, V, V, V],
      [V, V, V, V, V, V, V, V, V, V],
      [0, M, V, V, V, V, V, M, V, V],
      [0, 0, V, V, V, V, V, 0, V, V],
    ],
    origin: [3, 4],
  };
};

const exampleMap = { name: "example", init, expand };
export default exampleMap;

