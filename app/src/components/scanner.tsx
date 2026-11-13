import { useCallback, useEffect, useRef, useState } from "react";
import { BarcodeFormat, BrowserMultiFormatReader, DecodeHintType } from "@zxing/library";
import { Flashlight, FlashlightOff, X, ZoomIn } from "lucide-react";
import { normalizeIsbn } from "../domain/isbn";
import { buttonClass } from "./button";
import { Sheet } from "./sheet";

type Detector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type DetectorConstructor = new (options: { formats: string[] }) => Detector;
type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  zoom?: { min: number; max: number };
};

export function Scanner({
  onClose,
  onFound,
}: {
  onClose: () => void;
  onFound: (isbn: string) => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const frame = useRef<number | null>(null);
  const accepted = useRef(false);
  const [manual, setManual] = useState("");
  const [noCamera, setNoCamera] = useState(false);
  const [torch, setTorch] = useState(false);
  const [canTorch, setCanTorch] = useState(false);
  const [canZoom, setCanZoom] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState("");
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  const stop = useCallback(() => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
    codeReader.current?.reset();
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
    let alive = true;
    async function start() {
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (!alive) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = media;
        const element = video.current;
        if (!element) return;
        element.srcObject = media;
        await element.play();
        const track = media.getVideoTracks()[0];
        const caps = track.getCapabilities?.() as CameraCapabilities | undefined;
        setCanTorch(Boolean(caps?.torch));
        setCanZoom(Boolean(caps?.zoom));
        const NativeDetector = (window as Window & { BarcodeDetector?: DetectorConstructor })
          .BarcodeDetector;
        if (NativeDetector) {
          const detector = new NativeDetector({ formats: ["ean_13", "ean_8", "upc_a"] });
          const scan = async () => {
            if (!alive || accepted.current) return;
            try {
              for (const result of await detector.detect(element)) found(result.rawValue);
            } catch {
              /* Keep scanning. */
            }
            frame.current = requestAnimationFrame(() => void scan());
          };
          frame.current = requestAnimationFrame(() => void scan());
        } else {
          const hints = new Map([
            [
              DecodeHintType.POSSIBLE_FORMATS,
              [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A],
            ],
          ]);
          const reader = new BrowserMultiFormatReader(hints);
          codeReader.current = reader;
          await reader.decodeFromVideoElementContinuously(element, (result) => {
            if (result) found(result.getText());
          });
        }
      } catch {
        if (alive) setNoCamera(true);
      }
    }
    void start();
    return () => {
      alive = false;
      stop();
    };
  }, [found, stop]);

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
      <div className="drawer-body drawer-body-enter stack">
        {noCamera ? (
          <p className="scanner-note">Sin cámara. Escribí el ISBN.</p>
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
            <span className="scanner-guide" aria-hidden="true" />
          </div>
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
        <form
          className="stack"
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
          <button type="submit" className={buttonClass("primary", true)}>
            Buscar
          </button>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
        </form>
      </div>
    </Sheet>
  );
}
