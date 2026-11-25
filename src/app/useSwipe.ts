import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';

const MIN_DISTANCE = 60;
/** How long the page takes to slide out before the next one appears. */
export const SLIDE_MS = 180;

export type SlideFrom = 'left' | 'right';

/**
 * Which side the next page should slide in from. Set just before navigating between accounts
 * and read once by the page that mounts, so it can animate in from that side.
 */
let enterFrom: SlideFrom | null = null;

export function slideNextFrom(side: SlideFrom): void {
  enterFrom = side;
}

/** The side to slide in from, once (then cleared). */
export function takeSlideIn(): SlideFrom | null {
  const side = enterFrom;
  enterFrom = null;
  return side;
}

function reducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Horizontal swipe for touch and pen (mouse users get buttons and arrow keys). The element
 * follows the finger; past the threshold it slides off and the action runs, otherwise it springs
 * back. Spread `handlers` on the element and apply `style` to it.
 */
export function useSwipe({ onLeft, onRight }: { onLeft?: () => void; onRight?: () => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<SlideFrom | null>(null);

  const finish = (side: SlideFrom, action: () => void) => {
    // The next page comes in from the opposite side.
    slideNextFrom(side === 'left' ? 'right' : 'left');
    if (reducedMotion()) {
      action();
      return;
    }
    setLeaving(side);
    setTimeout(action, SLIDE_MS);
  };

  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      start.current = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
    },
    onPointerMove: (e: PointerEvent) => {
      const from = start.current;
      if (!from) return;
      const moveX = e.clientX - from.x;
      const moveY = e.clientY - from.y;
      if (!dragging && Math.abs(moveX) < 8) return;
      if (!dragging && Math.abs(moveX) < Math.abs(moveY)) {
        start.current = null; // a vertical scroll, not a swipe
        return;
      }
      setDragging(true);
      // Resist when there's no account that way.
      const allowed = moveX < 0 ? onLeft : onRight;
      setDx(allowed ? moveX : moveX * 0.25);
    },
    onPointerUp: (e: PointerEvent) => {
      const from = start.current;
      start.current = null;
      setDragging(false);
      setDx(0);
      if (!from) return;
      const moveX = e.clientX - from.x;
      const moveY = e.clientY - from.y;
      // Mostly horizontal and long enough, so vertical scrolling never triggers it.
      if (Math.abs(moveX) < MIN_DISTANCE || Math.abs(moveX) < Math.abs(moveY) * 1.5) return;
      if (moveX < 0 && onLeft) finish('left', onLeft);
      else if (moveX > 0 && onRight) finish('right', onRight);
    },
    onPointerCancel: () => {
      start.current = null;
      setDragging(false);
      setDx(0);
    },
  };

  // No transform at rest: a transform would make fixed-position children (the Update button,
  // popups) position against this element instead of the screen.
  const style: CSSProperties = leaving
    ? {
        transform: `translateX(${leaving === 'left' ? '-' : ''}100%)`,
        opacity: 0,
        transition: `transform ${String(SLIDE_MS)}ms ease-in, opacity ${String(SLIDE_MS)}ms ease-in`,
      }
    : dx !== 0
      ? { transform: `translateX(${String(dx)}px)`, transition: dragging ? 'none' : undefined }
      : { transition: 'transform 200ms ease-out' };

  return { handlers, style };
}
