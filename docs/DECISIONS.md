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

## Qué leo

Está apagado por decisión de producto, desde el 2026-11-18. El interruptor es `LEO_ENABLED` en `app/src/domain/leo.ts`. No reportar la ausencia del botón o del endpoint como hallazgo.
