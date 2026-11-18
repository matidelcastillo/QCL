import type { CapacitorConfig } from "@capacitor/cli";

/* Fixed live host, forever. WKWebView can cache a redirect and send the
   installed app out to Safari, so this origin must never 301/302 on `/`
   or to another host. Rollback is git revert plus a worker deploy, or a
   Cloudflare worker rollback. */
export const QCL_LIVE_HOST = "qcl.matidelcastillo.workers.dev";
export const QCL_LIVE_ORIGIN = `https://${QCL_LIVE_HOST}`;

const config: CapacitorConfig = {
  appId: "com.quecarajolees.app",
  appName: "QC Lee",
  webDir: "capacitor-shell",
  server: {
    url: QCL_LIVE_ORIGIN,
    allowNavigation: [QCL_LIVE_HOST],
    errorPath: "offline.html",
  },
  ios: {
    contentInset: "never",
    // Same value as --bg in app/src/styles/tokens.css.
    backgroundColor: "#f5f0eb",
    preferredContentMode: "mobile",
    /* Do not set limitsNavigationsToAppBoundDomains and do not add
       WKAppBoundDomains: Capacitor's iOS troubleshooting notes that key
       blocks bridge and plugin injection unless the flag is true and
       localhost is also listed. The scanner needs the bridge on the
       remote origin. ATS is satisfied by HTTPS on this host. */
  },
  plugins: {
    StatusBar: {
      // Dark text on the cream --bg (tokens.css).
      style: "DARK",
      backgroundColor: "#f5f0eb",
    },
  },
};

export default config;
