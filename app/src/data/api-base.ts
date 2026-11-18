const WORKER_ORIGIN = "https://qcl.matidelcastillo.workers.dev";

/* Live iOS loads the worker origin (same-origin /api/...). Older App Store
   binaries still run the bundled UI on capacitor://localhost and need the
   absolute worker URL. */
export function isNativeShell() {
  return typeof window !== "undefined" && window.location.protocol === "capacitor:";
}

export function apiUrl(path: string): string {
  return isNativeShell() ? `${WORKER_ORIGIN}${path}` : path;
}
