import type { ReactNode } from "react";
import { Loader2, WifiOff } from "lucide-react";
import { buttonClass } from "./button";

export { LoadingRows } from "./skeleton";

/* QC components/home/HomeFeedback.tsx: LoadError. */
export function LoadError({ retry }: { retry: () => void }) {
  return (
    <div className="qc-feedback" role="alert">
      <WifiOff className="qc-feedback-icon" size={40} strokeWidth={1.5} aria-hidden="true" />
      <p className="qc-feedback-title">No pudimos cargar</p>
      <button type="button" className={buttonClass("primary")} onClick={retry}>
        Reintentar
      </button>
    </div>
  );
}

/* QC routes/index.tsx l. 2405-2440: empty state (GIF + 15/600 grey text). */
export function EmptyState({
  text,
  art = false,
  children,
}: {
  text: string;
  art?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="qc-feedback qc-empty">
      {art && <img className="qc-empty-art" src="/empty-state.gif" alt="" aria-hidden="true" />}
      <p className="qc-feedback-text">{text}</p>
      {children}
    </div>
  );
}

/* QC routes/index.tsx l. 2470-2478: Loader2 while a screen loads. */
export function LoadingPage() {
  return (
    <div className="qc-loader" role="status" aria-label="Cargando">
      <Loader2 className="spin" size={22} aria-hidden="true" />
    </div>
  );
}
