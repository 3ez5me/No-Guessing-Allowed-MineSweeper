import { svg } from "../elements";
import Cursor from "../Cursor";
import LayoutNode from "./LayoutNode";
import Game from "../game/Game";
import { delta, isMiddlePressed, max2D, min2D } from "../../lib/utils";
import HistoryNode from "../history/HistoryNode";

const NODE_SIZE = 16;

type SVGTreeNode = SVGCircleElement | SVGRectElement;
type HistoryLayoutNode = LayoutNode<HistoryNode>;

/** @param {Game} game */
export default function initHistoryTree(game: Game) {
  let cursor = new Cursor(0, 0, false, false, false);

  const viewBox: [x: number, y: number, width: number, height: number] = [0, 0, 0, 0];

  const boundingBox = {
    min: { x: Infinity, y: Infinity },
    max: { x: -Infinity, y: -Infinity },
  };

  svg.innerHTML = "";
  const nodes = new Map<HistoryNode, SVGTreeNode>(); // nodes
  const lines = new Map<HistoryNode, SVGPolylineElement>(); // node to parent (if any)
  let currentNode: HistoryNode | null = null;

  window.addEventListener("resize", resize);
  resize();
  draw();

  game.state.in("*").on("currNodeChange", (root: HistoryNode, node: HistoryNode) => {
    if (!nodes.has(root)) reset();
    if (!nodes.has(node)) draw();
    setCurrentNode(node);
    if (!currentNode) return;
    const ele = nodes.get(currentNode)!;

    const { min, max } = boundingBox;
    const [x, y, width, height] = viewBox;
    const [right, bottom] = [x + width, y + height];
    const bbox = ele.getBBox();

    const p = {
      x: bbox.x < x ? bbox.x : bbox.x + bbox.width > right ? bbox.x + bbox.width - width : x,
      y: bbox.y < y ? bbox.y : bbox.y + bbox.height > bottom ? bbox.y + bbox.height - height : y,
    };

    viewBox[0] = Math.max(min.x - width, Math.min(p.x, max.x));
    viewBox[1] = Math.max(min.y - height, Math.min(p.y, max.y));
    svg.setAttribute("viewBox", viewBox.join(" "));
  });

  svg.addEventListener("mousemove", event => {
    const p = { x: event.clientX, y: event.clientY };
    if (isMiddlePressed(event)) {
      const d = delta(p, cursor);
      const { min, max } = boundingBox;
      const [x, y, width, height] = viewBox;
      viewBox[0] = Math.max(min.x - width + NODE_SIZE, Math.min(x + d.x, max.x - NODE_SIZE));
      viewBox[1] = Math.max(min.y - height + NODE_SIZE, Math.min(y + d.y, max.y - NODE_SIZE));
      // recomputeBoundingBox();

      svg.setAttribute("viewBox", viewBox.join(" "));
    }
    cursor.x = p.x;
    cursor.y = p.y;
  });

  function recomputeBoundingBox() {
    boundingBox.min = { x: Infinity, y: Infinity };
    boundingBox.max = { x: -Infinity, y: -Infinity };
    const children = svg.children as unknown as SVGGraphicsElement[];
    for (let child of children) {
      const bbox = child.getBBox();
      const maxBox = { x: bbox.x + bbox.width, y: bbox.y + bbox.height };

      boundingBox.min = min2D(boundingBox.min, bbox);
      boundingBox.max = max2D(boundingBox.max, maxBox);
    }
  }

  function draw() {
    if (!game.root) return;
    const layoutRoot: HistoryLayoutNode = LayoutNode.createLayoutTree(game.root);

    for (const node of layoutRoot.preorder()) {
      setTreeNodeAttributes(node, getTreeNode(node.dataNode));
      for (const child of node.children) {
        setLineAttributes(node, child, getLine(child.dataNode));
      }
    }
    recomputeBoundingBox();
    setCurrentNode(game.currNode);
  }

  function reset() {
    nodes.clear();
    lines.clear();
    currentNode = null;

    viewBox[0] = 0;
    viewBox[1] = 0;

    boundingBox.min = { x: Infinity, y: Infinity };
    boundingBox.max = { x: -Infinity, y: -Infinity };

    svg.innerHTML = "";
    svg.setAttribute("viewBox", viewBox.join(" "));
  }

  function resize() {
    const { width, height } = svg.getBoundingClientRect();
    viewBox[2] = width;
    viewBox[3] = height;
    svg.setAttribute("viewBox", viewBox.join(" "));
  }

  function setCurrentNode(node: HistoryNode) {
    if (!node || currentNode === node) return;
    if (currentNode) nodes.get(currentNode)!.classList.remove("current");
    currentNode = node;
    nodes.get(node)!.classList.add("current");
  }

  function getLine(node: HistoryNode) {
    if (lines.has(node)) return lines.get(node)!;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    lines.set(node, line);
    svg.prepend(line);
    return line;
  }

  /** @param {HistoryNode} node */
  function getTreeNode(node: HistoryNode) {
    if (nodes.has(node)) return nodes.get(node)!;
    const shape = node.isReveal() ? "circle" : "rect";
    const treeNode = document.createElementNS("http://www.w3.org/2000/svg", shape);

    if (node.isReveal()) {
      treeNode.addEventListener("mouseenter", () => game.state.emit("hover", node));
      treeNode.addEventListener("mouseout", () => game.state.emit("hoverStop", node));
    }

    treeNode.addEventListener("click", () => game.state.emit("rewind", game.currNode, node));

    nodes.set(node, treeNode);
    svg.append(treeNode);
    return treeNode;
  }

  function setTreeNodeAttributes(layoutNode: HistoryLayoutNode, treeNode: SVGTreeNode) {
    const historyNode = layoutNode.dataNode;
    const { x, y } = layoutNode;

    if (historyNode.isReveal()) {
      const circle = treeNode;
      circle.setAttribute("cx", `${x + NODE_SIZE / 2}`);
      circle.setAttribute("cy", `${y + NODE_SIZE / 2}`);
      circle.setAttribute("r", `${NODE_SIZE / 2}`);
      return circle;
    } else {
      const rect = treeNode;
      rect.setAttribute("x", `${x}`);
      rect.setAttribute("y", `${y}`);
      rect.setAttribute("width", `${NODE_SIZE}`);
      rect.setAttribute("height", `${NODE_SIZE}`);
      return rect;
    }
  }

  function setLineAttributes(
    layoutNode: HistoryLayoutNode,
    childLayoutNode: HistoryLayoutNode,
    line: SVGPolylineElement
  ) {
    const p = { x: layoutNode.x + NODE_SIZE / 2, y: layoutNode.y + NODE_SIZE }; // parent bottom center
    const c = { x: childLayoutNode.x + NODE_SIZE / 2, y: childLayoutNode.y }; // child top center
    const my = p.y + (c.y - p.y) / 2; // midway
    const py = p.y - 4;
    const cy = c.y + 4;

    line.setAttribute("points", `${p.x},${py} ${p.x},${my} ${c.x},${my} ${c.x},${cy}`);
    return line;
  }
}

// function eventToSvgCoordinates(event, svg) {
//   const el = event.currentTarget;
//   // const svg = el.ownerSVGElement;
//   let p = svg.createSVGPoint();
//   p.x = event.clientX;
//   p.y = event.clientY;
//   p = p.matrixTransform(svg.getScreenCTM().inverse());
//   return p;
// }

