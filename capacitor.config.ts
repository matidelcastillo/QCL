import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.quecarajolees.app",
  appName: "QCL",
  webDir: "capacitor-shell",
  server: {
    url: "https://qcl.matidelcastillo.workers.dev",
    cleartext: false,
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#ffffff",
    preferredContentMode: "mobile",
  },
};

export default config;
