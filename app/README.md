# QCL — que carajo leer

Biblioteca privada de libros en dos estados: Quiero y Leí. La app está en `app/` y apunta únicamente a Supabase QCL `mdytuysdombxyydqnsmj`.

## Desarrollo local

Copiar `.env.example` a `.env` y completar solo la clave **publicable** de QCL. La service role no debe entrar al navegador ni al repositorio.

```bash
bun install --frozen-lockfile
bun run dev
bun run test
bun run typecheck
bun run lint
bun run build
```

El servidor expone `/api/libros` (Open Library y Google Books, con 429 como fuente vacía) y `/api/tapa` (proxy con hosts permitidos, validación de imagen y respaldo por ISBN). Las tablas `public.books` y `public.profiles` ya existen. Esta rama no agrega migraciones.

## Estado de verificación

El build, los tests unitarios, el typecheck y el lint se ejecutan localmente. Las decisiones de producto que un auditor no debe reflagar están en [`docs/DECISIONS.md`](../docs/DECISIONS.md). El flujo autenticado, cámara física, aislamiento entre dos usuarios y comparación con los mocks requieren aceptación aparte. Los archivos `mock-home-B.png` y `mock-modal-A.png` no fueron entregados.

La publicación al worker `qcl` requiere aprobación separada. No se publica a `qcba`.
