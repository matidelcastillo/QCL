import { useCallback, useState } from "react";

export type CoverStatus = "ready" | "miss";

/* Library and Gilada wait to paint a row or tile until its cover has
   resolved. A miss still shows the book: it already belongs to someone.
   Search hides misses on purpose and does not use this helper. */
export function isCoverRevealed(status: Record<string, CoverStatus>, key: string): boolean {
  return status[key] === "ready" || status[key] === "miss";
}

export function useCoverStatus() {
  const [status, setStatus] = useState<Record<string, CoverStatus>>({});
  const report = useCallback((key: string, value: CoverStatus) => {
    setStatus((current) => (current[key] === value ? current : { ...current, [key]: value }));
  }, []);
  return { status, report };
}
