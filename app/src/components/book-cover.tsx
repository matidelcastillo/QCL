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
  const size = large ? "cover cover-large" : "cover";
  if (!candidate || failed) return <div aria-hidden="true" className={`${size} cover-fallback`} />;
  const params = new URLSearchParams({ u: candidate });
  if (isbn) params.set("isbn", isbn);
  return (
    <img
      className={`${size} ${large ? "drawer-media-fade" : "qc-card-image"}`}
      src={`/api/tapa?${params}`}
      alt=""
      decoding="async"
      ref={(image) => {
        if (image?.complete && image.naturalWidth) image.classList.add("is-loaded");
      }}
      onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
      onError={() => setFailed(true)}
    />
  );
}
