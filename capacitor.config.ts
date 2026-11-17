import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.quecarajolees.app",
  appName: "Qué Carajo Lee",
  webDir: "capacitor-web",
  ios: {
    contentInset: "never",
    backgroundColor: "#ffffff",
    preferredContentMode: "mobile",
  },
};

export default config;
