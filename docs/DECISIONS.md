# Decisiones de producto

Última revisión: 2026-11-18. Decisión del producto, no reportar como hallazgo.

## Gilada

`min_other_owners` vale 1 y no hay tope de filas: el grupo de amigos es chico y debe verse todo lo que cargan otros. Más adelante vuelve a 2. El umbral está en la CTE `settings` de `public.most_read_books()`.

## Búsqueda

La búsqueda oculta los libros sin tapa. No hay alta manual. Es intencional.

## CI

GitHub Actions está bloqueado por facturación. La puerta de calidad es, en local: `bun run lint`, `bun run typecheck`, `bun test src` y `bun run build`.

## Supabase Auth

La protección de contraseñas filtradas está apagada porque exige el plan Pro.

El alta auto-confirma el email y no hay CAPTCHA. Es intencional.

## RPC `SECURITY DEFINER`

Las funciones ejecutables por `authenticated` (`most_read_books`, `delete_own_account`) son `SECURITY DEFINER` a propósito. Comprueban `auth.uid()`, exigen un usuario vigente y rechazan a `anon`.

## Bundle

El aviso de Vite de chunk mayor a 500 kB se acepta: el `Gate` raíz necesita el cliente de Supabase.

## Host del worker y deploys web

El host fijo de la app y de la web es `https://qcl.matidelcastillo.workers.dev`. No se cambia y `/` no redirige (ni a otro host ni a otro path). WKWebView puede cachear un 301 y sacar el binario instalado a Safari. Si en algún caso hace falta un redirect, es temporal y lleva `Cache-Control: no-store`.

Los cambios web salen con `bun run deploy` en `app/` (build, wrangler, y `scripts/verify-worker.mjs`). No hace falta un build nativo. Rollback: `git revert` y volver a desplegar, o un rollback del worker en Cloudflare.

El binario iOS carga ese host con `server.url` en `capacitor.config.ts`. La sesión de Supabase vive en ese origen (`localStorage`). Quien actualice desde un binario empaquetado (origen `capacitor://localhost`) entra de nuevo una vez.

No reportar el live-load, la ausencia de `WKAppBoundDomains`, ni la pantalla de “Sin conexión.” como hallazgo.

## Qué leo

Está apagado por decisión de producto, desde el 2026-11-18. El interruptor es `LEO_ENABLED` en `app/src/domain/leo.ts`. No reportar la ausencia del botón o del endpoint como hallazgo.

## Diagnóstico del escáner (temporal)

Desde el 2026-11-18, cada escaneo nativo manda un `POST /api/diag` y el worker escribe una línea `qcl-diag scan {...}` en Workers Logs (`observability` en `app/wrangler.jsonc`). Sirve para ver en un iPhone real cómo termina el escaneo. Solo guarda la forma del resultado: tipo de salida, formato, largo del código, código y texto del error del plugin, `isNativePlatform`, `isPluginAvailable`, origen y versión de la app. No guarda el código, el ISBN, el usuario, tokens ni IP. Tiene un tope de 1 KB y `DIAG_LIMIT` (20 por minuto). Se saca cuando se confirme la causa (`app/src/server/diag.ts`, `app/src/data/scan-diag.ts`, `DIAG_LIMIT`). Es intencional; no reportarlo como hallazgo mientras siga marcado como temporal.

También temporal: si una llamada del usuario a Supabase vuelve 401 con la sesión abierta, la web refresca la sesión una vez o cierra la sesión local y manda a Entrar (`app/src/data/auth-guard.ts`), y deja una línea `qcl-diag auth {...}` con la forma de la sesión guardada y el desfase de reloj (sin token, id ni email). El `kind: "probe"` no escribe nada; solo sirve para leer la hora del servidor.

## Supabase por el mismo origen (`/sb`)

Desde el 2026-11-18, la web y el live-load de iOS llaman a PostgREST (`/rest/v1/*`) y a `/auth/v1/user` y `/auth/v1/logout` por `https://qcl.matidelcastillo.workers.dev/sb/...`. El worker reenvía el pedido tal cual a Supabase (`app/src/server/supabase-proxy.ts`). Causa: los bloqueadores de privacidad sacan el header `Authorization` de los pedidos a terceros. Por ejemplo, AdGuard para Mac con Stealth Mode tiene activado "Block third-party Authorization header". Sin ese header, PostgREST trata al usuario como anon y devuelve 401 (42501), y Mis libros queda en "No pudimos cargar". Login, alta y refresh siguen yendo directo a Supabase: se autentican con el body y Supabase Auth los limita por IP del cliente. El proxy no agrega privilegios: reenvía el `apikey` y el `Authorization` del usuario, y RLS decide igual. Rechaza otros paths, métodos y orígenes, y no reenvía cookies. La UI empaquetada (`capacitor://localhost`) sigue directo. Es intencional; no reportarlo como hallazgo.
