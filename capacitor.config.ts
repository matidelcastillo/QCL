import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.quecarajolees.app",
  appName: "QC Lee",
  webDir: "capacitor-web",
  ios: {
    contentInset: "never",
    // Same value as --bg in app/src/styles/tokens.css.
    backgroundColor: "#f5f0eb",
    preferredContentMode: "mobile",
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
