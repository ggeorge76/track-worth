import { useRef, type PointerEvent } from 'react';

const MIN_DISTANCE = 60;

/**
 * Horizontal swipe detection for touch and pen (mouse users get buttons and arrow keys).
 * Returns pointer handlers to spread on the swipeable element.
 */
export function useSwipe({ onLeft, onRight }: { onLeft?: () => void; onRight?: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: PointerEvent) => {
      start.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const dx = e.clientX - from.x;
      const dy = e.clientY - from.y;
      // Mostly horizontal and long enough, so vertical scrolling never triggers it.
      if (Math.abs(dx) < MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      if (dx < 0) onLeft?.();
      else onRight?.();
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}
