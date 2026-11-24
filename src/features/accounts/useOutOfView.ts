import { useEffect, useRef, useState } from 'react';

/**
 * True once the referenced element has scrolled up out of view (behind a header of
 * `topOffset` px). Used to show a compact copy of the net worth while scrolling.
 */
export function useOutOfView<T extends Element>(topOffset: number) {
  const ref = useRef<T>(null);
  const [outOfView, setOutOfView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
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
  }, [topOffset]);
  return [ref, outOfView] as const;
}
