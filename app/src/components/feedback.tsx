import { Loader2, WifiOff } from "lucide-react";

export function LoadingRows({ count }: { count: number }) {
  return (
    <div aria-label="Cargando" role="status">
      {Array.from({ length: count }, (_, index) => (
        <div className="qc-people-row" key={index}>
          <div className="cover skeleton" />
          <div className="row-copy">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function LoadError({ retry }: { retry: () => void }) {
  return (
    <div className="load-error">
      <WifiOff size={40} strokeWidth={1.5} />
      <strong>No pudimos cargar</strong>
      <button className="primary-button qc-press" onClick={retry}>
        Reintentar
      </button>
    </div>
  );
}

export function LoadingPage() {
  return (
    <div className="empty-state">
      <Loader2 className="spin" size={40} aria-label="Cargando" />
    </div>
  );
}
