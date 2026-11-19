import { describe, expect, test } from "bun:test";
import {
  claimNativeScan,
  discardNativeScan,
  nativeScanFailure,
  nativeScanInFlight,
  nativeScanResult,
  startNativeScan,
} from "./native-isbn-scan";

describe("native scanner failures", () => {
  test("cancel closes instead of looking like a missing camera", () => {
    expect(nativeScanFailure({ code: "OS-PLUG-BARC-0006", message: "cancelled" })).toBe(
      "cancelled",
    );
    expect(nativeScanFailure(new Error("Couldn’t scan because the process was cancelled."))).toBe(
      "cancelled",
    );
  });

  test("denied camera access is recoverable", () => {
    expect(nativeScanFailure({ code: "OS-PLUG-BARC-0007" })).toBe("denied");
    expect(
      nativeScanFailure(new Error("Couldn’t scan because camera access wasn’t provided.")),
    ).toBe("denied");
  });

  test("a plugin error is an error, even if its text mentions cancel", () => {
    expect(nativeScanFailure({ code: "OS-PLUG-BARC-0004" })).toBe("error");
    expect(nativeScanFailure({ code: "OS-PLUG-BARC-0004", message: "was cancelled" })).toBe(
      "error",
    );
    expect(nativeScanFailure(new Error("boom"))).toBe("error");
  });
});

describe("native scanner results", () => {
  test("a barcode with an ISBN opens the book", () => {
    expect(nativeScanResult({ ScanResult: "9780140280197", format: 9 })).toEqual({
      status: "isbn",
      isbn: "9780140280197",
    });
    expect(nativeScanResult({ ScanResult: " 0140280197 " })).toEqual({
      status: "isbn",
      isbn: "9780140280197",
    });
  });

  test("no code is empty, another code is invalid", () => {
    expect(nativeScanResult({ ScanResult: "" })).toEqual({ status: "empty" });
    expect(nativeScanResult({})).toEqual({ status: "empty" });
    expect(nativeScanResult(undefined)).toEqual({ status: "empty" });
    expect(nativeScanResult({ ScanResult: "7791234567890" })).toEqual({ status: "invalid" });
  });
});

describe("native scan session", () => {
  test("one scan at a time, and its outcome survives the Scanner", async () => {
    const first = startNativeScan(() => 0);
    const second = startNativeScan(() => 0);
    expect(second).toBe(first);
    expect(nativeScanInFlight()).toBe(true);
    /* Off device there is no native scanner: that is a visible outcome. */
    expect(await first).toEqual({ status: "unavailable" });
    expect(nativeScanInFlight()).toBe(false);
    expect(claimNativeScan(() => 1_000)).toEqual({ status: "unavailable" });
    expect(claimNativeScan(() => 1_000)).toBeNull();
  });

  test("a stale or discarded outcome is not replayed", async () => {
    await startNativeScan(() => 0);
    expect(claimNativeScan(() => 31_000)).toBeNull();
    await startNativeScan(() => 0);
    discardNativeScan();
    expect(claimNativeScan(() => 0)).toBeNull();
  });
});
