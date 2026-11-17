import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.quecarajolees.app",
  appName: "QC Lee",
  webDir: "capacitor-web",
  ios: {
    contentInset: "never",
    backgroundColor: "#ffffff",
    preferredContentMode: "mobile",
  },
};

export default config;
