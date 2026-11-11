"use client";

import { useEffect, useState } from "react";

/**
 * True once the element comes within `margin` of the viewport (and stays true). Used to load heavy widgets,
 * such as a WebGL map, only when they are about to be seen. Returns a callback ref, so it also works for
 * elements that mount later.
 */
export function useNearViewport<T extends Element>(margin = "400px"): [(el: T | null) => void, boolean] {
  const [el, setEl] = useState<T | null>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (!el || near) return;
    if (typeof IntersectionObserver === "undefined") return setNear(true);
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setNear(true), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, [el, margin, near]);
  return [setEl, near];
}
