import { useCallback, useEffect, useRef, useState } from "react";
import { Flashlight, FlashlightOff, X, ZoomIn } from "lucide-react";
import { normalizeIsbn } from "../domain/isbn";
import { guideCrop } from "../domain/scan-crop";
import { preloadReader, readIsbn } from "./barcode-reader";
import { buttonClass } from "./button";
import { Sheet } from "./sheet";
import { nativeIsbnScannerAvailable, scanIsbnNative, stopNativeScan } from "./native-isbn-scan";

type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number };
  focusMode?: string[];
};

const SCAN_INTERVAL_MS = 120;

export function Scanner({
  onClose,
  onFound,
}: {
  onClose: () => void;
  onFound: (isbn: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const guide = useRef<HTMLSpanElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accepted = useRef(false);
  const [manual, setManual] = useState("");
  const [noCamera, setNoCamera] = useState(false);
  const [torch, setTorch] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [canZoom, setCanZoom] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [engine, setEngine] = useState<"pending" | "native" | "web" | "manual">("pending");
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  const stop = useCallback(() => {
    if (timer.current != null) clearTimeout(timer.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }, []);

  const found = useCallback(
    (raw: string) => {
      const isbn = normalizeIsbn(raw);
      if (!isbn || accepted.current) return;
      accepted.current = true;
      navigator.vibrate?.(50);
      stop();
      onFoundRef.current(isbn);
    },
    [stop],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!(await nativeIsbnScannerAvailable())) {
        if (!cancelled) setEngine("web");
        return;
      }
      if (!cancelled) setEngine("native");
      try {
        const isbn = await scanIsbnNative();
        if (cancelled) return;
        if (isbn) {
          onFoundRef.current(isbn);
          return;
        }
      } catch {
        /* Fall back to typing, same as a missing camera. */
      }
      if (!cancelled) {
        setNoCamera(true);
        setEngine("manual");
      }
    })();
    return () => {
      cancelled = true;
      void stopNativeScan();
    };
  }, []);

  useEffect(() => {
    if (engine !== "web") return;
    let alive = true;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    /* Decodes only the guide area, then schedules the next frame. */
    async function scan(element: HTMLVideoElement) {
      const box = guide.current;
      if (!alive || accepted.current) return;
      if (context && box && element.videoWidth > 0) {
        const crop = guideCrop(
          { width: element.videoWidth, height: element.videoHeight },
          element.getBoundingClientRect(),
          box.getBoundingClientRect(),
        );
        canvas.width = crop.width;
        canvas.height = crop.height;
        context.drawImage(
          element,
          crop.x,
          crop.y,
          crop.width,
          crop.height,
          0,
          0,
          crop.width,
          crop.height,
        );
        const isbn = await readIsbn(context.getImageData(0, 0, crop.width, crop.height));
        if (isbn) found(isbn);
      }
      if (alive && !accepted.current)
        timer.current = setTimeout(() => void scan(element).catch(noReader), SCAN_INTERVAL_MS);
    }

    /* No camera or no decoder: release the camera and fall back to typing. */
    function noReader() {
      stop();
      if (alive) setNoCamera(true);
    }

    async function start() {
      preloadReader();
      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (!alive) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const track = media.getVideoTracks()[0];
      const caps = track.getCapabilities?.() as CameraCapabilities | undefined;
      /* Continuous autofocus where the browser exposes it (Android); iOS focuses on its own. */
      if (caps?.focusMode?.includes("continuous"))
        await track
          .applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] })
          .catch(() => undefined);
      setCanTorch(Boolean(caps?.torch));
      setCanZoom(Boolean(caps?.zoom));
      const element = video.current;
      if (!element) return;
      element.srcObject = media;
      await element.play();
      await scan(element);
    }

    start().catch(noReader);
    return () => {
      alive = false;
      stop();
    };
  }, [engine, found, stop]);

  async function toggleTorch() {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setCanTorch(false);
    }
  }

  async function nextZoom() {
    const track = stream.current?.getVideoTracks()[0];
    const cap = (track?.getCapabilities?.() as CameraCapabilities | undefined)?.zoom;
    if (!track || !cap) return;
    const next = zoom < 2 ? Math.min(2, cap.max) : zoom < cap.max ? cap.max : 1;
    try {
      await track.applyConstraints({ advanced: [{ zoom: next } as MediaTrackConstraintSet] });
      setZoom(next);
    } catch {
      setCanZoom(false);
    }
  }

  return (
    <Sheet onClose={onClose} label="Escanear">
      <div className="drawer-body drawer-body-enter stack scanner-body">
        {noCamera || engine !== "web" ? (
          engine !== "pending" && engine !== "native" ? (
            <p className="scanner-note">Sin cámara. Escribí el ISBN.</p>
          ) : null
        ) : (
          <div className="scanner-frame">
            <video
              ref={video}
              className="scanner-video"
              muted
              playsInline
              autoPlay
              aria-label="Cámara"
            />
            <span ref={guide} className="scanner-guide" aria-hidden="true" />
          </div>
        )}
        <form
          className="scanner-manual"
          onSubmit={(event) => {
            event.preventDefault();
            const isbn = normalizeIsbn(manual);
            if (isbn) found(isbn);
            else setError("ISBN inválido.");
          }}
        >
          <input
            className="qc-auth-email-input"
            inputMode="numeric"
            enterKeyHint="search"
            placeholder="ISBN"
            aria-label="ISBN"
            autoComplete="off"
            value={manual}
            onChange={(event) => {
              setManual(event.target.value);
              setError("");
            }}
          />
          <button type="submit" className={buttonClass("primary")}>
            Buscar
          </button>
        </form>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <div className="drawer-action-dock">
          {canTorch && (
            <button
              type="button"
              className="drawer-action"
              aria-label={torch ? "Apagar linterna" : "Prender linterna"}
              aria-pressed={torch}
              onClick={() => void toggleTorch()}
            >
              {torch ? (
                <FlashlightOff className="drawer-action-icon" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Flashlight className="drawer-action-icon" strokeWidth={2} aria-hidden="true" />
              )}
            </button>
          )}
          {canZoom && (
            <button
              type="button"
              className="drawer-action"
              aria-label="Zoom"
              onClick={() => void nextZoom()}
            >
              <ZoomIn className="drawer-action-icon" strokeWidth={2} aria-hidden="true" />
            </button>
          )}
          <button type="button" className="drawer-action" aria-label="Cerrar" onClick={onClose}>
            <X className="drawer-action-icon" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </Sheet>
  );
}
