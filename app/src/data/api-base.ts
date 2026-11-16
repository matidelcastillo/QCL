const WORKER_ORIGIN = "https://qcl.matidelcastillo.workers.dev";

/* The iOS shell is a bundled build on capacitor://localhost. Same-origin
   /api/... would miss the worker, so those calls go to the live origin. */
export function isNativeShell() {
  return typeof window !== "undefined" && window.location.protocol === "capacitor:";
}

export function apiUrl(path: string): string {
  return isNativeShell() ? `${WORKER_ORIGIN}${path}` : path;
}
