export type Initialize = (seed: string) => { board: number[][]; origin: [number, number] };
export type Expand = (
  seed: string,
  history: { board: number[][]; origin: [number, number]; reveals: [number, number][] }[]
) => { board: number[][]; origin: [number, number] };
export type Map = { name: string; init: Initialize; expand: Expand };

