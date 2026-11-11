import { useEffect, useState } from "react";
import { extractCoverPalette, NEUTRAL_PALETTE, type CoverPalette } from "@/lib/cover-colors";

export function useCoverPalette(src: string | null): CoverPalette {
  const [palette, setPalette] = useState<CoverPalette>(NEUTRAL_PALETTE);

  useEffect(() => {
    if (!src) {
      setPalette(NEUTRAL_PALETTE);
      return;
    }

    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    if (/^https?:/i.test(src)) image.crossOrigin = "anonymous";

    image.onload = () => {
      if (cancelled) return;
      try {
        setPalette(extractCoverPalette(image) ?? NEUTRAL_PALETTE);
      } catch {
        setPalette(NEUTRAL_PALETTE);
      }
    };
    image.onerror = () => {
      if (!cancelled) setPalette(NEUTRAL_PALETTE);
    };
    image.src = src;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [src]);

  return palette;
}
