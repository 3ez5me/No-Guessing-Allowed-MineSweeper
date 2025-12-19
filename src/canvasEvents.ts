import { isLeftPressed, isMiddlePressed, isRightPressed } from "../lib/utils";
import Cursor from "./Cursor";
import { canvas } from "./elements";
import type Game from "./game/Game";

/** @param {Game} game */
export function initMouseEvents(game: Game) {
  let cursor = new Cursor(0, 0, false, false, false);

  const handleMouseDown = createEventHandler((_, prev, curr) => {
    if (!prev.middle && curr.middle) game.state.emit("middleDown", curr);
    else if (!prev.right && curr.right) game.state.emit("rightDown", curr);
    else if (!prev.left && curr.left) game.state.emit("leftDown", curr);
  });
  const handleMouseUp = createEventHandler((_, prev, curr) => {
    if (!(prev.left || prev.middle || prev.right)) return;
    if (prev.middle && !curr.middle) game.state.emit("middleUp", curr);
    else if (prev.right && !curr.right) game.state.emit("rightUp", curr);
    else if (prev.left && !curr.left) game.state.emit("leftUp", curr);
  });
  const handleMouseMove = createEventHandler((_, prev, curr) => game.state.emit("mouseMove", prev, curr));
  const handleWheel = createEventHandler((event, _, curr) =>
    game.state.emit("wheel", curr, (event as WheelEvent).deltaY)
  );

  canvas.addEventListener("contextmenu", e => e.preventDefault());
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("wheel", handleWheel);

  function createEventHandler(fn: (event: MouseEvent | WheelEvent, prev: Cursor, curr: Cursor) => any) {
    return function (event: MouseEvent | WheelEvent) {
      event.preventDefault();

      const prev = cursor.clone();
      const left = isLeftPressed(event);
      const middle = isMiddlePressed(event);
      const right = isRightPressed(event);
      const { x, y } = eventCoordinates(event);
      const curr = new Cursor(x, y, left, middle, right);

      cursor = curr.clone();

      game.state.emit("preMouseEvent", prev, curr);
      fn(event, prev, curr);
    };
  }
}

/** @param {Game} game */
export function initResizeEvents(game: Game) {
  function handleResize() {
    const container = canvasSize();
    canvas.width = container.width;
    canvas.height = container.height;
    game.container = container;
  }

  handleResize();
  canvas.addEventListener("resize", handleResize);
  window.addEventListener("resize", handleResize);
}

export function canvasSize() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.floor(rect.width - rect.left);
  const height = Math.floor(rect.height - rect.top);
  return { width, height };
}

/** @param {MouseEvent} event */
function eventCoordinates(event: MouseEvent) {
  const bounds = canvas.getBoundingClientRect();
  const x = Math.round(((event.x - bounds.left) / bounds.width) * canvas.width);
  const y = Math.round(((event.y - bounds.top) / bounds.height) * canvas.height);
  return { x, y };
}

