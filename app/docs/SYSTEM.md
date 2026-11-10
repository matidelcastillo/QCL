# Sistema visual

Reglas de material, tipo, espacio y movimiento copiadas de `SYSTEM.md` en QC `16cab3a412a90785469a1aa3b8997332ba93f678`. No son un plan de producto. La navegación, la proporción de las piezas y la persistencia siguen sin decidir.

Regla central: no crear one-offs. Toda decisión repetida vive en un token, una clase compartida o un componente.

## Principios

- Mobile-first, respuesta rápida y simple.
- Antes de corregir una excepción, retirar el workaround que la originó.
- No agregar animación, brillo o pantallas sin mejorar una acción o explicar un estado.
- Si una regla existente no alcanza, actualizar el sistema antes que crear un valor local.

## Tipografía

- Familia única: `Plus Jakarta Sans`, con fallback `Helvetica, Arial, sans-serif`.
- Títulos: extrabold o black.
- Lectura: regular o semibold.
- Acciones: bold, cortas y directas.
- No agregar familias decorativas, monospace ni tracking negativo.
- Si el texto no entra, ajustar primero el copy y luego el tamaño.

El comentario de Inter en el CSS fuente no describe la fuente real. El body usa `--font-sans`, que apunta a Plus Jakarta Sans. Los `@import` de `@fontsource/inter` no se copiaron.

## Espaciado

| Token          | Valor | Uso                                          |
| -------------- | ----: | -------------------------------------------- |
| `--space-1`    |   4px | Dentro de un bloque                          |
| `--space-2`    |   8px | Separadores cortos                           |
| `--space-4`    |  16px | Elementos relacionados o cards               |
| `--space-8`    |  32px | Secciones                                    |
| `--filter-gap` |  10px | Separación horizontal entre filtros de texto |

- No inventar márgenes, paddings ni gaps inline cuando existe un token equivalente.
- El header de marca usa `24px 20px 20px` encima del safe-area, no un segundo inset de notch.

## Interacción

- Card clickeable: `scale(var(--press-card-scale))`.
- Botón clickeable: `scale(var(--press-button-scale))`.
- Press: `--ease-press` + `--dur-press`.
- Entrada: `--ease-enter` + `--dur-enter`.
- Pop: `--ease-bounce` + `--dur-bounce`.
- Fade: `--ease-fade` + `--dur-fade`.
- No aplicar press a sliders, inputs, superficies decorativas o tabs no accionables.
- Hover funcional solo con puntero real.
- Todo motion debe respetar `prefers-reduced-motion`.

## Navegación inferior

- Usar los tokens `--nav-*` y la clase compartida `.app-bottom-nav`.
- El activo se indica con el icono blanco, sin círculo, frame, fondo ni sombra.
- Mantener el área táctil mínima de 44px aunque no tenga contenedor visible.
- Cada acción debe tener nombre accesible y `aria-current="page"` cuando corresponda.

Esta cáscara no dibuja la barra. Tres slots, filtros, lista/grilla y drawers existen como CSS para más adelante. Ponerlos ahora sería un control que no hace nada. Qué se navega, y en qué proporción, queda para el plan.

## Glass, cards y viewport

- Usar `.glass` y sus tokens compartidos. No duplicar backgrounds, borders, blur o shadows.
- Botones naranja usan el material compartido del navbar. Pills naranja agregan `.glass-orange-pill-material`.
- Botones blancos usan `.glass-white-treatment` con `sheen-top`.
- Mantener fallback sólido y texto legible sin `backdrop-filter`.
- Glow y sheen son acentos, no decoración predeterminada.
- Mobile conserva el layout hasta 430px (`--app-viewport-max`).
- Respetar notch, teclado y barra inferior. Los insets viven en `--safe-top` y `--safe-bottom`.
- Inputs de texto: mínimo 16px para evitar zoom en iOS.
- No depender de hover, cursor ni precisión de escritorio.

## Qué de SYSTEM.md no se trajo

Son reglas de producto de QC, no de esta base:

- Contenido de drawers de eventos (fecha, hora, venue) y las acciones LIKE / SHARE / INFO / GO.
- Abrir mapas con el venue como búsqueda.
- Filtro barrial, slider de mapa y cards de timeline como comportamiento de agenda.
- `/empty-state.gif` y el copy de estados vacíos de esa app.
- Identificación de analytics y cualquier opt-out asociado.
- Restricciones de `BRAND.md` sobre eventos, CABA y el producto de cultura. No aplican a libros y no se copiaron.
