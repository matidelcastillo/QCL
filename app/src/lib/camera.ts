type CameraCapabilities = MediaTrackCapabilities & {
  torch?: boolean;
  focusMode?: string[];
  zoom?: { min: number; max: number; step?: number };
};

type CameraSettings = MediaTrackSettings & {
  torch?: boolean;
  zoom?: number;
};

function videoTrack(stream: MediaStream): MediaStreamTrack | null {
  return stream.getVideoTracks()[0] ?? null;
}

function trackCapabilities(track: MediaStreamTrack): CameraCapabilities {
  try {
    return (track.getCapabilities?.() ?? {}) as CameraCapabilities;
  } catch {
    return {};
  }
}

async function applyAdvanced(
  track: MediaStreamTrack,
  values: Record<string, unknown>,
): Promise<boolean> {
  if (Object.keys(values).length === 0) return false;
  try {
    await track.applyConstraints({ advanced: [values] as unknown as MediaTrackConstraintSet[] });
    return true;
  } catch {
    try {
      await track.applyConstraints(values as MediaTrackConstraints);
      return true;
    } catch {
      return false;
    }
  }
}

export async function openCameraStream(): Promise<MediaStream> {
  const base: MediaTrackConstraints = {
    facingMode: { ideal: "environment" },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  };
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: base });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: { ideal: "environment" } },
    });
  }

  const track = videoTrack(stream);
  if (track) {
    const capabilities = trackCapabilities(track);
    const modes = capabilities.focusMode ?? [];
    const focusMode = modes.includes("continuous")
      ? "continuous"
      : modes.includes("continuous-video")
        ? "continuous-video"
        : null;
    if (focusMode) await applyAdvanced(track, { focusMode });
  }

  return stream;
}

export function cameraHasTorch(stream: MediaStream): boolean {
  const track = videoTrack(stream);
  return Boolean(track && trackCapabilities(track).torch);
}

export async function setCameraTorch(stream: MediaStream, on: boolean): Promise<boolean> {
  const track = videoTrack(stream);
  if (!track || !trackCapabilities(track).torch) return false;
  return applyAdvanced(track, { torch: on });
}

export function cameraZoomRange(
  stream: MediaStream,
): { min: number; max: number; step: number; value: number } | null {
  const track = videoTrack(stream);
  if (!track) return null;
  const zoom = trackCapabilities(track).zoom;
  if (!zoom || zoom.max <= zoom.min) return null;
  const settings = track.getSettings?.() as CameraSettings | undefined;
  return {
    min: zoom.min,
    max: zoom.max,
    step: zoom.step && zoom.step > 0 ? zoom.step : 0.1,
    value: settings?.zoom ?? zoom.min,
  };
}

export async function setCameraZoom(stream: MediaStream, value: number): Promise<boolean> {
  const track = videoTrack(stream);
  if (!track) return false;
  return applyAdvanced(track, { zoom: value });
}
