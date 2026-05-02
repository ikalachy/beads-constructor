import { useCallback, useRef, useState } from 'react';

interface TransformState {
  offset: { x: number; y: number };
  scale: number;
}

export function useImageTransform() {
  const [transform, setTransform] = useState<TransformState>({
    offset: { x: 0, y: 0 },
    scale: 1,
  });
  const [isDragging, setIsDragging] = useState(false);
  const lastPointer = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    setIsDragging(true);
    lastPointer.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging || !lastPointer.current) return;
      const dx = e.clientX - lastPointer.current.x;
      const dy = e.clientY - lastPointer.current.y;
      lastPointer.current = { x: e.clientX, y: e.clientY };
      setTransform((prev) => ({
        ...prev,
        offset: { x: prev.offset.x + dx, y: prev.offset.y + dy },
      }));
    },
    [isDragging]
  );

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
    lastPointer.current = null;
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setTransform((prev) => {
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.min(4, Math.max(0.5, prev.scale + delta));
      return { ...prev, scale: newScale };
    });
  }, []);

  const setScale = useCallback((scale: number) => {
    setTransform((prev) => ({ ...prev, scale: Math.min(4, Math.max(0.5, scale)) }));
  }, []);

  const reset = useCallback(() => {
    setTransform({ offset: { x: 0, y: 0 }, scale: 1 });
  }, []);

  return {
    offset: transform.offset,
    scale: transform.scale,
    isDragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    setScale,
    reset,
  };
}
