import maps from "./maps/maps";
import * as UI from "./elements";
import { randomInt, randomString } from "../lib/utils";
import type Game from "./game/Game";
import type { Map } from "./maps/types";

const CHARS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const defaultMaxSeedLength = 100;

export default function init(game: Game) {
  /* Open/close menu modal */
  UI.closeMenu.addEventListener("click", toggleMenu);
  UI.openMenu.addEventListener("click", toggleMenu);
  document.addEventListener("keydown", e => e.key === "Escape" && toggleMenu());

  /* Increment/decrement maximum depth */
  UI.incrementButton.addEventListener(
    "click",
    () => (UI.depthInput.value = `${Math.max(0, +UI.depthInput.value + 1)}`)
  );
  UI.decrementButton.addEventListener(
    "click",
    () => (UI.depthInput.value = `${Math.max(0, +UI.depthInput.value - 1)}`)
  );

  /* Randomize seed */
  UI.randomizeSeedButton.addEventListener("click", () => (UI.seedInput.value = randomSeed(defaultMaxSeedLength)));

  /* Send new game event */
  UI.newGameButton.addEventListener("click", () => {
    const { init, expand } = maps.find(map => map.name === UI.mapSelect.value)!;
    const seed = UI.seedInput.value.trim();
    const depth = Math.abs(+UI.depthInput.value);
    if (!Number.isFinite(depth)) return;
    toggleMenu();
    game.state.emit("restart", init, expand, seed, depth);
  });

  /* Initialize defaults */
  UI.seedInput.value = randomSeed(defaultMaxSeedLength);
  UI.depthInput.value = "3";

  /* load maps */
  loadMaps(maps);

  const emojis = {
    playing: "▶️",
    win: "🏆",
    loss: "💀",
    rewinding: "⌛",
    reviewing: "🔍",
    releasing: "🖱️",
  };

  game.state.in("*").on("enter", () => {
    UI.statusIcon.innerText = emojis[game.state.currState];
  });
}

function loadMaps(maps: Map[]) {
  for (const map of maps) {
    const option = document.createElement("option");
    const value = map.name;
    option.value = value;
    option.innerText = value;
    UI.mapSelect.appendChild(option);
  }
}

function toggleMenu() {
  if (UI.menu.classList.contains("noDisplay")) {
    UI.menu.classList.remove("noDisplay");
  } else {
    UI.menu.classList.add("noDisplay");
  }
}

/** random seed of length `0...length` @param {number} length */
export const randomSeed = (length: number) => randomString(CHARS, randomInt(length));

