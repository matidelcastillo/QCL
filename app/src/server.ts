import { env as bindings } from "cloudflare:workers";
import { apiResponse, type Env } from "./server/api";
import { httpsRedirect, secure } from "./server/security";

type Entry = {
  fetch: (request: Request, env: unknown, context: unknown) => Promise<Response> | Response;
};
let entry: Promise<Entry> | undefined;

async function handle(request: Request, env: Env, context: unknown) {
  /* Nitro often calls this entry with the request only. Use the runtime env
     Nitro stashes on globalThis (__env__), then the fetch argument, then
     cloudflare:workers. Do not spread: rate-limit bindings are not enumerable. */
  const runtime = (globalThis as { __env__?: Env }).__env__ ?? env ?? (bindings as Env);
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
