import { useEffect, useRef, useState } from "react";
import { coverParams } from "../domain/cover-url";
import { apiUrl } from "../data/api-base";

type CoverSize = "row" | "large" | "tile";

const RETRY_MS = [2000, 8000, 30000, 60000];
const loaded = new Map<string, string>();

async function loadCover(src: string, signal: AbortSignal) {
  const response = await fetch(src, { signal });
  if (response.status === 429 || response.status >= 500) return "retry" as const;
  if (!response.ok) return "miss" as const;
  return URL.createObjectURL(await response.blob());
}

/* Cover served through /api/tapa. Reveal = QC .qc-card-image / .drawer-media-fade.
   Sizes: row thumbnail, sheet hero (large), grid tile (fills its card).
   Only visible covers are requested. Hits are reused; 429s retry through the
   rate-limit window; a real miss keeps the fallback. */
export function BookCover({
  url,
  isbn,
  size = "row",
}: {
  url?: string | null;
  isbn?: string | null;
  size?: CoverSize;
}) {
  const host = useRef<HTMLSpanElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const params = coverParams(url, isbn);
  const key = params.toString();
  const request = key ? apiUrl(`/api/tapa?${params}`) : "";

  useEffect(() => {
    if (!key) return;
    const node = host.current;
    if (!node) return;
    let alive = true;
    let attempt = 0;
    let timer = 0;
    const ac = new AbortController();

    function show(image: string) {
      loaded.set(key, image);
      if (alive) setSrc(image);
    }

    async function load() {
      const cached = loaded.get(key);
      if (cached) {
        show(cached);
        return;
      }
      try {
        const result = await loadCover(request, ac.signal);
        if (!alive) return;
        if (result === "miss") {
          setSrc(null);
          return;
        }
        if (result === "retry") {
          if (attempt >= RETRY_MS.length) return;
          timer = window.setTimeout(() => {
            attempt += 1;
            void load();
          }, RETRY_MS[attempt]);
          return;
        }
        show(result);
      } catch {
        if (!alive || ac.signal.aborted) return;
        if (attempt >= RETRY_MS.length) return;
        timer = window.setTimeout(() => {
          attempt += 1;
          void load();
        }, RETRY_MS[attempt]);
      }
    }

    const start = () => void load();
    if (typeof IntersectionObserver === "undefined") {
      start();
      return () => {
        alive = false;
        ac.abort();
        window.clearTimeout(timer);
      };
    }
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      io.disconnect();
      start();
    });
    io.observe(node);
    return () => {
      alive = false;
      io.disconnect();
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [key, request]);

  /* The 2:3 slot always renders with the fallback fill; the image fades in
     over it, so a slow or missing cover never collapses the row. */
  return (
    <span
      ref={host}
      aria-hidden="true"
      className={`cover cover-fallback${size === "row" ? "" : ` cover-${size}`}`}
    >
      {src && (
        <img
          className={`cover-image ${size === "large" ? "drawer-media-fade" : "qc-card-image"}`}
          src={src}
          alt=""
          decoding="async"
          ref={(image) => {
            if (image?.complete && image.naturalWidth) image.classList.add("is-loaded");
          }}
          onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
        />
      )}
    </span>
  );
}
