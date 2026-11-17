import type { BarcodeRead } from "../domain/barcode";

export type CameraFailure = "denied" | "unavailable";
export type ScanStatus = "idle" | "starting" | "running" | "stopped" | CameraFailure;

export function classifyCameraError(error: unknown): CameraFailure {
  const name =
    error && typeof error === "object" && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "denied";
  return "unavailable";
}

export const CAMERA_DENIED_MESSAGE = "Habilitá la cámara en Ajustes.";
export const CAMERA_UNAVAILABLE_MESSAGE = "Sin cámara. Escribí el ISBN.";
export const NOT_ISBN_MESSAGE = "Ese código no es un ISBN.";

const DEFAULT_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
  audio: false,
};

export type WebScanSession = {
  start: () => Promise<void>;
  stop: () => void;
  handleVisibility: (hidden: boolean) => void;
  ingest: (read: BarcodeRead, fromGeneration?: number) => void;
  generation: () => number;
  wanted: () => boolean;
  stream: () => MediaStream | null;
};

export function createWebScanSession(options: {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  onStatus: (status: ScanStatus) => void;
  onStream?: (stream: MediaStream | null) => void;
  onFound: (isbn: string) => void;
  onInvalid?: () => void;
  constraints?: MediaStreamConstraints;
}): WebScanSession {
  let generation = 0;
  let wanted = false;
  let media: MediaStream | null = null;
  let accepted = false;

  function release(next: MediaStream | null = null) {
    media?.getTracks().forEach((track) => track.stop());
    media = next;
    options.onStream?.(media);
  }

  function stop() {
    wanted = false;
    accepted = false;
    generation += 1;
    release(null);
    options.onStatus("stopped");
  }

  async function start() {
    wanted = true;
    accepted = false;
    const mine = (generation += 1);
    release(null);
    options.onStatus("starting");
    try {
      const next = await options.getUserMedia(options.constraints ?? DEFAULT_CONSTRAINTS);
      if (mine !== generation) {
        next.getTracks().forEach((track) => track.stop());
        return;
      }
      media = next;
      options.onStream?.(media);
      options.onStatus("running");
    } catch (error) {
      if (mine !== generation) return;
      wanted = false;
      release(null);
      options.onStatus(classifyCameraError(error));
    }
  }

  function handleVisibility(hidden: boolean) {
    if (hidden) {
      if (!wanted && !media) return;
      generation += 1;
      release(null);
      options.onStatus("stopped");
      return;
    }
    if (wanted) void start();
  }

  function ingest(read: BarcodeRead, fromGeneration?: number) {
    if (!wanted || !media || accepted) return;
    if (fromGeneration != null && fromGeneration !== generation) return;
    if (read.kind === "isbn") {
      accepted = true;
      options.onFound(read.isbn);
      return;
    }
    if (read.kind === "invalid") options.onInvalid?.();
  }

  return {
    start,
    stop,
    handleVisibility,
    ingest,
    generation: () => generation,
    wanted: () => wanted,
    stream: () => media,
  };
}
