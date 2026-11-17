import { useEffect, useRef, useState } from "react";
import {
  SKELETON_MIN_VISIBLE_MS,
  SKELETON_SHOW_AFTER_MS,
  nextDeferredPending,
} from "./deferred-pending";

export function useDeferredPending(
  pending: boolean,
  showAfter = SKELETON_SHOW_AFTER_MS,
  minVisible = SKELETON_MIN_VISIBLE_MS,
): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    const next = nextDeferredPending(
      pending,
      visible,
      shownAt.current,
      Date.now(),
      showAfter,
      minVisible,
    );
    if (next.delay == null) {
      shownAt.current = next.shownAt;
      if (next.visible !== visible) setVisible(next.visible);
      return;
    }
    const timer = window.setTimeout(() => {
      const after = nextDeferredPending(
        pending,
        visible,
        shownAt.current,
        Date.now(),
        showAfter,
        minVisible,
      );
      /* The delay elapsed: show or hide without scheduling again. */
      if (pending && !visible) {
        shownAt.current = Date.now();
        setVisible(true);
        return;
      }
      if (!pending && visible) {
        shownAt.current = null;
        setVisible(false);
        return;
      }
      shownAt.current = after.shownAt;
      if (after.visible !== visible) setVisible(after.visible);
    }, next.delay);
    return () => window.clearTimeout(timer);
  }, [pending, visible, showAfter, minVisible]);

  return visible;
}
