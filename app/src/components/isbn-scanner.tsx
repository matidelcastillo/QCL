import { useEffect, useRef, useState } from "react";
import { isbnFromBarcode } from "@/lib/isbn";

type DetectorResult = { rawValue?: string };

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => {
  detect: (source: ImageBitmapSource) => Promise<DetectorResult[]>;
};

function getBarcodeDetector(): BarcodeDetectorCtor | null {
  const ctor = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return ctor ?? null;
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
  const [error, setError] = useState<string | null>(null);
  const stoppedRef = useRef(false);
  const detectedRef = useRef(false);

  useEffect(() => {
    const media = videoRef.current;
    if (!media) return;
    const video: HTMLVideoElement = media;
    let timer: number | undefined;
    let zxingControls: { stop: () => void } | null = null;

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

        const Detector = getBarcodeDetector();
        if (Detector) {
          const detector = new Detector({ formats: ["ean_13", "ean_8", "upc_a"] });
          const tick = async () => {
            if (stoppedRef.current || detectedRef.current) return;
            try {
              if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                const codes = await detector.detect(video);
                for (const code of codes) {
                  const isbn = isbnFromBarcode(code.rawValue ?? "");
                  if (isbn) {
                    finish(isbn);
                    return;
                  }
                }
              }
            } catch {
              // keep scanning
            }
            timer = window.setTimeout(() => void tick(), 180);
          };
          void tick();
          return;
        }

        const [{ BrowserMultiFormatReader }, library] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        const hints = new Map();
        hints.set(library.DecodeHintType.POSSIBLE_FORMATS, [
          library.BarcodeFormat.EAN_13,
          library.BarcodeFormat.EAN_8,
          library.BarcodeFormat.UPC_A,
        ]);
        const reader = new BrowserMultiFormatReader(hints);
        zxingControls = await reader.decodeFromVideoElement(video, (result) => {
          if (!result) return;
          const isbn = isbnFromBarcode(result.getText());
          if (isbn) finish(isbn);
        });
      } catch {
        if (!stoppedRef.current) setError("No se pudo leer la cámara.");
      }
    }

    void start();

    return () => {
      stoppedRef.current = true;
      if (timer) window.clearTimeout(timer);
      try {
        zxingControls?.stop();
      } catch {
        // ignore
      }
      video.srcObject = null;
      stream.getTracks().forEach((track) => track.stop());
    };
  }, [onDetect, stream]);

  return (
    <div className="qcl-sheet-backdrop qcl-scanner-backdrop" onClick={onClose}>
      <div
        className="qcl-scanner"
        role="dialog"
        aria-modal="true"
        aria-label="Escanear código de barras"
        onClick={(event) => event.stopPropagation()}
      >
        <video ref={videoRef} className="qcl-scanner-video" autoPlay playsInline muted />
        <div className="qcl-scanner-frame" aria-hidden="true" />
        <p className="qcl-scanner-hint">{error ?? "Apuntá al código de barras del libro."}</p>
        <button type="button" className="qcl-secondary-btn qcl-scanner-close" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
