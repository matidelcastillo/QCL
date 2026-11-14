export type Rect = { x: number; y: number; width: number; height: number };

/* Maps the on-screen guide to video pixels (the video scales uniformly to
   cover its box), grown by `margin` (fraction of the guide) and clamped to
   the frame. Decoding only this region keeps the barcode large in the image. */
export function guideCrop(
  video: { width: number; height: number },
  view: Rect,
  guide: Rect,
  margin = 0.25,
): Rect {
  const scale = Math.max(view.width / video.width, view.height / video.height);
  const offsetX = (video.width * scale - view.width) / 2;
  const offsetY = (video.height * scale - view.height) / 2;
  const width = guide.width / scale;
  const height = guide.height / scale;
  const x = (guide.x - view.x + offsetX) / scale - width * margin;
  const y = (guide.y - view.y + offsetY) / scale - height * margin;
  const left = Math.max(0, Math.floor(x));
  const top = Math.max(0, Math.floor(y));
  const right = Math.min(video.width, Math.ceil(x + width * (1 + 2 * margin)));
  const bottom = Math.min(video.height, Math.ceil(y + height * (1 + 2 * margin)));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
