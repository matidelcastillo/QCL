import { useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { SheetVisibility } from "./sheet-visibility";

export function SheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <SheetVisibility.Provider value={{ open, setOpen }}>{children}</SheetVisibility.Provider>;
}
export function Sheet({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const { setOpen } = useContext(SheetVisibility);
  useEffect(() => {
    setOpen(true);
    return () => setOpen(false);
  }, [setOpen]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
      if (event.key !== "Tab" || !sheet.current) return;
      const controls = [
        ...sheet.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([disabled]),a[href]",
        ),
      ];
      if (!controls.length) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener("keydown", handler);
    sheet.current?.focus();
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={sheet}
        className="drawer-surface"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onTouchStart={(event) => {
          startY.current = event.touches[0]?.clientY ?? null;
        }}
        onTouchEnd={(event) => {
          if (
            startY.current != null &&
            (event.changedTouches[0]?.clientY ?? 0) - startY.current > 100 &&
            event.currentTarget.scrollTop === 0
          )
            onClose();
          startY.current = null;
        }}
      >
        <span className="drawer-handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
