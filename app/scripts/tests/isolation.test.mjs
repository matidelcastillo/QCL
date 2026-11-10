import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("../..", import.meta.url).pathname;
const skipDirs = new Set(["node_modules", ".git", ".vinxi", ".wrangler", ".nitro", "dist"]);

const patterns = [
  { name: "qc-host", re: /quecarajoba/i },
  { name: "supabase", re: /supabase/i },
  { name: "posthog", re: /posthog/i },
  { name: "capacitor", re: /capacitor/i },
  { name: "google-services", re: /google-services|GoogleService-Info/i },
  { name: "service-role", re: /service_role/i },
  { name: "google-api-key", re: /AIza/ },
  { name: "firebase", re: /firebase/i },
  { name: "private-key", re: /BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY/ },
  { name: "mailto-address", re: /mailto:[^\s"'<>]*@/i },
];

function filesUnder(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name)) continue;
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) filesUnder(path, acc);
    else if (stat.isFile() && stat.size < 2_000_000) acc.push(path);
  }
  return acc;
}

describe("scaffold isolation", () => {
  test("app source and config do not carry QC hosts, clients, or credential markers", () => {
    const hits = [];
    for (const file of filesUnder(root)) {
      const rel = relative(root, file);
      if (rel.startsWith("scripts/tests/")) continue;
      if (rel === "README.md" || rel.startsWith("docs/")) continue;
      const text = readFileSync(file, "utf8");
      for (const pattern of patterns) {
        if (pattern.re.test(text)) hits.push(`${rel} [${pattern.name}]`);
      }
    }
    expect(hits).toEqual([]);
  });

  test("sensitive source filenames are not in the tree", () => {
    const names = filesUnder(root).map((file) => relative(root, file));
    const banned = [
      ".env.mobile.example",
      "google-services.json",
      "GoogleService-Info.plist",
      "meridiano.html",
    ];
    for (const name of names) {
      for (const piece of banned) {
        expect(name.endsWith(piece)).toBe(false);
      }
    }
    expect(names.some((name) => name.includes("supabase/"))).toBe(false);
  });
});
