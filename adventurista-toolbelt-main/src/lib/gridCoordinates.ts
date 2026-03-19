import type { GridSettings } from './repositories';

export interface GridCell {
  col: number;
  row: number;
}

interface GridGeometry {
  gridSize: number;
  offsetX: number;
  offsetY: number;
}

function toSpreadsheetColumnLabel(index: number): string {
  let remaining = index;
  let label = '';

  do {
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26) - 1;
  } while (remaining >= 0);

  return label;
}

function getGridGeometry(gridSettings: GridSettings): GridGeometry {
  return {
    gridSize: gridSettings.gridSize,
    offsetX: gridSettings.offsetX,
    offsetY: gridSettings.offsetY,
  };
}

export function getCellFromPoint(x: number, y: number, gridSettings: GridSettings): GridCell {
  const { gridSize, offsetX, offsetY } = getGridGeometry(gridSettings);

  return {
    col: Math.max(0, Math.round((x - offsetX) / gridSize)),
    row: Math.max(0, Math.round((y - offsetY) / gridSize)),
  };
}

export function getCellCenter(cell: GridCell, gridSettings: GridSettings): { x: number; y: number } {
  const { gridSize, offsetX, offsetY } = getGridGeometry(gridSettings);

  return {
    x: offsetX + (cell.col * gridSize) + gridSize / 2,
    y: offsetY + (cell.row * gridSize) + gridSize / 2,
  };
}

export function getCellLabel(cell: GridCell): string {
  return `${toSpreadsheetColumnLabel(cell.col)}${cell.row + 1}`;
}

export function getCellLabelFromPoint(x: number, y: number, gridSettings: GridSettings): string {
  return getCellLabel(getCellFromPoint(x, y, gridSettings));
}
