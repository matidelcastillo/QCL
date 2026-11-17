export const SKELETON_SHOW_AFTER_MS = 150;
export const SKELETON_MIN_VISIBLE_MS = 150;

export type DeferredPending = {
  visible: boolean;
  shownAt: number | null;
  delay: number | null;
};

/* First paint waits `showAfter` so a fast response never flashes a
   skeleton. Once shown, it stays up for `minVisible` so it does not flicker. */
export function nextDeferredPending(
  pending: boolean,
  visible: boolean,
  shownAt: number | null,
  now: number,
  showAfter = SKELETON_SHOW_AFTER_MS,
  minVisible = SKELETON_MIN_VISIBLE_MS,
): DeferredPending {
  if (pending) {
    if (visible) return { visible: true, shownAt, delay: null };
    return { visible: false, shownAt: null, delay: showAfter };
  }
  if (!visible) return { visible: false, shownAt: null, delay: null };
  const wait = Math.max(0, minVisible - (now - (shownAt ?? now)));
  if (wait === 0) return { visible: false, shownAt: null, delay: null };
  return { visible: true, shownAt, delay: wait };
}
