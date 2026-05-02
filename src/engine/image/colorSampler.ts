export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Samples average colors from an image for each cell in a grid.
 * Returns a 2D array of hex color strings [rows][cols].
 */
export function sampleGridColors(
  imageData: ImageData,
  cropRect: CropRect,
  gridRows: number,
  gridCols: number
): string[][] {
  const { width: imgWidth, height: imgHeight, data } = imageData;
  const cellWidth = cropRect.width / gridCols;
  const cellHeight = cropRect.height / gridRows;

  const colors: string[][] = [];

  for (let row = 0; row < gridRows; row++) {
    const rowColors: string[] = [];
    for (let col = 0; col < gridCols; col++) {
      const startX = Math.floor(cropRect.x + col * cellWidth);
      const startY = Math.floor(cropRect.y + row * cellHeight);
      const endX = Math.floor(cropRect.x + (col + 1) * cellWidth);
      const endY = Math.floor(cropRect.y + (row + 1) * cellHeight);

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;

      for (let py = startY; py < endY; py++) {
        if (py < 0 || py >= imgHeight) continue;
        for (let px = startX; px < endX; px++) {
          if (px < 0 || px >= imgWidth) continue;
          const idx = (py * imgWidth + px) * 4;
          rSum += data[idx];
          gSum += data[idx + 1];
          bSum += data[idx + 2];
          count++;
        }
      }

      if (count === 0) {
        rowColors.push('#ffffff');
      } else {
        const r = Math.round(rSum / count);
        const g = Math.round(gSum / count);
        const b = Math.round(bSum / count);
        rowColors.push(
          '#' +
            r.toString(16).padStart(2, '0') +
            g.toString(16).padStart(2, '0') +
            b.toString(16).padStart(2, '0')
        );
      }
    }
    colors.push(rowColors);
  }

  return colors;
}
