# QCL

App iOS/web de biblioteca privada. El código está en `app/`.

## Instrucciones para auditorías

Leer primero [`docs/DECISIONS.md`](docs/DECISIONS.md). Los puntos documentados ahí son decisiones de producto: no reportarlos como hallazgo. Solo señalarlos si la implementación se aparta de lo documentado.

## Deploys web

El host fijo es `https://qcl.matidelcastillo.workers.dev`. Nunca hay que cambiarlo ni agregar un redirect en `/`. Los cambios web salen con `bun run deploy` desde `app/` (build + wrangler + `scripts/verify-worker.mjs`). No hace falta un build nativo. GitHub Actions está bloqueado por facturación; esa verificación local es la puerta.

## iOS

El wrapper Capacitor 8 carga el worker (`server.url` en `capacitor.config.ts`). `webDir` es `capacitor-shell`, con `offline.html` como `errorPath`. `bun run ios:prepare` solo corre `cap sync ios`. No agregar `WKAppBoundDomains`. Un cambio nativo (plugin, config, pantalla offline) sí pide un build; el usuario lo lanza en Codemagic.

## Escáner

`/api/diag` y `app/src/data/scan-diag.ts` son diagnóstico temporal del escáner (ver `docs/DECISIONS.md`). El escaneo nativo vive fuera de React (`native-isbn-scan.ts`): un solo escaneo a la vez y su resultado espera a que lo tome el `Scanner` montado. No volver a una promesa local del componente.
