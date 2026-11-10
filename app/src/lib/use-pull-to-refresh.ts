import { useEffect, useRef, useState } from "react";

const PULL_THRESHOLD = 64;
const MAX_PULL = 90;
const DAMPING = 0.45;

// Por debajo de esto no se decide el eje todavía — jitter normal del dedo
// al apoyar, no alcanza para distinguir swipe horizontal de pull vertical.
const AXIS_LOCK_PX = 8;

/**
 * Pull-to-refresh a-la app nativa: solo se arma si el touchstart pasa con
 * window.scrollY === 0 (si no, es un scroll normal de la lista, no un pull).
 * Usa refs para el estado que lee onTouchEnd — si el hook re-suscribiera los
 * listeners en cada tick de pull (setState en touchmove dispara re-render
 * seguido), touchmove correría decenas de veces por segundo re-creando
 * listeners innecesariamente.
 *
 * Detección de eje: el listener de touchmove está en `window` (para
 * funcionar aunque el pull arranque en cualquier parte de la página), así
 * que sin esto un swipe horizontal dentro de un carrusel (.qc-hscroll)
 * competía con este handler — el delta vertical de un swipe horizontal
 * real casi nunca es exactamente 0, así que igual pisaba el scroll nativo
 * con preventDefault() y el carrusel se sentía trabado/lento al arrastrar
 * con el dedo. Ahora, hasta pasar AXIS_LOCK_PX, no se decide nada; una vez
 * que se decide, si domina el eje horizontal se aborta el pull entero y se
 * deja el gesto 100% al scroll nativo del contenedor.
 */
export function usePullToRefresh(onRefresh: () => Promise<unknown>) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullRef = useRef(0);
  const startY = useRef<number | null>(null);
  const startX = useRef<number | null>(null);
  const axisLocked = useRef<"vertical" | "horizontal" | null>(null);
  const draggingRef = useRef(false);
  const refreshingRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    const setPullBoth = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onTouchStart = (e: TouchEvent) => {
      // Un drag para cerrar un drawer/bottom sheet (arrastrar la foto hacia
      // abajo) también arranca en window.scrollY===0 — sin este guard, el
      // pull-to-refresh de la página de atrás se armaba en simultáneo con el
      // drag-to-close, mostrando el spinner de refresh detrás del drawer.
      // Todo drawer/sheet marca su overlay con data-no-ptr.
      const target = e.target as HTMLElement | null;
      if (window.scrollY > 0 || refreshingRef.current || target?.closest("[data-no-ptr]")) {
        startY.current = null;
        return;
      }
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      axisLocked.current = null;
      draggingRef.current = true;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current == null || startX.current == null || !draggingRef.current) return;
      const deltaY = e.touches[0].clientY - startY.current;
      const deltaX = e.touches[0].clientX - startX.current;
      if (axisLocked.current == null) {
        if (Math.abs(deltaX) < AXIS_LOCK_PX && Math.abs(deltaY) < AXIS_LOCK_PX) return;
        axisLocked.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
        if (axisLocked.current === "horizontal") {
          // Swipe horizontal real (ej. dentro de un .qc-hscroll): no es un
          // pull, no tocar nada más — el navegador maneja el scroll nativo.
          draggingRef.current = false;
          return;
        }
      }
      if (axisLocked.current === "horizontal") return;
      if (deltaY <= 0) {
        setPullBoth(0);
        return;
      }
      setPullBoth(Math.min(deltaY * DAMPING, MAX_PULL));
      if (e.cancelable) e.preventDefault();
    };
    const onTouchEnd = async () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      startY.current = null;
      if (pullRef.current >= PULL_THRESHOLD) {
        refreshingRef.current = true;
        setRefreshing(true);
        setPullBoth(PULL_THRESHOLD * 0.75);
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
          setPullBoth(0);
        }
      } else {
        setPullBoth(0);
      }
    };
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  return { pull, refreshing, threshold: PULL_THRESHOLD };
}
