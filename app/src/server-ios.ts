/* Server entry for the iOS static build (QCL_TARGET=ios). It only runs at
   build time to prerender the SPA shell; the app's /api routes live on the
   worker (src/server.ts), which the shell calls through apiUrl(). */
export { default } from "@tanstack/react-start/server-entry";
