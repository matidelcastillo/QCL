import { useState } from "react";
import { coverCandidate } from "../domain/cover-url";

/* Cover served through /api/tapa. Reveal = QC .qc-card-image / .drawer-media-fade. */
export function BookCover({
  url,
  isbn,
  large = false,
}: {
  url?: string | null;
  isbn?: string | null;
  large?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const candidate = coverCandidate(url, isbn);
  const params = new URLSearchParams({ u: candidate ?? "" });
  if (isbn) params.set("isbn", isbn);
  /* The 2:3 slot always renders with the fallback fill; the image fades in
     over it, so a slow or missing cover never collapses the row. */
  return (
    <span aria-hidden="true" className={`cover cover-fallback${large ? " cover-large" : ""}`}>
      {candidate && !failed && (
        <img
          className={`cover-image ${large ? "drawer-media-fade" : "qc-card-image"}`}
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
