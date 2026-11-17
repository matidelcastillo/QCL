export type CoverSize = "row" | "large" | "tile";

export function coverImageClass(size: CoverSize, instant: boolean) {
  const fade = size === "large" ? "drawer-media-fade" : "qc-card-image";
  return `cover-image ${fade}${instant ? " is-loaded" : ""}`;
}
