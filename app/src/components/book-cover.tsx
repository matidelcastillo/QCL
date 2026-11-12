import { useState } from "react";
import { coverCandidate } from "../domain/cover-url";

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
  const params = new URLSearchParams();
  if (candidate) params.set("u", candidate);
  if (isbn) params.set("isbn", isbn);
  if (!candidate || failed)
    return <div aria-hidden="true" className={`cover cover-fallback${large ? " large" : ""}`} />;
  return (
    <img
      className={`cover qc-card-image${large ? " large" : ""}`}
      src={`/api/tapa?${params}`}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
