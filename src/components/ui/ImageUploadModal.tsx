import { useCallback, useEffect, useRef, useState } from 'react';
import { sampleGridColors } from '../../engine/image/colorSampler';
import { useBraceletStore } from '../../store/useBraceletStore';
import { calculateRows } from '../../engine/bracelet/gridCalculations';

interface ImageUploadModalProps {
  imageSrc: string;
  onClose: () => void;
}

type Selection = { x: number; y: number; width: number; height: number };
type DragMode = 'none' | 'draw' | 'move' | 'pan';

/** Draws bead circles + grid lines on a canvas overlay */
function drawBeadOverlay(
  canvas: HTMLCanvasElement,
  colors: string[][],
  gridCols: number,
  gridRows: number
) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const cellW = w / gridCols;
  const cellH = h / gridRows;
  const radius = Math.min(cellW, cellH) * 0.42;

  // Draw grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  for (let c = 1; c < gridCols; c++) {
    const x = Math.round(c * cellW) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let r = 1; r < gridRows; r++) {
    const y = Math.round(r * cellH) + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Draw bead circles
  for (let r = 0; r < gridRows; r++) {
    for (let c = 0; c < gridCols; c++) {
      const color = colors[r]?.[c];
      if (!color) continue;
      const cx = (c + 0.5) * cellW;
      const cy = (r + 0.5) * cellH;

      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.82;
      ctx.fill();
      ctx.globalAlpha = 1;

      // Highlight
      ctx.beginPath();
      ctx.arc(cx, cy - radius * 0.25, radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
    }
  }
}

export function ImageUploadModal({ imageSrc, onClose }: ImageUploadModalProps) {
  const config = useBraceletStore((s) => s.config);
  const applyImageColors = useBraceletStore((s) => s.applyImageColors);

  const gridCols = config.width;
  const gridRows = calculateRows(config.lengthCm, config.beadSizeMm);
  const aspectRatio = gridCols / gridRows;

  const [imageLoaded, setImageLoaded] = useState(false);
  const previewColorsRef = useRef<string[][] | null>(null);
  const [hasPreview, setHasPreview] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageDataRef = useRef<ImageData | null>(null);

  // Image zoom & pan
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Selection in image-natural-pixel coords
  const [selection, setSelection] = useState<Selection | null>(null);
  const [dragMode, setDragMode] = useState<DragMode>('none');
  const dragStartRef = useRef<{ x: number; y: number; sel: Selection | null; pan: { x: number; y: number } } | null>(null);

  // rAF throttle for sampling during drag
  const rafRef = useRef<number | null>(null);
  const pendingSelectionRef = useRef<Selection | null>(null);

  // Cache ImageData once image loads
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    imageDataRef.current = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight);
  }, []);

  // Sample + draw overlay
  const updateOverlay = useCallback(
    (sel: Selection) => {
      if (!imageDataRef.current || sel.width <= 0 || sel.height <= 0) return;
      const colors = sampleGridColors(imageDataRef.current, sel, gridRows, gridCols);
      previewColorsRef.current = colors;
      setHasPreview(true);

      const canvas = overlayCanvasRef.current;
      if (canvas) {
        // Size canvas to match selection pixel dimensions for sharpness
        const dpr = window.devicePixelRatio || 1;
        const displayW = canvas.clientWidth;
        const displayH = canvas.clientHeight;
        const canvasW = Math.round(displayW * dpr);
        const canvasH = Math.round(displayH * dpr);
        if (canvas.width !== canvasW || canvas.height !== canvasH) {
          canvas.width = canvasW;
          canvas.height = canvasH;
        }
        drawBeadOverlay(canvas, colors, gridCols, gridRows);
      }
    },
    [gridRows, gridCols]
  );

  // Throttled update via rAF
  const scheduleUpdate = useCallback(
    (sel: Selection) => {
      pendingSelectionRef.current = sel;
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingSelectionRef.current) {
          updateOverlay(pendingSelectionRef.current);
        }
      });
    },
    [updateOverlay]
  );

  // Update overlay when selection settles (non-drag)
  useEffect(() => {
    if (!imageLoaded || !selection || selection.width <= 0) {
      previewColorsRef.current = null;
      setHasPreview(false);
      return;
    }
    updateOverlay(selection);
  }, [imageLoaded, selection, gridRows, gridCols, updateOverlay]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Convert page coords to image-natural-pixel coords
  const pageToImage = useCallback(
    (pageX: number, pageY: number) => {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container || !img) return { ix: 0, iy: 0 };

      const cRect = container.getBoundingClientRect();
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const containerW = cRect.width;
      const containerH = cRect.height;
      const baseScale = Math.min(containerW / naturalW, containerH / naturalH);
      const effectiveScale = baseScale * zoom;

      const imgDisplayW = naturalW * effectiveScale;
      const imgDisplayH = naturalH * effectiveScale;
      const imgLeft = (containerW - imgDisplayW) / 2 + pan.x;
      const imgTop = (containerH - imgDisplayH) / 2 + pan.y;

      const ix = (pageX - cRect.left - imgLeft) / effectiveScale;
      const iy = (pageY - cRect.top - imgTop) / effectiveScale;
      return { ix, iy };
    },
    [zoom, pan]
  );

  // Convert image-pixel coords to container px
  const imageToContainer = useCallback(
    (ix: number, iy: number) => {
      const container = containerRef.current;
      const img = imgRef.current;
      if (!container || !img) return { cx: 0, cy: 0 };

      const cRect = container.getBoundingClientRect();
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;
      const containerW = cRect.width;
      const containerH = cRect.height;
      const baseScale = Math.min(containerW / naturalW, containerH / naturalH);
      const effectiveScale = baseScale * zoom;

      const imgDisplayW = naturalW * effectiveScale;
      const imgDisplayH = naturalH * effectiveScale;
      const imgLeft = (containerW - imgDisplayW) / 2 + pan.x;
      const imgTop = (containerH - imgDisplayH) / 2 + pan.y;

      return {
        cx: imgLeft + ix * effectiveScale,
        cy: imgTop + iy * effectiveScale,
      };
    },
    [zoom, pan]
  );

  // Pointer handlers
  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const { ix, iy } = pageToImage(e.clientX, e.clientY);

      if (e.button === 1 || e.altKey) {
        setDragMode('pan');
        dragStartRef.current = { x: e.clientX, y: e.clientY, sel: selection, pan: { ...pan } };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        return;
      }

      if (
        selection &&
        ix >= selection.x &&
        ix <= selection.x + selection.width &&
        iy >= selection.y &&
        iy <= selection.y + selection.height
      ) {
        setDragMode('move');
        dragStartRef.current = {
          x: ix - selection.x,
          y: iy - selection.y,
          sel: { ...selection },
          pan: { ...pan },
        };
      } else {
        setDragMode('draw');
        dragStartRef.current = { x: ix, y: iy, sel: null, pan: { ...pan } };
        setSelection({ x: ix, y: iy, width: 0, height: 0 });
      }
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [selection, pageToImage, pan]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragMode === 'none' || !dragStartRef.current) return;

      if (dragMode === 'pan') {
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        setPan({ x: dragStartRef.current.pan.x + dx, y: dragStartRef.current.pan.y + dy });
        return;
      }

      const { ix, iy } = pageToImage(e.clientX, e.clientY);
      const img = imgRef.current;
      if (!img) return;
      const naturalW = img.naturalWidth;
      const naturalH = img.naturalHeight;

      let newSel: Selection | null = null;

      if (dragMode === 'move' && selection) {
        const newX = Math.max(0, Math.min(naturalW - selection.width, ix - dragStartRef.current.x));
        const newY = Math.max(0, Math.min(naturalH - selection.height, iy - dragStartRef.current.y));
        newSel = { ...selection, x: newX, y: newY };
      } else if (dragMode === 'draw') {
        const startIx = dragStartRef.current.x;
        const startIy = dragStartRef.current.y;
        const dx = ix - startIx;
        const dy = iy - startIy;

        let w: number, h: number;
        if (Math.abs(dx) * gridRows >= Math.abs(dy) * gridCols) {
          w = Math.abs(dx);
          h = (w * gridRows) / gridCols;
        } else {
          h = Math.abs(dy);
          w = (h * gridCols) / gridRows;
        }

        let sx = dx >= 0 ? startIx : startIx - w;
        let sy = dy >= 0 ? startIy : startIy - h;

        sx = Math.max(0, sx);
        sy = Math.max(0, sy);
        if (sx + w > naturalW) w = naturalW - sx;
        if (sy + h > naturalH) h = naturalH - sy;

        const currentRatio = w / h;
        const targetRatio = gridCols / gridRows;
        if (currentRatio > targetRatio) {
          w = h * targetRatio;
        } else {
          h = w / targetRatio;
        }

        newSel = { x: sx, y: sy, width: w, height: h };
      }

      if (newSel) {
        setSelection(newSel);
        scheduleUpdate(newSel);
      }
    },
    [dragMode, selection, pageToImage, gridCols, gridRows, scheduleUpdate]
  );

  const handlePointerUp = useCallback(() => {
    setDragMode('none');
    dragStartRef.current = null;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    setZoom((prev) => Math.min(10, Math.max(0.5, prev + delta * prev)));
  }, []);

  const handleApply = useCallback(() => {
    if (previewColorsRef.current) {
      const flipped = [...previewColorsRef.current].reverse();
      applyImageColors(flipped);
    }
    onClose();
  }, [applyImageColors, onClose]);

  const handleAutoFit = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const imgAspect = naturalW / naturalH;

    let w: number, h: number;
    if (aspectRatio > imgAspect) {
      w = naturalW;
      h = w / aspectRatio;
    } else {
      h = naturalH;
      w = h * aspectRatio;
    }
    setSelection({
      x: (naturalW - w) / 2,
      y: (naturalH - h) / 2,
      width: w,
      height: h,
    });
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [aspectRatio]);

  // Selection rect in container px
  const selectionStyle = (() => {
    if (!selection || selection.width <= 0) return null;
    const topLeft = imageToContainer(selection.x, selection.y);
    const bottomRight = imageToContainer(
      selection.x + selection.width,
      selection.y + selection.height
    );
    return {
      left: topLeft.cx,
      top: topLeft.cy,
      width: bottomRight.cx - topLeft.cx,
      height: bottomRight.cy - topLeft.cy,
    };
  })();

  // Image transform style
  const imgStyle = (() => {
    const container = containerRef.current;
    const img = imgRef.current;
    if (!container || !img) return {};
    const cRect = container.getBoundingClientRect();
    const naturalW = img.naturalWidth;
    const naturalH = img.naturalHeight;
    const containerW = cRect.width;
    const containerH = cRect.height;
    const baseScale = Math.min(containerW / naturalW, containerH / naturalH);
    const effectiveScale = baseScale * zoom;
    const imgW = naturalW * effectiveScale;
    const imgH = naturalH * effectiveScale;
    return {
      position: 'absolute' as const,
      left: (containerW - imgW) / 2 + pan.x,
      top: (containerH - imgH) / 2 + pan.y,
      width: imgW,
      height: imgH,
    };
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="bg-white rounded-none sm:rounded-xl shadow-2xl flex flex-col max-w-6xl w-full h-full sm:w-[95vw] sm:h-[90vh]">
        {/* Header */}
        <div className="px-3 sm:px-5 py-2 sm:py-3 border-b flex items-center justify-between flex-shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm sm:text-base font-semibold text-gray-800">Select pattern area</h2>
            <p className="text-[10px] text-gray-500 mt-0.5 sm:hidden">
              Draw to select, drag to move, pinch to zoom
            </p>
            <p className="text-xs text-gray-500 mt-0.5 hidden sm:block">
              Draw a rectangle to select. Drag to move. Scroll to zoom. Alt+drag to pan.
            </p>
          </div>
          <span className="text-[10px] sm:text-xs text-gray-400 font-mono ml-2">{gridCols}×{gridRows}</span>
        </div>

        {/* Image area */}
        <div
          ref={containerRef}
          className="relative flex-1 min-h-0 mx-2 sm:mx-5 mt-2 sm:mt-4 mb-2 overflow-hidden rounded-lg border border-gray-200 bg-gray-900 select-none touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          style={{ touchAction: 'none' }}
        >
          {/* Image */}
          <img
            ref={imgRef}
            src={imageSrc}
            alt="Pattern"
            className="pointer-events-none"
            style={{
              ...imgStyle,
              imageRendering: zoom > 3 ? 'pixelated' : 'auto',
            }}
            onLoad={handleImageLoad}
            draggable={false}
          />

          {/* Dark overlay + selection */}
          {selectionStyle && (
            <>
              <div
                className="absolute pointer-events-none bg-black/50"
                style={{ left: 0, top: 0, right: 0, height: Math.max(0, selectionStyle.top) }}
              />
              <div
                className="absolute pointer-events-none bg-black/50"
                style={{
                  left: 0,
                  top: selectionStyle.top + selectionStyle.height,
                  right: 0,
                  bottom: 0,
                }}
              />
              <div
                className="absolute pointer-events-none bg-black/50"
                style={{
                  left: 0,
                  top: selectionStyle.top,
                  width: Math.max(0, selectionStyle.left),
                  height: selectionStyle.height,
                }}
              />
              <div
                className="absolute pointer-events-none bg-black/50"
                style={{
                  left: selectionStyle.left + selectionStyle.width,
                  top: selectionStyle.top,
                  right: 0,
                  height: selectionStyle.height,
                }}
              />

              {/* Selection border */}
              <div
                className="absolute pointer-events-none border-2 border-blue-400"
                style={selectionStyle}
              />

              {/* Canvas overlay for bead circles + grid lines */}
              <canvas
                ref={overlayCanvasRef}
                className="absolute pointer-events-none"
                style={{
                  left: selectionStyle.left,
                  top: selectionStyle.top,
                  width: selectionStyle.width,
                  height: selectionStyle.height,
                }}
              />

              {/* Size label */}
              <div
                className="absolute pointer-events-none text-[10px] font-mono text-white bg-blue-500/80 px-1.5 py-0.5 rounded-sm"
                style={{
                  left: selectionStyle.left,
                  top: selectionStyle.top - 18,
                }}
              >
                {gridCols}×{gridRows}
              </div>
            </>
          )}
        </div>

        {/* Controls bar */}
        <div className="px-3 sm:px-5 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4 flex-shrink-0 border-t sm:border-t-0">
          <button
            onClick={handleAutoFit}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium sm:flex-shrink-0"
          >
            Auto-fit
          </button>
          <div className="flex items-center gap-2 flex-1">
            <span className="text-[10px] sm:text-xs text-gray-500">Zoom</span>
            <input
              type="range"
              min={0.5}
              max={10}
              step={0.1}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 sm:max-w-48"
            />
            <span className="text-[10px] sm:text-xs text-gray-600 font-mono w-8 sm:w-10">
              {zoom.toFixed(1)}x
            </span>
          </div>
          <div className="flex gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={!imageLoaded || !hasPreview}
              className="flex-1 sm:flex-initial px-3 sm:px-4 py-2 rounded text-xs sm:text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
