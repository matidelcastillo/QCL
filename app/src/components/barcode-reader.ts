import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { ISBN_READER_OPTIONS, isbnFromResults } from "../domain/barcode";

/* zxing-cpp (WASM) reads the same on iOS Safari, Android and desktop.
   Loaded on demand; the .wasm is served from our own origin. */
let reader: Promise<typeof import("zxing-wasm/reader")> | undefined;

function loadReader() {
  reader ??= import("zxing-wasm/reader").then(async (zxing) => {
    await zxing.prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? wasmUrl : prefix + path,
      },
      fireImmediately: true,
    });
    return zxing;
  });
  return reader;
}

export async function readIsbn(image: ImageData): Promise<string | null> {
  const { readBarcodes } = await loadReader();
  return isbnFromResults(await readBarcodes(image, ISBN_READER_OPTIONS));
}

export function preloadReader() {
  void loadReader();
}
