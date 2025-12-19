export default class Pairs {
  set: Set<string>;
  indices: string[];
  constructor() {
    this.set = new Set();
    this.indices = [];
  }

  enqueue(i: number, j: number) {
    const a = Math.min(i, j);
    const b = Math.max(i, j);
    const pair = `${a},${b}`;
    if (this.set.has(pair)) return;
    this.indices.push(pair);
    this.set.add(pair);
  }

  dequeue(): [number, number] {
    const pair = this.indices.pop()!;
    const [a, b] = pair.split(",").map(x => +x);
    this.set.delete(pair);
    return [a, b];
  }

  isEmpty() {
    return !this.indices.length;
  }
}

