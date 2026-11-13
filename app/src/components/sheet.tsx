import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";
import { SheetVisibility } from "./sheet-visibility";

export function SheetProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <SheetVisibility.Provider value={{ open, setOpen }}>{children}</SheetVisibility.Provider>;
}

const DRAG_CLOSE_RATIO = 0.25;

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/* QC routes/index.tsx l. 2690-2760: backdrop + .drawer-surface sliding with
   --dur-drawer / --ease-press, handle on top, drag down or Escape to close. */
export function Sheet({
  children,
  onClose,
  label,
}: {
  children: ReactNode;
  onClose: () => void;
  label: string;
}) {
  const surface = useRef<HTMLDivElement>(null);
  const dragStart = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [visible, setVisible] = useState(false);
  const { setOpen } = useContext(SheetVisibility);

  const close = useCallback(() => {
    if (prefersReducedMotion()) onCloseRef.current();
    else setVisible(false);
  }, []);

  useEffect(() => {
    setOpen(true);
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(frame);
      setOpen(false);
    };
  }, [setOpen]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab" || !surface.current) return;
      const controls = [
        ...surface.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]),input:not([disabled]),a[href]",
        ),
      ];
      if (!controls.length) return;
      if (event.shiftKey && document.activeElement === controls[0]) {
        event.preventDefault();
        controls.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === controls.at(-1)) {
        event.preventDefault();
        controls[0].focus();
      }
    };
    document.addEventListener("keydown", onKey);
    surface.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [close]);

  function onDragEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null || !surface.current) return;
    const distance = event.clientY - dragStart.current;
    dragStart.current = null;
    if (distance > surface.current.offsetHeight * DRAG_CLOSE_RATIO) close();
  }

  return (
    <>
      <div className={`drawer-backdrop${visible ? " is-visible" : ""}`} onClick={close} />
      <div
        ref={surface}
        className={`drawer-surface${visible ? " is-visible" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onTransitionEnd={(event) => {
          if (event.target === event.currentTarget && !visible) onCloseRef.current();
        }}
      >
        <div
          className="drawer-handle-zone"
          onPointerDown={(event) => {
            dragStart.current = event.clientY;
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerUp={onDragEnd}
          onPointerCancel={() => {
            dragStart.current = null;
          }}
        >
          <div className="drawer-handle" />
        </div>
        {children}
      </div>
    </>
  );
}
