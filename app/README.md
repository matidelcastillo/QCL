# QCL — Qué Carajo Leer

Cáscara web de QCL. Tiene la base visual de QC y una página estática. No hay cuentas, ni datos guardados, ni funciones de producto.

El plan lo está cerrando el parent con Astra. Esta repo no es ese plan. Astra implementa después. Este draft no está publicado.

## Cómo correrlo

Hace falta [Bun](https://bun.sh) 1.3.14.

```bash
bun install
bun run dev
```

Otros comandos:

```bash
bun run typecheck
bun run lint
bun run test
bun run build
bun run preview
```

`bun run dev` sirve Vite en el puerto que elija el proceso. Para fijarlo: `bun run dev -- --port 41773 --host 127.0.0.1`.

El build usa Nitro con target Cloudflare, igual que el toolchain de QC. `wrangler.jsonc` es un config vacío a propósito: nombre `qcl`, sin cuenta, sin rutas, sin crons y sin bindings. No desplegar.

## De dónde salió

La fuente fue un zip de solo lectura del árbol trackeado de [QC](https://github.com/matidelcastillo/QC). No hay un checkout git local de ese commit, ni del audit viejo.

Evidencia del zip, leída sin tratar el archivo como un repo:

- SHA256 del zip: `53d4a1bbce16721f3d1b59b2f59c353d2ca6579278328d8123506ac5b924feaf`
- Comentario del archivo (`unzip -z`): `16cab3a412a90785469a1aa3b8997332ba93f678`

Ese comentario es más nuevo que el audit previo `147aa4b5ea37015cc2b18c2cc4b0a2e577541d7b`. El zip no contiene el commit viejo, así que no existe un diff git entre los dos. Los conteos de abajo salen del árbol descomprimido, no de `git checkout`. El host de producción de QC no se copió.

Lo que coincidió con el audit, leyendo ese árbol:

| Dato del audit viejo | En este archivo |
| --- | --- |
| `src/styles.css` ~3292 líneas, tokens en 29–52 | 3053 líneas. El bloque `@theme` sigue en 29–52 con `#f5f0eb`, `#0a0a0a`, `#ffffff`, `#e8e3dc`, `#6b6560` |
| `src/routes/index.tsx` ~3815 líneas, UI local | 3756 líneas. La home sigue armada ahí, no en `src/components` |
| Componentes: `HomeFeedback` y `sonner` | Igual |
| Fuente real: Plus Jakarta Sans 400–800 desde `src/routes/__root.tsx` | Igual. El CSS todavía importa Inter; el body no la usa |
| Naranja `#E8624A` | Sigue en el vidrio naranja y en los colores de la home |
| Nav de 3 slots, glass, filtros de texto, lista/grilla, press, drawer, motion | Siguen en el CSS y en la home de QC |

El zip no se commitea. QC no se modifica desde acá.

## Qué se copió

| En QCL | Origen en QC |
| --- | --- |
| `src/styles.css` | Extracto de `src/styles.css`. Tokens, tipo, safe-area, ancho máximo, glass, motion, press, nav, filtros, drawers y cards. Valores iguales, no una paleta nueva |
| `src/lib/brand-header-style.ts` | El mismo archivo |
| `src/lib/use-pull-to-refresh.ts` | El mismo archivo. No está conectado |
| `src/lib/image-fade.ts` | El mismo archivo. No está conectado |
| `src/components/ui/sonner.tsx` | El mismo archivo. El toaster está montado y no dispara toasts |
| `src/lib/error-capture.ts`, `src/server.ts`, `src/start.ts` | El envoltorio SSR de errores, sin auth |
| `src/router.tsx` | Mismos defaults de cache del router. No hay queries |
| `src/routes/__root.tsx` | Shell: viewport, safe-area, ancho `--app-viewport-max`, fuente, toaster, 404 y error. Sin analytics ni clientes nativos |
| `src/routes/index.tsx` | Header estático con el mismo padding, tipo y corte de color que la home de QC |
| `docs/SYSTEM.md` | Reglas visuales reutilizables de `SYSTEM.md` |
| `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `components.json`, `bunfig.toml` | El mismo stack web: TanStack Start, React 19, Vite 7, Tailwind 4, Nitro. Versiones tomadas de QC |

La home dice «qué carajo leer» y «Todavía no hay libros.» El naranja y el negro son `#E8624A` y `#0A0A0A`. El subtítulo usa `#C0BCB6`, que es el muted del tema claro de la home de QC, no el token `--gray-text`.

## Qué no se copió

- Home, eventos, lugares, favoritos, admin y el CSS de admin, categorías de eventos, auth, social, onboarding y city-picker.
- `HomeFeedback` (depende de las ciudades de QC).
- Íconos, `og-default.jpg`, `empty-state.gif`, manifest, `robots.txt` (el de QC apunta a su sitemap), `.well-known` y cualquier link de tiendas.
- Supabase, mapas, PostHog, Capacitor, cron, pipeline, functions, fixtures y workflows.
- Dominio, nombre de worker, rutas y crons de QC. El config de Cloudflare de QCL no los tiene.
- Estos archivos del archivo fuente, que el audit marcó por identificadores aunque algunos se llamen example. Están en el zip. No se leyeron ni se copiaron: `.env.mobile.example`, `android/app/google-services.json`, `ios/App/App/GoogleService-Info.plist`, `supabase/functions/.env.example`, `scripts/fixtures/meridiano.html`.

`BRAND.md` de QC habla de eventos, CABA y ese producto. No aplica a libros y no está en esta repo.

## Desvíos chicos respecto del fuente

- No se importó Inter.
- Los inputs heredan Plus Jakarta a 16px. En QC eso estaba solo dentro del shell de admin.
- La clave de recarga por chunk viejo se llama `qcl_chunk_error_reload`.
- El 404 de servidor dice «Qué Carajo Leer». El HTML de error 500 quedó en inglés, como en QC.
- La cáscara manda `noindex`. No hay catálogo público.
- `wrangler.jsonc` es nuevo. `compatibility_date` es `2026-11-07`. No es el archivo de QC.
- La página no muestra nav, filtros, lista/grilla, drawer ni pull-to-refresh. El CSS y los helpers quedan para cuando el plan los use. Un control que no hace nada no entra en esta cáscara.
- El comentario de ergonomía táctil ya no nombra Capacitor. Las reglas de tap, selección y `touch-action` quedaron igual.

## Todavía no está, a propósito

Esta cáscara no implementa producto. No hay alta, listado, edición, lectura, búsqueda, escaneo, cuentas, auth, base, API, analytics, app nativa ni deploy.

Cuando Astra implemente, el primer corte que el parent dejó es solo un registro de lectura. Estos pasos quedan propuestos, no aceptados y no hechos: crear, listar y editar a mano, persistencia local, exportar y restaurar.

Guardar en el dispositivo, sin cuentas, sigue siendo una recomendación de antes de implementar. No es la decisión de storage. Este repo no elige backend y no escribe nada.

No forman parte del alcance aceptado: biblioteca o TBR como producto, merge, tombstones, social ni perfil.

Proporción de las piezas y navegación también quedan para el plan. `docs/SYSTEM.md` no los decide.

## Licencia y procedencia

El archivo de QC no trae un `LICENSE`. Plus Jakarta Sans es SIL Open Font License y se pide a Google Fonts igual que en QC; no está vendoreada. Sonner entra como dependencia. No se copiaron imágenes ni marcas de QC.

El código visual sale del árbol de QC del usuario, en el commit de arriba, para este draft nuevo.
