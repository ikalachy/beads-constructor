import { v4 as uuidv4 } from 'uuid';
import type { Bead, BraceletConfig } from '../../types';

const DEFAULT_COLOR = '#ffffff';
const DEFAULT_MATERIAL = 'glossy' as const;

export function calculateRows(lengthCm: number, beadSizeMm: number): number {
  const lengthMm = lengthCm * 10;
  return Math.floor(lengthMm / beadSizeMm);
}

export function createGrid(config: BraceletConfig): Bead[][] {
  const rows = calculateRows(config.lengthCm, config.beadSizeMm);
  const cols = config.width;

  const grid: Bead[][] = [];
  for (let row = 0; row < rows; row++) {
    const rowBeads: Bead[] = [];
    for (let col = 0; col < cols; col++) {
      rowBeads.push({
        id: uuidv4(),
        row,
        column: col,
        color: DEFAULT_COLOR,
        material: DEFAULT_MATERIAL,
      });
    }
    grid.push(rowBeads);
  }
  return grid;
}

export function resizeGrid(existing: Bead[][], newConfig: BraceletConfig): Bead[][] {
  const newRows = calculateRows(newConfig.lengthCm, newConfig.beadSizeMm);
  const newCols = newConfig.width;

  const grid: Bead[][] = [];
  for (let row = 0; row < newRows; row++) {
    const rowBeads: Bead[] = [];
    for (let col = 0; col < newCols; col++) {
      if (row < existing.length && col < existing[0]?.length) {
        const old = existing[row][col];
        rowBeads.push({ ...old, row, column: col });
      } else {
        rowBeads.push({
          id: uuidv4(),
          row,
          column: col,
          color: DEFAULT_COLOR,
          material: DEFAULT_MATERIAL,
        });
      }
    }
    grid.push(rowBeads);
  }
  return grid;
}
