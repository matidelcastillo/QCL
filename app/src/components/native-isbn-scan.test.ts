import { describe, expect, test } from "bun:test";
import { nativeScanFailure } from "./native-isbn-scan";

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

  test("anything else is treated as unavailable", () => {
    expect(nativeScanFailure({ code: "OS-PLUG-BARC-0004" })).toBe("unavailable");
    expect(nativeScanFailure(new Error("boom"))).toBe("unavailable");
  });
});
