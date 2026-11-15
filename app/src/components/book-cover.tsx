import { useState } from "react";
import { coverParams } from "../domain/cover-url";

type CoverSize = "row" | "large" | "tile";

/* Cover served through /api/tapa. Reveal = QC .qc-card-image / .drawer-media-fade.
   Sizes: row thumbnail, sheet hero (large), grid tile (fills its card). */
export function BookCover({
  url,
  isbn,
  size = "row",
}: {
  url?: string | null;
  isbn?: string | null;
  size?: CoverSize;
}) {
  const [failed, setFailed] = useState(false);
  const params = coverParams(url, isbn);
  const candidate = params.size > 0;
  /* The 2:3 slot always renders with the fallback fill; the image fades in
     over it, so a slow or missing cover never collapses the row. */
  return (
    <span
      aria-hidden="true"
      className={`cover cover-fallback${size === "row" ? "" : ` cover-${size}`}`}
    >
      {candidate && !failed && (
        <img
          className={`cover-image ${size === "large" ? "drawer-media-fade" : "qc-card-image"}`}
          src={`/api/tapa?${params}`}
          alt=""
          decoding="async"
          ref={(image) => {
            if (image?.complete && image.naturalWidth) image.classList.add("is-loaded");
          }}
          onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
