import type { TreeNode } from "./types";
export function findPaths<T extends TreeNode<T>>(start: T, end: T): { up: T[]; lca: T; down: T[] } {
  const path1 = pathFromRoot(start);
  const path2 = pathFromRoot(end);
  const i = lcaIndex(path1, path2);
  // up/down = (lca, node]
  return {
    up: path1.slice(i + 1),
    lca: path1[i],
    down: path2.slice(i + 1),
  };
}

function lcaIndex<T extends TreeNode<T>>(path1: T[], path2: T[]): number {
  const min = Math.min(path1.length, path2.length);
  let i = 0;
  while (i < min && path1[i] === path2[i]) i++;
  return i - 1;
}

export function pathFromRoot<T extends TreeNode<T>>(node: T): T[] {
  return pathToRoot(node).reverse();
}

export function pathToRoot<T extends TreeNode<T>>(node: T): T[] {
  const path = [];
  let curr: T | null = node;
  while (curr) {
    path.push(curr);
    curr = curr.parent;
  }
  return path;
}

