# Aceptación de la reconstrucción — 2026-11-12

Proyecto de destino: Supabase QCL `mdytuysdombxyydqnsmj`. Rama local: `rebuild/qcl`.

## Verificado

- Supabase, solo lectura: `public.profiles` y `public.books` existen, tienen RLS activa y políticas `authenticated` limitadas por `auth.uid()`; el check de `read_at` exige `status = 'lei'`.
- Local: 10 tests unitarios, typecheck, lint, build y `git diff --check` pasaron.
- API local: los cuatro títulos de la sección 7.2 dieron resultados con sus autores y la primera opción de cada uno devolvió una tapa `image/jpeg` 200 en el ensayo final. Se rechazaron hosts fuera de la lista blanca y placeholders de Google observados.
- Navegador local a 390 y 430 px: `/`, `/agregar` y `/vos` redirigieron a `/entrar` sin sesión. Se revisó la pantalla de acceso; no hubo errores de consola después de agregar el favicon.
- El archivo generado de Wrangler declara `name: "qcl"`.

## Pendiente

- Comparación visual de Inicio y ficha con `mock-home-B.png` y `mock-modal-A.png`: no se recibieron esas imágenes.
- Auth privada: no se verificó la opción real `Confirm email`. No se modificó Auth.
- Flujos con sesión: registro, login, guardar/cambiar/quitar, carga manual, perfil, aislamiento A/B y cierre de sesión. El archivo de logins indicado antes no está presente en esta copia; no se crearon usuarios ni filas.
- Escaneo con cámara física, permiso denegado, teclado iOS y navegador en el worker desplegado.
- Limpieza de cuentas y filas de aceptación: no se provisionaron fixtures, por lo que no hubo nada que limpiar.

La búsqueda pública depende de Open Library y Google Books. En este ensayo Google Books respondió 429 por cuota; el servidor lo trató como fuente sin resultados y continuó con Open Library. La selección de tapa puede variar entre ediciones y solicitudes. No se desplegó ni se hizo merge a `main`.
