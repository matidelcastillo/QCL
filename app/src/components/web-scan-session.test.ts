import { describe, expect, test } from "bun:test";
import type { ScanStatus } from "./web-scan-session";
import {
  CAMERA_DENIED_MESSAGE,
  CAMERA_UNAVAILABLE_MESSAGE,
  classifyCameraError,
  createWebScanSession,
  NOT_ISBN_MESSAGE,
} from "./web-scan-session";

function fakeStream() {
  let stopped = false;
  const track = {
    stop() {
      stopped = true;
    },
  };
  const stream = {
    getTracks: () => [track],
    getVideoTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, isStopped: () => stopped };
}

function session(getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>) {
  const statuses: ScanStatus[] = [];
  const found: string[] = [];
  const invalid: number[] = [];
  const streams: Array<MediaStream | null> = [];
  const created = createWebScanSession({
    getUserMedia,
    onStatus: (status) => statuses.push(status),
    onStream: (stream) => streams.push(stream),
    onFound: (isbn) => found.push(isbn),
    onInvalid: () => invalid.push(1),
  });
  return { ...created, statuses, found, invalid, streams };
}

describe("classifyCameraError", () => {
  test("maps permission errors to denied and the rest to unavailable", () => {
    expect(classifyCameraError({ name: "NotAllowedError" })).toBe("denied");
    expect(classifyCameraError({ name: "PermissionDeniedError" })).toBe("denied");
    expect(classifyCameraError({ name: "NotReadableError" })).toBe("unavailable");
    expect(classifyCameraError({ name: "NotFoundError" })).toBe("unavailable");
    expect(classifyCameraError({ name: "OverconstrainedError" })).toBe("unavailable");
    expect(classifyCameraError(new Error("fail"))).toBe("unavailable");
  });
});

describe("camera messages", () => {
  test("keeps the Rioplatense copy", () => {
    expect(CAMERA_DENIED_MESSAGE).toBe("Habilitá la cámara en Ajustes.");
    expect(CAMERA_UNAVAILABLE_MESSAGE).toBe("Sin cámara. Escribí el ISBN.");
    expect(NOT_ISBN_MESSAGE).toBe("Ese código no es un ISBN.");
  });
});

describe("createWebScanSession", () => {
  test("starts the camera and accepts an ISBN only once", async () => {
    const cam = fakeStream();
    const scan = session(async () => cam.stream);
    await scan.start();
    expect(scan.statuses).toEqual(["starting", "running"]);
    scan.ingest({ kind: "isbn", isbn: "9788471893147" });
    scan.ingest({ kind: "isbn", isbn: "9780140328721" });
    expect(scan.found).toEqual(["9788471893147"]);
  });

  test("ignores a late ISBN after leaving the tab", async () => {
    const cam = fakeStream();
    const scan = session(async () => cam.stream);
    await scan.start();
    const generation = scan.generation();
    scan.stop();
    scan.ingest({ kind: "isbn", isbn: "9788471893147" }, generation);
    expect(scan.found).toEqual([]);
    expect(cam.isStopped()).toBe(true);
    expect(scan.wanted()).toBe(false);
  });

  test("ignores a frame captured before a mid-scan stop", async () => {
    const cam = fakeStream();
    const scan = session(async () => cam.stream);
    await scan.start();
    const generation = scan.generation();
    scan.stop();
    await scan.start();
    scan.ingest({ kind: "isbn", isbn: "9788471893147" }, generation);
    expect(scan.found).toEqual([]);
  });

  test("rapid start/stop only keeps the latest stream", async () => {
    const first = fakeStream();
    const second = fakeStream();
    const third = fakeStream();
    const pending: Array<(stream: MediaStream) => void> = [];
    const scan = session(
      () =>
        new Promise<MediaStream>((resolve) => {
          pending.push(resolve);
        }),
    );
    const one = scan.start();
    const two = scan.start();
    pending[0](first.stream);
    await one;
    expect(first.isStopped()).toBe(true);
    expect(scan.stream()).toBeNull();
    const threeStop = scan.start();
    scan.stop();
    pending[1](second.stream);
    pending[2](third.stream);
    await two;
    await threeStop;
    expect(second.isStopped()).toBe(true);
    expect(third.isStopped()).toBe(true);
    expect(scan.stream()).toBeNull();
    expect(scan.wanted()).toBe(false);
  });

  test("denied permission does not auto-retry on visibility", async () => {
    let calls = 0;
    const scan = session(async () => {
      calls += 1;
      throw { name: "NotAllowedError" };
    });
    await scan.start();
    expect(scan.statuses).toEqual(["starting", "denied"]);
    expect(scan.wanted()).toBe(false);
    scan.handleVisibility(true);
    scan.handleVisibility(false);
    await Promise.resolve();
    expect(calls).toBe(1);
    expect(scan.statuses).toEqual(["starting", "denied"]);
  });

  test("an in-use or missing camera is unavailable and does not loop", async () => {
    let calls = 0;
    const scan = session(async () => {
      calls += 1;
      throw { name: "NotReadableError" };
    });
    await scan.start();
    expect(scan.statuses).toEqual(["starting", "unavailable"]);
    scan.handleVisibility(true);
    scan.handleVisibility(false);
    await Promise.resolve();
    expect(calls).toBe(1);
  });

  test("backgrounding stops the camera and coming back restarts it", async () => {
    const first = fakeStream();
    const second = fakeStream();
    const cams = [first, second];
    const scan = session(async () => cams.shift()!.stream);
    await scan.start();
    expect(scan.stream()).toBe(first.stream);
    scan.handleVisibility(true);
    expect(first.isStopped()).toBe(true);
    expect(scan.stream()).toBeNull();
    expect(scan.wanted()).toBe(true);
    scan.handleVisibility(false);
    await Promise.resolve();
    await Promise.resolve();
    expect(scan.stream()).toBe(second.stream);
    expect(second.isStopped()).toBe(false);
    expect(scan.wanted()).toBe(true);
  });

  test("a non-ISBN barcode does not fire onFound", async () => {
    const cam = fakeStream();
    const scan = session(async () => cam.stream);
    await scan.start();
    scan.ingest({ kind: "invalid" });
    scan.ingest({ kind: "none" });
    expect(scan.invalid).toEqual([1]);
    expect(scan.found).toEqual([]);
    expect(scan.stream()).toBe(cam.stream);
  });
});
