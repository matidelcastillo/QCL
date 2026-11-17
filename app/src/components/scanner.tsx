import { useCallback, useEffect, useRef, useState } from "react";
import { Flashlight, FlashlightOff, ZoomIn } from "lucide-react";
import { normalizeIsbn } from "../domain/isbn";
import { guideCrop } from "../domain/scan-crop";
import { preloadReader, readBarcode } from "./barcode-reader";
import { buttonClass } from "./button";
import { nativeIsbnScannerAvailable, scanIsbnNative, stopNativeScan } from "./native-isbn-scan";
import {
  CAMERA_DENIED_MESSAGE,
  CAMERA_UNAVAILABLE_MESSAGE,
  createWebScanSession,
  NOT_ISBN_MESSAGE,
  type WebScanSession,
} from "./web-scan-session";

type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number };
  focusMode?: string[];
};

const SCAN_INTERVAL_MS = 120;

export function Scanner({
  onFound,
  isbn = "",
  onIsbnChange,
}: {
  onFound: (isbn: string) => void;
  isbn?: string;
  onIsbnChange?: (value: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const guide = useRef<HTMLSpanElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const session = useRef<WebScanSession | null>(null);
  const [draft, setDraft] = useState("");
  const [noCamera, setNoCamera] = useState(false);
  const [torch, setTorch] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [canZoom, setCanZoom] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [engine, setEngine] = useState<"pending" | "native" | "web" | "manual">("pending");
  const [attempt, setAttempt] = useState(0);
  const platform = useRef<"native" | "web" | null>(null);
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;
  const manual = onIsbnChange ? isbn : draft;

  const accept = useCallback((code: string) => {
    session.current?.stop();
    navigator.vibrate?.(50);
    onFoundRef.current(code);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void nativeIsbnScannerAvailable().then((native) => {
      if (cancelled) return;
      const next = native ? "native" : "web";
      platform.current = next;
      setEngine(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (engine !== "native") return;
    let cancelled = false;

    async function run() {
      setError("");
      setNoCamera(false);
      setCanRetry(false);
      const result = await scanIsbnNative();
      if (cancelled) return;
      if (result.status === "isbn") {
        accept(result.isbn);
        return;
      }
      setEngine("manual");
      if (result.status === "cancelled") return;
      setCanRetry(true);
      if (result.status === "invalid") setError(NOT_ISBN_MESSAGE);
      else if (result.status === "denied") setError(CAMERA_DENIED_MESSAGE);
      else setNoCamera(true);
    }

    void run();
    function onVisibility() {
      if (document.hidden) void stopNativeScan();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void stopNativeScan();
    };
  }, [engine, attempt, accept]);

  useEffect(() => {
    if (engine !== "web") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function clearTimer() {
      if (timer != null) clearTimeout(timer);
      timer = null;
    }

    const scan = createWebScanSession({
      getUserMedia: (constraints) => navigator.mediaDevices.getUserMedia(constraints),
      onStatus(status) {
        if (cancelled) return;
        if (status === "denied") {
          setNoCamera(true);
          setError(CAMERA_DENIED_MESSAGE);
          setCanRetry(true);
          return;
        }
        if (status === "unavailable") {
          setNoCamera(true);
          setError("");
          setCanRetry(true);
          return;
        }
        if (status === "running") {
          setNoCamera(false);
          setError("");
          setCanRetry(false);
          return;
        }
        if (status === "stopped") {
          setCanTorch(false);
          setCanZoom(false);
          setTorch(false);
        }
      },
      onStream(media) {
        stream.current = media;
        const element = video.current;
        if (element) element.srcObject = media;
        if (!media) {
          clearTimer();
          return;
        }
        const track = media.getVideoTracks()[0];
        const caps = track?.getCapabilities?.() as CameraCapabilities | undefined;
        if (caps?.focusMode?.includes("continuous"))
          void track
            .applyConstraints({
              advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
            })
            .catch(() => undefined);
        setCanTorch(Boolean(caps?.torch));
        setCanZoom(Boolean(caps?.zoom));
        void element?.play().catch(() => undefined);
      },
      onFound(code) {
        if (cancelled) return;
        accept(code);
      },
      onInvalid() {
        if (!cancelled) setError(NOT_ISBN_MESSAGE);
      },
    });
    session.current = scan;
    preloadReader();
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    async function tick() {
      const element = video.current;
      const box = guide.current;
      if (element && box && context && element.videoWidth > 0) {
        const crop = guideCrop(
          { width: element.videoWidth, height: element.videoHeight },
          element.getBoundingClientRect(),
          box.getBoundingClientRect(),
        );
        if (crop.width > 0 && crop.height > 0) {
          const generation = scan.generation();
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
          try {
            const read = await readBarcode(context.getImageData(0, 0, crop.width, crop.height));
            scan.ingest(read, generation);
          } catch {
            if (!cancelled) {
              scan.stop();
              setNoCamera(true);
              setCanRetry(true);
              return;
            }
          }
        }
      }
      if (!cancelled) timer = setTimeout(() => void tick(), SCAN_INTERVAL_MS);
    }

    function onVisibility() {
      scan.handleVisibility(document.hidden);
    }

    document.addEventListener("visibilitychange", onVisibility);
    void scan.start().then(() => {
      if (!cancelled) void tick();
    });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      clearTimer();
      scan.stop();
      session.current = null;
      stream.current = null;
    };
  }, [engine, attempt, accept]);

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

  function setManual(value: string) {
    if (onIsbnChange) onIsbnChange(value);
    else setDraft(value);
    setError("");
  }

  function retry() {
    const next = platform.current ?? "web";
    setError("");
    setNoCamera(false);
    setCanRetry(false);
    setEngine(next);
    setAttempt((current) => current + 1);
  }

  return (
    <div className="stack scanner-body">
      {engine === "web" && !noCamera && (
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
      {noCamera && !error && <p className="scanner-note">{CAMERA_UNAVAILABLE_MESSAGE}</p>}
      <form
        className="scanner-manual"
        onSubmit={(event) => {
          event.preventDefault();
          const code = normalizeIsbn(manual);
          if (code) accept(code);
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
          onChange={(event) => setManual(event.target.value)}
        />
        <button type="submit" className={buttonClass("primary")}>
          Buscar
        </button>
      </form>
      {canRetry && (
        <button type="button" className="text-action" onClick={retry}>
          Escanear de nuevo
        </button>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {(canTorch || canZoom) && (
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
        </div>
      )}
    </div>
  );
}
