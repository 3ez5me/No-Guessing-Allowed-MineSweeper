# No Guessing Allowed Minesweeper

A Minesweeper variant where **guesses are detected and punished**. The game records your entire solution path and uses a
sophisticated constraint-satisfaction verifier to rewind and validate that you never made an unjustifiable move.

## 🏆 Play Online

[No Guessing Allowed - Minesweeper](https://no-guessing-allowed-mine-sweeper.vercel.app/)

## 📦 Setup

```bash
pnpm i
pnpm run dev
```

## 🎮 Core Concept

Unlike traditional Minesweeper this variant makes guessing even WORSE:

- **Reveal-Order Matters**: Your sequence of cell reveals determines board expansions
- **Non-Deterministic Rewinds**: Explore alternative paths in real-time across different board states
- **Post-Game Verification**: After winning, the verifier replays your moves to confirm each reveal the player made was
  mathematically guaranteed (the attempted reveal / cell couldn't have possibly been a mine with the available knowledge
  / partial board state)
- **Decision Tree Navigation**: Visual history tree lets you backtrack and try different strategies

**The key insight**: Minesweeper is solvable without guessing on _most_ boards if you explore reveals strategically, or
read the source code for the map generator and try to give it a reveal order that produces a solvable expansion 😎.

## 🏗️ Architecture Overview

### Game Loop & State Machine

- **`Game.ts`** - Core game state container managing board, history, and cursors
- **`StateMachine`** (lib) - Event-driven state management: `playing` → `reviewing` → `win/loss`
- **`gameEvents.ts`** - Event handlers for user actions and state transitions
- **`Cursor.ts`** - Tracks primary (player) and secondary (replay) cursors with button states

### Board & Cell Encoding

- **`Board.ts`** - 2D grid with reveal/flag mechanics and smooth zooming/panning
- **`constants.ts`** - Bit-packed cell format (8 bits per cell):
  ```
  Bits 0-3: Number (0-8) or Mine (9)
  Bit 4:    Revealed flag
  Bit 5:    Flagged by player
  Bit 6:    Pressed (visual feedback)
  Bit 7:    Background (unreachable)
  ```

### History & Rewinding

- **`HistoryNode.ts`** - Tree node representing a single reveal action
  - Stores cursor state, revealed cells, and edge actions (flags, pans, zooms)
  - Children represent branching alternative reveals
- **`actions.ts`** - Action types:
  - `RevealAction` - Core game action (multiple cells revealed in cascade)
  - `BoardAction` - Board expansion after solving current depth
  - Secondary actions: `ToggleFlagAction`, `PressReleaseAction`, `TransformAction`
- **`rewind.ts`** - Generator-based smooth rewind animation
  - Finds lowest common ancestor between current and target node
  - Undoes/redoes actions frame-by-frame with `game.currentTick`
  - Handles pending actions and board state restoration

### Constraint Solver & Verifier

- **`Verifier.ts`** - Constraint satisfaction engine using constraint propagation + backtracking
  - **Key data structures**:
    - `combinations[i]` - All valid mine patterns for 8 neighbors (C(8,k) combos)
    - `mineCounts[i]` / `safeCounts[i]` - How many combos have mine/safe at each covered cell
    - `failures[i]` - Heuristic for picking candidates (higher = more restricted)
  - **Algorithm**:
    1. **Singles propagation**: If a clue fully determines neighbors, deduce them
    2. **Pairs propagation**: Compare overlapping constraint sets between nearby clues
    3. **Backtracking search**: When stuck, try both mine/safe, recursively verify consistency
    4. **Adaptive sampling**: Random order with frequency decay to avoid thrashing
- **`combinations.ts`** - Pre-computed all C(8,k) combinations as 8-bit masks
- **`pairs.ts`** - Deque for efficient pair propagation queue
- **`helpers.ts`** - Bit manipulation for neighbor indexing

### Rendering & UI

- **`Renderer.ts`** - Canvas renderer with sprite sheets
  - Renders board cells, cursor states, and reveal-order arrows
  - Highlights verified safe/mine cells during review
- **`sprites.ts`** - Async sprite loading (button states for L/M/R + ghost variants)
- **`historyTree.ts`** - SVG tree visualization using Reingold-Tilford algorithm
  - **`LayoutNode.ts`** - Classic tree layout algorithm for optimal spacing
  - Clicking nodes triggers rewinds; hovering shows reveal order arrows
- **`menu.ts`** - Game settings UI (depth, map, seed)

### Map Generation

- **`Initialize`** - Generates starting board given a seed
- **`Expand`** - Generates next board layer based on reveal history
- **Example map** - Small 7×7 board with static expansions
- **Dungeon map** - Procedural dungeon-like expansion with rooms and corridors
  - Uses seeded PRNG (`freeEntropy`) for deterministic generation
  - Expands towards most recent reveal for exploratory gameplay

## 🧠 Key Algorithms

### Verification During Replay

```
for each reveal in history:
  check if reveal location **could** be a mine:
    use verifier.verify(location):
      - try to find ANY valid mine configuration with mine at location
      - if found → location is NOT guaranteed safe → THIS WAS A GUESS
      - if not found → location must be safe → OK

  if any reveal was a guess:
    return LOSS (caught cheating!)

return WIN (clean solve)
```

### Constraint Propagation

1. **Initialize**: Build initial combination set for each clue based on revealed neighbors
2. **Singles**: For each clue, if all combos agree on a cell → that cell is solved
3. **Pairs**: For overlapping clues, filter combos that violate each other's constraints
4. **Repeat** until fixed point

### Backtracking Search (in `*verify()` generator)

- Picks candidate covered cell with highest "restrictedness × failure_score"
- Tries both mine/safe with random order (with occasional reversal)
- Recursively explores until either:
  - All covered cells solved → solution found (mine exists)
  - Contradiction found → backtrack
- Returns `true` if any valid mine configuration found → reveal is NOT safe
- Returns `false` if no mine configuration exists → reveal IS guaranteed safe

## 🎮 Controls

| Action      | Key                     |
| ----------- | ----------------------- |
| Reveal cell | Left click              |
| Flag cell   | Right click             |
| Pan         | Middle mouse drag       |
| Zoom        | Scroll wheel            |
| Rewind      | Click history tree node |

## 📋 Game Flow

1. **Initialize**: Load board from map, show first cell (origin)
2. **Playing**:
   - Left-click reveals (flood-fill if empty)
   - Right-click flags
   - Track all actions in history tree
3. **Board Expansion**: When all non-mine clues revealed → generate next layer (if depth > 0)
4. **Victory**: All non-mine clues revealed across all layers
5. **Review**: Rewind to start, replay all moves, verify each was guaranteed safe
6. **Result**: Win (all safe) or Loss (any guess detected)

## 🚀 Performance Optimizations

- **Bit-packed cells**: 8 cells per 64 bits, cache-friendly
- **Pre-computed combinations**: C(8,0) through C(8,8) = 256 combos total
- **Lazy verification**: Only verify when you move, not continuously
- **Generator-based rewind**: Smooth animation without blocking UI
- **Heuristic-guided search**: `failures` array reduces backtracking depth
- **Pair filtering**: Eliminates combos early rather than full SAT solver

## 🗺️ Map System

Maps are defined by two functions:

```typescript
type Initialize = (seed: string) => { board: number[][]; origin: [row, col] };
type Expand = (seed: string, history: RevealHistory[]) => { board: number[][]; origin: [row, col] };
```

- **Initialize**: Generate starting board from seed
- **Expand**: Generate next layer based on _entire history_ (enables deterministic procedural generation)
- **Origin**: Starting cell (always unrevealed, flood-fills entire connected empty region)

## 🎓 Advanced Concepts

### Non-Deterministic Branching

The history tree naturally branches when you try different reveal orders.

### Reveal Order Sensitivity

- Different reveal orders can expose new cells differently
- Later reveals constrain earlier ones retroactively (e.g., a new clue might contradict a previous deduction)
- This is why rewinding and retrying is powerful

### Why Zero-Guess is Hard

- Most random boards have _some_ guess-free solution
- Finding it requires optimal move ordering
- If all paths require guessing → seed is unwinnable

## 🔗 Data Flow

```
User Input → Cursor/Board Events → History Node (+ pending actions)
                                    ↓
                            Tree Navigation (SVG)
                                    ↓
                            Rewind Generator (smooth animation)
                                    ↓
                            Board State + Game State
                                    ↓
                            Renderer (canvas + SVG)
                                    ↓
                            Display

[End Game] → Review Mode → Rewind to Start → Verify Each Move → Verifier (backtracking)
```

## 🧪 Testing

```bash
pnpm test  # Runs lib/ tests (state machine, emitter)
```

Tests cover:

- State machine transitions and event emission
- Event emitter subscription/unsubscription
- Tree layout (Reingold-Tilford algorithm)

---

**Remember**: If you're stuck, use the history tree to find a better reveal order 🧠💣
