import type { ReactNode } from "react";

/* Shared loading placeholders: same shapes, sizes and gaps as the real
   list rows, cover grid, profile counts, book sheet and form fields. */

export function SkeletonRow() {
  return (
    <div className="qc-people-row" aria-hidden="true">
      <div className="cover shimmer" />
      <div className="row-copy">
        <div className="shimmer shimmer-line" />
        <div className="shimmer shimmer-line-short" />
        <div className="shimmer shimmer-line-meta" />
      </div>
    </div>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando">
      {children}
    </div>
  );
}

export function LoadingRows({ count }: { count: number }) {
  return (
    <Status>
      {Array.from({ length: count }, (_, index) => (
        <SkeletonRow key={index} />
      ))}
    </Status>
  );
}

/* Home list: genre labels + rows, same .feed-group rhythm as the loaded feed. */
export function LoadingList({ groups = [3, 2] }: { groups?: number[] }) {
  return (
    <Status>
      {groups.map((count, index) => (
        <section className="feed-group" key={index} aria-hidden="true">
          <div className="feed-group-label">
            <div className="shimmer shimmer-label" />
          </div>
          {Array.from({ length: count }, (_, row) => (
            <SkeletonRow key={row} />
          ))}
        </section>
      ))}
    </Status>
  );
}

/* Same 3-column .book-grid and 2:3 .book-tile as home and Gilada. */
export function LoadingTiles({ count }: { count: number }) {
  return (
    <div className="book-grid" role="status" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: count }, (_, index) => (
        <div className="book-tile media-card-treatment-compact" key={index} aria-hidden="true">
          <span className="cover cover-tile shimmer" />
        </div>
      ))}
    </div>
  );
}

/* Vos: the two counters, then a last-read row. */
export function LoadingCounts() {
  return (
    <Status>
      <div className="count-row" aria-hidden="true">
        <div className="count-block">
          <div className="shimmer shimmer-count" />
          <div className="shimmer shimmer-line-short" />
        </div>
        <div className="count-block">
          <div className="shimmer shimmer-count" />
          <div className="shimmer shimmer-line-short" />
        </div>
      </div>
      <section aria-hidden="true">
        <div className="section-label">
          <div className="shimmer shimmer-label" />
        </div>
        <SkeletonRow />
      </section>
    </Status>
  );
}

/* Escanear catalog lookup: the book-sheet hero and title block. */
export function LoadingSheet() {
  return (
    <div
      className="drawer-body drawer-centered"
      role="status"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="drawer-hero-book" aria-hidden="true">
        <div className="cover cover-large shimmer" />
      </div>
      <div className="shimmer shimmer-line shimmer-sheet-title" aria-hidden="true" />
      <div className="shimmer shimmer-line-short shimmer-sheet-meta" aria-hidden="true" />
    </div>
  );
}

/* /clave: password field and full-width button. */
export function LoadingForm() {
  return (
    <div className="stack" role="status" aria-busy="true" aria-label="Cargando">
      <div className="shimmer shimmer-input" aria-hidden="true" />
      <div className="shimmer shimmer-button" aria-hidden="true" />
    </div>
  );
}
