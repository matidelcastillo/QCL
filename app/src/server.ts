import { env as bindings } from "cloudflare:workers";
import { apiResponse, type Env } from "./server/api";
import { httpsRedirect, secure } from "./server/security";

type Entry = {
  fetch: (request: Request, env: unknown, context: unknown) => Promise<Response> | Response;
};
let entry: Promise<Entry> | undefined;

async function handle(request: Request, env: Env, context: unknown) {
  /* Nitro often calls this entry with the request only. Bindings then come
     from cloudflare:workers, plus __env__ (set by Nitro's Cloudflare handler)
     which includes the rate limiters that module env does not expose. */
  const runtime = {
    ...(bindings as Env),
    ...((globalThis as { __env__?: Env }).__env__ ?? {}),
    ...(env ?? {}),
  };
  const api = await apiResponse(request, runtime);
  if (api) return api;
  entry ??= import("@tanstack/react-start/server-entry").then(
    (module) => (module.default ?? module) as Entry,
  );
  return (await entry).fetch(request, env, context);
}

export default {
  async fetch(request: Request, env: Env, context: unknown) {
    const redirect = httpsRedirect(request);
    if (redirect) return redirect;
    return secure(await handle(request, env, context));
  },
};
