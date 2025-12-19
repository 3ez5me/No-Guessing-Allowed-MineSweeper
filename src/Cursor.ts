export default class Cursor {
  x: number;
  y: number;
  left: boolean;
  middle: boolean;
  right: boolean;
  constructor(x: number, y: number, left: boolean, middle: boolean, right: boolean) {
    this.x = x;
    this.y = y;
    this.left = left;
    this.middle = middle;
    this.right = right;
  }

  clone() {
    return new Cursor(this.x, this.y, this.left, this.middle, this.right);
  }

  sameButtons(other: Cursor) {
    return this.left === other.left && this.middle === other.middle && this.right === other.right;
  }
}

