export const depthInput = document.querySelector("#depth") as HTMLInputElement;

export const incrementButton = document.querySelector(".increment") as HTMLButtonElement;

export const decrementButton = document.querySelector(".decrement") as HTMLButtonElement;

export const seedInput = document.querySelector("#seed") as HTMLInputElement;

export const randomizeSeedButton = document.querySelector(".randomize-seed") as HTMLButtonElement;

export const closeMenu = document.querySelector(".close-menu") as HTMLButtonElement;

export const openMenu = document.querySelector(".open-menu") as HTMLButtonElement;

export const menu = document.querySelector(".menu") as HTMLDivElement;

export const newGameButton = document.querySelector("#new-game") as HTMLButtonElement;

export const statusIcon = document.getElementById("status-icon") as HTMLDivElement;

export const canvas = document.getElementById("canvas") as HTMLCanvasElement;

export const context = canvas.getContext("2d")!;

export const mapSelect = document.querySelector("#map") as HTMLSelectElement;

export const svg = document.getElementById("tree-visualization") as HTMLElement & SVGElement;

