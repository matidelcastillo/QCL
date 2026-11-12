import { apiResponse } from "./server/api";

type Entry = {
  fetch: (request: Request, env: unknown, context: unknown) => Promise<Response> | Response;
};
let entry: Promise<Entry> | undefined;
export default {
  async fetch(request: Request, env: unknown, context: unknown) {
    const api = await apiResponse(request);
    if (api) return api;
    entry ??= import("@tanstack/react-start/server-entry").then(
      (module) => (module.default ?? module) as Entry,
    );
    return (await entry).fetch(request, env, context);
  },
};
