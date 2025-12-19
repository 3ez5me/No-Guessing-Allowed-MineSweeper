import { BACKGROUND_COLOR, SPRITE_INDICES, SPRITE_SIZE } from "./constants";
import { canvas, context } from "../elements";
import sprites from "./sprites";
import { delta, type Point2D } from "../../lib/utils";
import type Cursor from "../Cursor";
import type Game from "../game/Game";
import type HistoryNode from "../history/HistoryNode";
import type Verifier from "../verifier/Verifier";

export default class Renderer {
  game: Game;
  counter: number;
  revealOrder: [number, number][];
  verifier: Verifier | null;
  /** @param {Game} game */
  constructor(game: Game) {
    this.game = game;
    /** @type {} */
    this.revealOrder = [];
    this.counter = 0; // just a counter for the circle pulse

    /** @type {Verifier | null} */
    this.verifier = null;

    game.state.in("*").on("hover", (node: HistoryNode) => {
      this.revealOrder = node.revealOrder();
    });
    game.state.in("*").on("hoverStop", _ => {
      this.revealOrder = [];
    });
    game.state.in("*").on("restart", _ => {
      this.revealOrder = [];
      this.verifier = null;
    });

    game.state.in("reviewing").on("loadVerifier", (verifier: Verifier) => {
      this.verifier = verifier;
    });

    game.state.in("*").on("update", () => this.counter++);
  }

  render() {
    context.fillStyle = BACKGROUND_COLOR;
    context.fillRect(0, 0, canvas.width, canvas.height);

    const game = this.game;
    const state = game.state.currState;

    this.renderBoard();

    if (this.revealOrder.length) this.renderArrows();

    this.setCursor();
    const withSecondaryCursor = ["reviewing", "rewinding", "releasing"];
    if (withSecondaryCursor.includes(state)) this.renderCursor();
  }

  renderBoard() {
    const game = this.game;
    const state = game.state.currState;
    const board = game.board;
    const verifier = this.verifier;
    const rows = board.rows;
    const cols = board.cols;
    const cellSize = board.cellSize;

    const [rMin, rMax] = visibleRange(canvas.height, board.coords.y, rows, cellSize);
    const [cMin, cMax] = visibleRange(canvas.width, board.coords.x, cols, cellSize);
    for (let r = rMin; r < rMax; r++) {
      for (let c = cMin; c < cMax; c++) {
        const i = board.pairToIndex(r, c);
        if (board.isBackground(i)) continue;
        const x = board.coords.x + c * cellSize;
        const y = board.coords.y + r * cellSize;
        const spriteOffset = this.getSpriteOffset(i);

        // prettier-ignore
        context.drawImage(
          sprites.CELLS,
          spriteOffset * SPRITE_SIZE, 0, SPRITE_SIZE, SPRITE_SIZE, // source rectangle
          x, y, cellSize, cellSize // destination rectangle
        );

        if (!(state === "reviewing" && verifier)) continue;
        if (verifier.isBackground(i) || verifier.isRevealed(i) || !verifier.isSolved(i)) continue;
        context.fillStyle = verifier.isMine(i) ? "rgba(200, 0, 0, 0.3)" : "rgba(0, 0, 200, 0.3)";
        context.fillRect(x, y, cellSize, cellSize);
      }
    }
  }

  renderCursor() {
    // move check into here
    // const cellSize = game.board.cellSize;
    const cursor = this.game.cursors.secondary;
    const { x, y } = cursor;
    const sprite = this.getCursorSprite(cursor);

    if (this.game.state.currState === "releasing") {
      context.save();
      context.beginPath();
      context.lineWidth = 2;
      context.strokeStyle = `rgb(${64 * Math.sin(this.counter / 32) + 185}, 0, 0)`;
      context.arc(x, y, 8, 0, 2 * Math.PI);
      context.stroke();
      context.restore();
    }

    // prettier-ignore
    context.drawImage(
      sprites[sprite],
      0, 0, sprites[sprite].width, sprites[sprite].height, // source rectangle
      x, y, sprites[sprite].width, sprites[sprite].height // destination rectangle
    );
  }

  setCursor() {
    const cursor = this.game.cursors.primary;
    const state = this.game.state.currState;
    // const asGhost = ["reviewing", "rewinding", "releasing", "win", "loss"];
    const isGhost = state !== "playing";
    const sprite = (isGhost ? "G" : "") + this.getCursorSprite(cursor);
    canvas.className = "cursor-" + sprite;
  }

