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
