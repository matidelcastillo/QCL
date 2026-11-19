import { registerPlugin } from "@capacitor/core";
import { apiUrl } from "./api-base";

/* TEMPORARY (2026-11-18), see docs/DECISIONS.md: one POST per native scan
   to /api/diag so the worker log shows how scans end on a real iPhone.
   No code, no ISBN, no user id, no token: only the shape of the outcome. */
export type ScanDiagnostic = {
  kind: string;
  format: string | null;
  length: number | null;
  digits: boolean | null;
  errorCode: string | null;
  errorMessage: string | null;
  native: boolean;
  plugin: boolean;
  origin: string;
  app: string | null;
};

type AppInfo = { version: string; build: string };
const App = registerPlugin<{ getInfo(): Promise<AppInfo> }>("App");

let appVersion: Promise<string | null> | undefined;

function version() {
  appVersion ??= App.getInfo()
    .then((info) => `${info.version} (${info.build})`)
    .catch(() => null);
  return appVersion;
}

export function reportScan(entry: Omit<ScanDiagnostic, "origin" | "app">) {
  if (typeof window === "undefined") return;
  void version().then((app) => {
    const body: ScanDiagnostic = { ...entry, origin: window.location.origin, app };
    return fetch(apiUrl("/api/diag"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined);
  });
}
