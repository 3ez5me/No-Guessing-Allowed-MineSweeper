import { MASKS } from "../board/constants.js";
import type { Expand, Initialize } from "./types.d.ts";

const M = MASKS.MINE;
const B = MASKS.BACKGROUND;

const n = 6;
const ROOM_SIZE = 2 * n + 1;
// const MINE_PROB = 0.1;
const MINE_PROB = 0.18;
// const MINE_PROB = 0.25;
const CENTER = Math.floor(ROOM_SIZE / 2);

// easy   - 9x9 tile grid with 10 mines (density = 12.346%)
// medium - 16x16 tile grid with 40 mines (density = 15.625%)
// hard   - 16x30 tile grid with 99 mines (density = 20.625%)

/** @param {string} seed */
function freeEntropy(seed: string) {
  let p = 911; // for you, not for me
  for (let i = 0; i < seed.length; i++) p = (p * 31) ^ seed.charCodeAt(i);
  return function () {
    p |= 0;
    p = (p + 0x9e3779b9) | 0;
    let t = p ^ (p >>> 16);
    t = Math.imul(t, 0x21f0aaad);
    t = t ^ (t >>> 15);
    t = Math.imul(t, 0x735a2d97);
    return ((t = t ^ (t >>> 15)) >>> 0) / 4294967296;
  };
}

const init: Initialize = seed => {
  const prob = freeEntropy(seed);
  const board = Array.from({ length: ROOM_SIZE }, () => new Array(ROOM_SIZE).fill(B));

  // Create central room
  for (let i = 1; i < ROOM_SIZE - 1; i++) {
    const isCenterRows = i >= CENTER - 1 && i <= CENTER + 1;
    for (let j = 1; j < ROOM_SIZE - 1; j++) {
      const isCenterCols = j >= CENTER - 1 && j <= CENTER + 1;
      // || -> +
      // && -> [3x3]
      // idk which is better
      board[i][j] = !(isCenterRows && isCenterCols) && prob() < MINE_PROB ? M : 0;
    }
  }

  board[0][CENTER] = 0;
  board[CENTER][0] = 0;
  board[board.length - 1][CENTER] = 0;
  board[CENTER][board[0].length - 1] = 0;
  return {
    board,
    origin: [CENTER, CENTER],
  };
};

const expand: Expand = (seed, history) => {
  const reveals = history.flatMap(v => v.reveals);
  const prob = freeEntropy(seed + history.length + reveals.map(([r, c]) => `(${r},${c})`).join(""));

  const prev = history[history.length - 1];
  const prevRoomsR = Math.floor(prev.board.length / ROOM_SIZE);
  const prevRoomsC = Math.floor(prev.board[0].length / ROOM_SIZE);
  const rooms = Array.from({ length: prevRoomsR }, () => Array(prevRoomsC).fill(0));

  for (let i = 0; i < rooms.length; i++) {
    for (let j = 0; j < rooms[0].length; j++) {
      rooms[i][j] = prev.board[i * ROOM_SIZE + CENTER][j * ROOM_SIZE + CENTER] !== B;
    }
  }

  const lastReveal = reveals.at(-1)!.map((d, i) => d + prev.origin[i]);
  const lastRoom = lastReveal.map(d => Math.floor(d / ROOM_SIZE));
  const lastRevealLocal = lastReveal.map(d => d % ROOM_SIZE);

  const doors = [
    [0, CENTER], // top
    [CENTER, ROOM_SIZE - 1], // right
    [ROOM_SIZE - 1, CENTER], // bottom
    [CENTER, 0], // left
  ];
  const travelDir = [
    [-1, 0],
    [0, 1],
    [1, 0],
    [0, -1],
  ];

  let best = travelDir[0];
  let bestDoor = doors[0];
  for (let [i, door] of doors.entries()) {
    const d1 = Math.hypot(lastRevealLocal[0] - bestDoor[0], lastRevealLocal[1] - bestDoor[1]);
    const d2 = Math.hypot(lastRevealLocal[0] - door[0], lastRevealLocal[1] - door[1]);
    if (d2 < d1) {
      best = travelDir[i];
      bestDoor = door;
    }
  }

  const newRoom = [...lastRoom];
  while (newRoom[0] >= 0 && newRoom[0] < rooms.length && newRoom[1] >= 0 && newRoom[1] < rooms[0].length) {
    if (prev.board[newRoom[0] * ROOM_SIZE + 1][newRoom[1] * ROOM_SIZE + 1] === B) break;
    newRoom[0] += best[0];
    newRoom[1] += best[1];
  }

  // size change in direction
  const dr = newRoom[0] < 0 || newRoom[0] >= rooms.length ? ROOM_SIZE : 0;
  const dc = newRoom[1] < 0 || newRoom[1] >= rooms[0].length ? ROOM_SIZE : 0;

  const sr = newRoom[0] < 0 ? ROOM_SIZE : 0;
  const sc = newRoom[1] < 0 ? ROOM_SIZE : 0;

  const rows = prev.board.length + dr;
  const cols = prev.board[0].length + dc;
  const newBoard = Array.from({ length: rows }, () => new Array(cols).fill(B));
  for (let r = 0; r < prev.board.length; r++) {
    for (let c = 0; c < prev.board[0].length; c++) {
      newBoard[r + sr][c + sc] = prev.board[r][c];
    }
  }

  if (newRoom[0] < 0) newRoom[0] += 1;
  if (newRoom[1] < 0) newRoom[1] += 1;

  const nr = newRoom[0] * ROOM_SIZE;
  const nc = newRoom[1] * ROOM_SIZE;
  for (let r = 1; r < ROOM_SIZE - 1; r++) {
    for (let c = 1; c < ROOM_SIZE - 1; c++) {
      newBoard[r + nr][c + nc] = prob() < MINE_PROB ? M : 0;
    }
  }
  for (let door of doors) {
    newBoard[nr + door[0]][nc + door[1]] = 0;
  }

  // u = r === 0
  // r = col === b[0].length-1
  // d = r === b.length-1
  // l = col === 0

  return {
    board: newBoard,
    origin: [prev.origin[0] + sr, prev.origin[1] + sc],
  };
};

const dungeon = { name: "dungeon", init, expand };

export default dungeon;