  /** @param {Cursor} cursor  */
  getCursorSprite(cursor: Cursor): keyof typeof sprites {
    const { left, right, middle } = cursor;
    let sprite = "";
    if (left) sprite += "L";
    if (middle) sprite += "M";
    if (right) sprite += "R";
    if (!(left || middle || right)) sprite += "D";
    return sprite as keyof typeof sprites;
  }

  renderArrows() {
    const game = this.game;
    const board = game.board;
    const [or, oc] = board.origin;
    const cellSize = board.cellSize;

    // const arrowColor = "rgb(73, 7, 148)";
    const arrowColor = "rgb(160, 0, 139)";
    const arrowLength = cellSize / 5;
    const circleRadius = cellSize / 8;
    const scaleDown = cellSize / 4;

    const dCenter = { x: cellSize / 2, y: cellSize / 2 };

    context.strokeStyle = arrowColor;
    context.fillStyle = arrowColor;
    context.lineWidth = Math.max(1, cellSize / 20);

    /** @type {Point2D[]} */
    const path: Point2D[] = this.revealOrder.map(([r, c]) => add2D(board.cellToCoords(or + r, oc + c), dCenter));

    context.beginPath();

    for (let i = 0; i < path.length - 1; i++) {
      const d = delta(path[i], path[i + 1]);
      const distance = Math.hypot(d.x, d.y);
      const arrowTip = add2D(path[i], scale2D(d, (distance - scaleDown) / distance));

      // Line
      context.moveTo(path[i].x, path[i].y);
      context.lineTo(arrowTip.x, arrowTip.y);

      const angle = Math.atan2(d.y, d.x);
      const a1 = angle - Math.PI / 6;
      const a2 = angle + Math.PI / 6;

      // Corner 1
      context.moveTo(arrowTip.x - arrowLength * Math.cos(a1), arrowTip.y - arrowLength * Math.sin(a1));
      // Tip
      context.lineTo(arrowTip.x, arrowTip.y);
      // Corner 2
      context.lineTo(arrowTip.x - arrowLength * Math.cos(a2), arrowTip.y - arrowLength * Math.sin(a2));
    }
    context.stroke();

    // Dots for first and last
    context.beginPath();
    if (path.length) {
      const first = path[0];
      context.moveTo(first.x, first.y);
      context.arc(first.x, first.y, circleRadius, 0, 2 * Math.PI);

      const last = path.at(-1)!;
      context.moveTo(last.x, last.y);
      context.arc(last.x, last.y, circleRadius, 0, 2 * Math.PI);
    }
    context.fill();
  }

  /** @param {number} i  */
  getSpriteOffset(i: number) {
    const game = this.game;
    const gameState = game.state.currState;
    const board = game.board;

    const Mine = board.isMine(i);
    const Flagged = board.isFlagged(i);
    const Revealed = board.isRevealed(i);
    const Pressed = board.isPressed(i);
    const Origin = board.isOrigin(...board.indexToPair(i));

    // Origin isn't flaggable
    if (Origin && !(Pressed || Revealed)) {
      return SPRITE_INDICES.FREE_MOVE;
    }

    if (gameState === "loss") {
      if (Flagged) return Mine ? SPRITE_INDICES.FLAG : SPRITE_INDICES.FLAG_MISPLACED;
      if (Mine) return Revealed ? SPRITE_INDICES.MINE_DETONATED : SPRITE_INDICES.MINE;
    }

    if (gameState === "win" && Mine) {
      return SPRITE_INDICES.FLAG;
    }

    if (Pressed) return SPRITE_INDICES.PRESSED;
    if (Flagged) return SPRITE_INDICES.FLAG;
    if (!Revealed) return SPRITE_INDICES.EMPTY;

    return board.value(i);
  }
}

/**
 * @param {number} axisLength width / height
 * @param {number} axisStart x / y of board
 * @param {number} maxElements rows / cols
 * @param {number} cellSize cell size
 */
function visibleRange(axisLength: number, axisStart: number, maxElements: number, cellSize: number) {
  const visibleCount = Math.ceil((axisLength - axisStart) / cellSize);
  const start = Math.min(Math.max(0, Math.floor(-axisStart / cellSize)), maxElements);
  const end = Math.min(maxElements, start + visibleCount);
  return [start, end];
}

const add2D: (p1: Point2D, p2: Point2D) => Point2D = (p1, p2): Point2D => ({ x: p1.x + p2.x, y: p1.y + p2.y });
const scale2D: (p: Point2D, r: number) => Point2D = (p, r): Point2D => ({ x: p.x * r, y: p.y * r });

