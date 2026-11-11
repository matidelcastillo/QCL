import { FormEvent, useEffect, useRef, useState } from "react";
import { cameraHasTorch, cameraZoomRange, setCameraTorch, setCameraZoom } from "@/lib/camera";
import { isbnFromBarcode } from "@/lib/isbn";

type DetectorResult = { rawValue?: string };

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<DetectorResult[]>;
};

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  const ctor = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

function zoomCrop(width: number, height: number, zoom: number) {
  const factor = Math.max(1, zoom);
  const cropWidth = Math.max(32, width / factor);
  const cropHeight = Math.max(16, height / factor);
  return {
    left: (width - cropWidth) / 2,
    top: (height - cropHeight) / 2,
    width: cropWidth,
    height: cropHeight,
  };
}

export function IsbnScanner({
  stream,
  onDetect,
  onClose,
}: {
  stream: MediaStream;
  onDetect: (isbn: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef(1);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [nativeZoom, setNativeZoom] = useState<{ min: number; max: number; step: number } | null>(
    null,
  );
  const stoppedRef = useRef(false);
  const detectedRef = useRef(false);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    setTorchAvailable(cameraHasTorch(stream));
    const range = cameraZoomRange(stream);
    if (range) setNativeZoom({ min: range.min, max: range.max, step: range.step });
  }, [stream]);

  useEffect(() => {
    const media = videoRef.current;
    const canvasEl = canvasRef.current;
    if (!media || !canvasEl) return;
    const video: HTMLVideoElement = media;
    const canvas: HTMLCanvasElement = canvasEl;
    let timer: number | undefined;
    let pass = 0;

    function finish(isbn: string) {
      if (detectedRef.current || stoppedRef.current) return;
      detectedRef.current = true;
      onDetect(isbn);
    }

    async function start() {
      try {
        video.srcObject = stream;
        await video.play();
        if (stoppedRef.current) return;

        const { decodeIsbnFromRgba } = await import("@/lib/barcode-decode");
        const Detector = getBarcodeDetector();
        const detector = Detector ? new Detector({ formats: ["ean_13", "ean_8", "upc_a"] }) : null;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          setError("No se pudo leer la cámara.");
          return;
        }

        const tick = async () => {
          if (stoppedRef.current || detectedRef.current) return;
          try {
            if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
              if (detector) {
                try {
                  const codes = await detector.detect(video);
                  for (const code of codes) {
                    const isbn = isbnFromBarcode(code.rawValue ?? "");
                    if (isbn) {
                      finish(isbn);
                      return;
                    }
                  }
                } catch {
                  // fall through to ZXing
                }
              }

              const crop = zoomCrop(video.videoWidth, video.videoHeight, zoomRef.current);
              canvas.width = Math.round(crop.width);
              canvas.height = Math.round(crop.height);
              context.drawImage(
                video,
                crop.left,
                crop.top,
                crop.width,
                crop.height,
                0,
                0,
                canvas.width,
                canvas.height,
              );
              const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
              const isbn = decodeIsbnFromRgba(pixels.data, pixels.width, pixels.height, {
                mode: "live",
                pass,
              });
              pass += 1;
              if (isbn) {
                finish(isbn);
                return;
              }
            }
          } catch {
            // keep scanning
          }
          timer = window.setTimeout(() => void tick(), 140);
        };
        void tick();
      } catch {
        if (!stoppedRef.current) setError("No se pudo leer la cámara.");
      }
    }

    void start();

    return () => {
      stoppedRef.current = true;
      if (timer) window.clearTimeout(timer);
      video.srcObject = null;
      stream.getTracks().forEach((track) => track.stop());
    };
  }, [onDetect, stream]);

  async function toggleTorch() {
    const next = !torchOn;
    const ok = await setCameraTorch(stream, next);
    if (ok) setTorchOn(next);
  }

  async function bumpZoom(direction: 1 | -1) {
    const next = Math.min(3, Math.max(1, Math.round((zoom + direction * 0.5) * 10) / 10));
    if (next === zoom) return;
    setZoom(next);
    if (nativeZoom) {
      const mapped = nativeZoom.min + ((next - 1) / 2) * (nativeZoom.max - nativeZoom.min);
      await setCameraZoom(stream, mapped);
    }
  }

  function handleManual(event: FormEvent) {
    event.preventDefault();
    const isbn = isbnFromBarcode(manual);
    if (!isbn) {
      setError("Ese ISBN no cierra. Revisá los números de debajo del código.");
      return;
    }
    finishManual(isbn);
  }

  function finishManual(isbn: string) {
    if (detectedRef.current || stoppedRef.current) return;
    detectedRef.current = true;
    onDetect(isbn);
  }

  return (
    <div className="qcl-sheet-backdrop qcl-scanner-backdrop" onClick={onClose}>
      <div
        className="qcl-scanner"
        role="dialog"
        aria-modal="true"
        aria-label="Escanear código de barras"
        onClick={(event) => event.stopPropagation()}
      >
        <video
          ref={videoRef}
          className="qcl-scanner-video"
          autoPlay
          playsInline
          muted
          style={{ transform: `scale(${zoom})` }}
        />
        <canvas ref={canvasRef} className="qcl-scanner-canvas" aria-hidden="true" />
        <div className="qcl-scanner-frame" aria-hidden="true" />
        <p className="qcl-scanner-hint">
          {error ?? "Apuntá al código. Si no lo toma, escribí el ISBN."}
        </p>
        <div className="qcl-scanner-tools">
          {torchAvailable ? (
            <button
              type="button"
              className="qcl-secondary-btn qcl-scanner-tool"
              onClick={() => void toggleTorch()}
            >
              {torchOn ? "Apagar luz" : "Luz"}
            </button>
          ) : null}
          <button
            type="button"
            className="qcl-secondary-btn qcl-scanner-tool"
            onClick={() => void bumpZoom(-1)}
            disabled={zoom <= 1}
          >
            −
          </button>
          <span className="qcl-scanner-zoom-label">{zoom.toFixed(1).replace(".0", "")}×</span>
          <button
            type="button"
            className="qcl-secondary-btn qcl-scanner-tool"
            onClick={() => void bumpZoom(1)}
            disabled={zoom >= 3}
          >
            +
          </button>
        </div>
        <form className="qcl-scanner-isbn" onSubmit={handleManual}>
          <label>
            <span>Escribir el ISBN</span>
            <input
              value={manual}
              onChange={(event) => {
                setManual(event.target.value);
                if (error) setError(null);
              }}
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="search"
              placeholder="Los números de debajo del código"
            />
          </label>
          <button type="submit" className="qcl-primary-btn">
            Buscar
          </button>
        </form>
        <button type="button" className="qcl-secondary-btn qcl-scanner-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
