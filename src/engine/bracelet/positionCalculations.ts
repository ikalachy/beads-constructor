export function getBeadPositionFlat(
  row: number,
  col: number,
  beadSize: number
): [number, number, number] {
  const x = col * beadSize;
  const y = row * beadSize;
  const z = 0;
  return [x, y, z];
}

export function getBeadPositionWrapped(
  row: number,
  col: number,
  totalCols: number,
  beadSize: number
): [number, number, number] {
  const angle = (col / totalCols) * 2 * Math.PI;
  const radius = (totalCols * beadSize) / (2 * Math.PI);
  const x = radius * Math.cos(angle);
  const y = row * beadSize;
  const z = radius * Math.sin(angle);
  return [x, y, z];
}
