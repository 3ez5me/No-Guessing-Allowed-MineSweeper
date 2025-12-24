import Verifier from "./Verifier";

export class UpdateCellAction {
  i: number;
  prev: number;
  constructor(i: number, prevState: number) {
    this.i = i;
    this.prev = prevState;
  }

  undo(verifier: Verifier) {
    const i = this.i;
    verifier.failures[i]++;
    verifier.grid[i] = this.prev;
  }
}

export class FilterCombinationsAction {
  i: number;
  excluded: Uint8Array<ArrayBuffer>;
  constructor(i: number, excluded: Uint8Array<ArrayBuffer>) {
    this.i = i;
    this.excluded = excluded;
  }

  undo(verifier: Verifier) {
    const i = this.i;
    verifier.combinations[i] = this.excluded;
  }
}

