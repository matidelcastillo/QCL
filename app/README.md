# QCL — Qué Carajo Leer

Web app para anotar lo que querés leer y lo que ya leíste. Es para vos y un par de amigos.

La base visual sigue la de QC. En E2 ya hay cuentas, lista, alta a mano y perfil.

## En el teléfono

Abrí [https://qcl.matidelcastillo.workers.dev](https://qcl.matidelcastillo.workers.dev)

Creá una cuenta con tu email y una contraseña. Después podés:

- buscar un libro por título, autor o ISBN y agregarlo de un toque como Quiero o Leí
- escanear el código de barras con la cámara del teléfono
- si no aparece, cargarlo a mano
- ver tus libros y filtrarlos
- editarlos o sacarlos
- poner tu nombre en Vos, ver los contadores y el último leído
- salir

Cada persona ve solo su lista.

## Cómo correrlo en la compu

Hace falta [Bun](https://bun.sh). Copiá `app/.env.example` a `app/.env` y completá la clave pública de Supabase (nunca la service role).

```bash
cd app
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
bun run deploy
```

`bun run deploy` publica el worker `qcl` en Cloudflare, a `https://qcl.matidelcastillo.workers.dev`. Usa el config que genera Nitro en `.output/server/wrangler.json`.

## Qué hay en la base

Proyecto de Supabase: `mdytuysdombxyydqnsmj` (solo QCL, nunca QC).

- `public.books`: título, autor, estado `quiero` o `lei`, fecha de lectura opcional, tapa, ISBN e id externo
- `public.profiles`: nombre para Vos
- RLS básico: cada usuario lee y toca solo sus filas

La confirmación de email del proyecto hay que dejarla apagada. El correo default de Supabase no les llega a tus amigos (solo al equipo, y además tiene un tope bajo). Con la confirmación apagada, al crear la cuenta ya entran.

## De dónde salió la cáscara visual

La fuente fue un zip de solo lectura del árbol trackeado de QC, commit comentado `16cab3a412a90785469a1aa3b8997332ba93f678`. QC no se modifica desde acá. El detalle de qué se copió y qué no está en el historial de esta carpeta y en `docs/SYSTEM.md`.

## Catálogo y escáner

La búsqueda combina Open Library (siempre, desde el server) y Google Books (sin clave; si el server está saturado, se intenta desde el teléfono). No hay clave paga ni service role en el cliente.

El escáner usa la cámara: `BarcodeDetector` cuando el navegador lo trae, y ZXing si no. Hace falta HTTPS, que ya está en workers.dev, y permiso de cámara. Funciona con códigos ISBN / EAN-13 de libro (978 y 979).
