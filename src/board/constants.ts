/*  
  Board Cell:
  Symbol | Meaning           | Bit
  N      | Number            | 0-3
  V      | Visible           | 4
  F      | Flagged           | 5
  P      | Pressed           | 6
  B      | Background        | 8
Mine: Number 9
*/
// prettier-ignore
export const MASKS = Object.freeze({
  EMPTY:       0b0000_0000, // 0
  VALUE:       0b0000_1111, // 15
  MINE:        0b0000_1001, // 9
  // Values 0-8 are clues,and mine is 9
  REVEALED:    0b0001_0000, // 16
  FLAG:        0b0010_0000, // 32
  PRESSED:     0b0100_0000, // 64
  BACKGROUND:  0b1000_0000, // 128
});

