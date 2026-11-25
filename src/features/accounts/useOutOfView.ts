import { useEffect, useRef, useState } from 'react';

/** The app header's height: 56 px plus the status bar on phones (safe-area inset). */
function headerHeight(): number {
  return document.querySelector('[data-app-header]')?.getBoundingClientRect().height || 56;
}

/**
 * True once the referenced element has scrolled up out of view (behind the app header). Used to
 * show a compact copy of the net worth while scrolling.
 */
export function useOutOfView<T extends Element>() {
  const ref = useRef<T>(null);
  const [outOfView, setOutOfView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const topOffset = headerHeight();
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Only "above the viewport" counts; below it (not reached yet) doesn't.
        if (entry) setOutOfView(!entry.isIntersecting && entry.boundingClientRect.top < topOffset);
      },
      { rootMargin: `-${String(topOffset)}px 0px 0px 0px` },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);
  return [ref, outOfView] as const;
}
