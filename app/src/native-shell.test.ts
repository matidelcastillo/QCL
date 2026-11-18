import { describe, expect, test } from "bun:test";

const root = new URL("../../", import.meta.url);
const config = await Bun.file(new URL("capacitor.config.ts", root)).text();
const plist = await Bun.file(new URL("ios/App/App/Info.plist", root)).text();
const offline = await Bun.file(new URL("capacitor-shell/offline.html", root)).text();
const shell = await Bun.file(new URL("capacitor-shell/index.html", root)).text();
const prepare = JSON.parse(await Bun.file(new URL("package.json", root)).text()) as {
  scripts: Record<string, string>;
};
const deploy = JSON.parse(await Bun.file(new URL("app/package.json", root)).text()) as {
  scripts: Record<string, string>;
};

describe("iOS live-load shell", () => {
  test("points at the one fixed worker host, with a local offline page", () => {
    expect(config).toContain("url: QCL_LIVE_ORIGIN");
    expect(config).toContain("allowNavigation: [QCL_LIVE_HOST]");
    expect(config).toContain('errorPath: "offline.html"');
    expect(config).toContain('webDir: "capacitor-shell"');
    expect(config).toContain("qcl.matidelcastillo.workers.dev");
    expect(config).not.toContain("limitsNavigationsToAppBoundDomains: true");
    expect(plist).not.toContain("WKAppBoundDomains");
    expect(prepare.scripts["ios:prepare"]).toBe("cap sync ios");
    expect(deploy.scripts.deploy).toContain("scripts/verify-worker.mjs");
  });

  test("the offline screen uses voseo, QC tokens, and only retries on tap", () => {
    expect(offline).toContain("Sin conexión.");
    expect(offline).toContain("Reintentar.");
    expect(offline).toContain("#f5f0eb");
    expect(offline).toContain("#e8624a");
    expect(offline).toContain("https://qcl.matidelcastillo.workers.dev/");
    expect(offline).toContain('document.getElementById("retry").addEventListener("click"');
    expect(offline.match(/location\.replace/g)?.length).toBe(1);
    expect(shell).not.toContain("location.replace");
    expect(shell).toContain("#f5f0eb");
  });
});
