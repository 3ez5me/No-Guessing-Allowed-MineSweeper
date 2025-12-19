type TreeNode<T extends TreeNode<T>> = { children: T[] };

export default class LayoutNode<T extends TreeNode<T>> {
  x: number;
  y: number;
  dataNode: T;
  parent: LayoutNode<T> | null;
  index: number;
  thread: LayoutNode<T> | null;
  ancestor: LayoutNode<T>;
  offset: number;
  change: number;
  shift: number;
  mod: number;
  children: LayoutNode<T>[];

  static createLayoutTree<U extends TreeNode<U>>(dataNode: U) {
    const tree = new LayoutNode(dataNode).firstWalk();
    const minX = Math.max(-tree.secondWalk(), 0);
    // Final walk: make all x >= 0
    for (const node of tree.preorder()) {
      node.x += minX;
      // Optional:
      node.x = node.x * 32 + 32;
      node.y = node.y * 32 + 32;
    }
    return tree;
  }

  constructor(dataNode: T, parent: LayoutNode<T> | null = null, depth: number = 0, index: number = 0) {
    this.dataNode = dataNode;
    this.x = -1;
    this.y = depth;
    this.parent = parent;
    this.index = index;
    this.thread = null;
    this.ancestor = this;
    this.offset = 0;
    this.change = 0;
    this.shift = 0;
    this.mod = 0;
    this.children = dataNode.children.map((child, i) => new LayoutNode(child, this, depth + 1, i));
  }

  get leftmostSibling(): LayoutNode<T> | null {
    return this.parent && this.index !== 0 ? this.parent.children[0] : null;
  }

  get prevSibling(): LayoutNode<T> | null {
    return this.parent && this.index !== 0 ? this.parent.children[this.index - 1] : null;
  }

  nextLeft(): LayoutNode<T> | null {
    if (this.thread) return this.thread;
    if (this.children.length) return this.children[0];
    return null;
  }

  nextRight(): LayoutNode<T> | null {
    if (this.thread) return this.thread;
    if (this.children.length) return this.children[this.children.length - 1];
    return null;
  }

  *preorder(): Generator<LayoutNode<T>> {
    yield this;
    for (const child of this.children) yield* child.preorder();
  }

  executeShifts() {
    let shift = 0;
    let change = 0;
    for (let i = this.children.length - 1; i >= 0; i--) {
      const child = this.children[i];
      child.x += shift;
      child.mod += shift;
      change += child.change;
      shift += child.shift + change;
    }
  }

  moveSubtree(ancestor: LayoutNode<T>, shift: number) {
    const subtrees = this.index - ancestor.index;
    ancestor.change += shift / subtrees;
    this.change -= shift / subtrees;
    this.shift += shift;
    this.x += shift;
    this.mod += shift;
  }

  apportion(defaultAncestor: LayoutNode<T>, distance: number) {
    if (!this.prevSibling) return defaultAncestor;

    let innerRight: LayoutNode<T> = this;
    let outerRight: LayoutNode<T> = this;
    let innerLeft = this.prevSibling;
    let outerLeft = this.leftmostSibling!;
    let outerRightSum = this.mod;
    let innerRightSum = this.mod;
    let innerLeftSum = innerLeft.mod;
    let outerLeftSum = outerLeft.mod;

    while (innerLeft.nextRight() && innerRight.nextLeft()) {
      innerLeft = innerLeft.nextRight()!;
      innerRight = innerRight.nextLeft()!;
      outerLeft = outerLeft.nextLeft()!;
      outerRight = outerRight.nextRight()!;
      outerRight.ancestor = this;

      const shift = innerLeft.x + innerLeftSum - (innerRight.x + innerRightSum) + distance;
      if (shift > 0) {
        const ancestor = this.parent?.children.includes(innerLeft.ancestor) ? innerLeft.ancestor : defaultAncestor;
        this.moveSubtree(ancestor, shift);
        innerRightSum += shift;
        outerRightSum += shift;
      }

      innerLeftSum += innerLeft.mod;
      innerRightSum += innerRight.mod;
      outerLeftSum += outerLeft.mod;
      outerRightSum += outerRight.mod;
    }

    if (innerLeft.nextRight() && !outerRight.nextRight()) {
      outerRight.thread = innerLeft.nextRight();
      outerRight.mod += innerLeftSum - outerRightSum;
    } else {
      if (innerRight.nextLeft() && !outerLeft.nextLeft()) {
        outerLeft.thread = innerRight.nextLeft();
        outerLeft.mod += innerRightSum - outerLeftSum;
      }
      defaultAncestor = this;
    }
    return defaultAncestor;
  }

  firstWalk(distance = 1) {
    if (this.children.length === 0) {
      this.x = this.leftmostSibling ? this.prevSibling!.x + distance : 0;
      return this;
    }

    let defaultAncestor = this.children[0];
    for (const child of this.children) {
      child.firstWalk(distance);
      defaultAncestor = child.apportion(defaultAncestor, distance);
    }

    this.executeShifts();

    const first = this.children[0].x;
    const last = this.children.at(-1)!.x;
    const midpoint = (first + last) / 2;
    if (this.prevSibling) {
      this.x = this.prevSibling.x + distance;
      this.mod = this.x - midpoint;
    } else {
      this.x = midpoint;
    }

    return this;
  }

  secondWalk(modSum = 0): number {
    // apply modsums and return minimum x of new tree
    this.x += modSum;
    return this.children.reduce((min, child) => Math.min(min, child.secondWalk(modSum + this.mod)), this.x);
  }
}

