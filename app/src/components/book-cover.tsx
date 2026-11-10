import { useState } from "react";
import { revealFadeImg } from "@/lib/image-fade";

export function BookCover({
  url,
  title,
  className = "",
}: {
  url: string | null | undefined;
  title: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = Boolean(url) && !broken;

  return (
    <div className={`qcl-cover ${className}`.trim()} aria-hidden="true">
      {showImage ? (
        <img
          src={url!}
          alt=""
          loading="lazy"
          className="qc-grid-image-fade qcl-cover-img"
          ref={(element) => revealFadeImg(element)}
          onLoad={(event) => event.currentTarget.classList.add("is-loaded")}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="qcl-cover-fallback">{title.trim().slice(0, 1).toUpperCase() || "L"}</span>
      )}
    </div>
  );
}
