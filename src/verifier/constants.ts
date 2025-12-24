/*  
  Board Cell:
  Symbol | Meaning           | Bit
  N      | Number            | 0-3
  R      | Revealed          | 4
  S      | Solved            | 5
  M      | Mine              | 6
  B      | Background        | 7      
*/
// prettier-ignore
export const MASKS = Object.freeze({
  EMPTY:       0b0000_0000, // 0
  NUMBER:      0b0000_1111, // 15
  REVEALED:    0b0001_0000, // 16
  SOLVED:      0b0010_0000, // 32
  MINE:        0b0100_0000, // 64
  BACKGROUND:  0b1000_0000, // 128
});

export const BYTE_SET = 0b1111_1111;

