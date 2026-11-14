import { env as bindings } from "cloudflare:workers";
import { apiResponse, type Env } from "./server/api";
import { httpsRedirect, secure } from "./server/security";

type Entry = {
  fetch: (request: Request, env: unknown, context: unknown) => Promise<Response> | Response;
};
let entry: Promise<Entry> | undefined;

async function handle(request: Request, env: Env, context: unknown) {
  /* Nitro calls this entry with the request only, so worker bindings
     (secrets) come from cloudflare:workers, not from the fetch arguments. */
  const api = await apiResponse(request, bindings as Env);
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
