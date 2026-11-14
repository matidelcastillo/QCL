import { describe, expect, test } from "bun:test";
import { guideCrop } from "./scan-crop";

describe("guideCrop", () => {
  test("maps the guide of a portrait 1080x1920 video shown in a 310x310 box", () => {
    expect(
      guideCrop(
        { width: 1080, height: 1920 },
        { x: 0, y: 0, width: 310, height: 310 },
        { x: 20, y: 110, width: 270, height: 90 },
        0,
      ),
    ).toEqual({ x: 69, y: 803, width: 942, height: 314 });
  });
  test("margin grows the crop and stays inside the frame", () => {
    const crop = guideCrop(
      { width: 640, height: 480 },
      { x: 0, y: 0, width: 300, height: 300 },
      { x: 0, y: 0, width: 300, height: 300 },
      0.5,
    );
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(640);
    expect(crop).toMatchObject({ y: 0, height: 480 });
  });
});
