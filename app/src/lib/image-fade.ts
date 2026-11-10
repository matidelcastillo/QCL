/** True when the browser already decoded the bitmap (cache / pre-hydrate). */
export function isDecodedImage(img: HTMLImageElement | null | undefined): img is HTMLImageElement {
  return Boolean(img && img.complete && img.naturalWidth > 0);
}

/** Add `.is-loaded` if `load` already fired before React attached onLoad. */
export function revealFadeImg(el: HTMLImageElement | null): void {
  if (isDecodedImage(el)) el.classList.add("is-loaded");
}
