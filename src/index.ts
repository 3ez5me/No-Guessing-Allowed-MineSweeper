import "./style.css";
import { canvasSize, initMouseEvents, initResizeEvents } from "./canvasEvents.js";
import Game from "./game/Game.js";
import initGameEvents from "./game/gameEvents.js";
import maps from "./maps/maps.js";
import initMenu, { randomSeed } from "./menu.js";
// import { renderBoard } from "./render.js";
import Renderer from "./renderer/Renderer.js";
import initHistoryTree from "./tree/historyTree.js";

// initialize game
const DEFAULT_EXPANSIONS = 3;
const defaultMap = maps[0];
const game = new Game(defaultMap.init, defaultMap.expand, randomSeed(10), DEFAULT_EXPANSIONS, canvasSize());
const renderer = new Renderer(game);

// Hook up canvas events
initResizeEvents(game);
initMouseEvents(game);

// Load sprites + initialize Board rendering

// Initialize Tree Renderer + Events
initHistoryTree(game);

// Hook up restart handler
initMenu(game);

// Initialize game events
initGameEvents(game);

// Hook up update
let prevTime = 0;
requestAnimationFrame(async function loop(time) {
  const dt = time - prevTime;
  prevTime = time;

  await game.state.emit("update", dt);

  renderer.render();
  requestAnimationFrame(loop);
});

// start state machine
game.state.start();

