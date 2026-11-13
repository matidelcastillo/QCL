# Sistema visual QCL

Fuente de tokens y patrones: repo QC, leído sin modificaciones. La app usa `src/styles/tokens.css` para todos los valores y `src/styles/components.css` para las recetas compartidas. La proporción de tapa `--qcl-cover-ratio` es la única excepción declarada en el instructivo.

- Plus Jakarta Sans es la única familia.
- Las filas son editoriales, sin tarjeta ni sombra.
- Nav naranja, pills, bottom sheets, inputs y botones comparten clases.
- Los controles táctiles tienen 44 px como mínimo; los inputs mantienen 16 px.
- `prefers-reduced-motion` y `prefers-reduced-transparency` tienen fallback.
- Ninguna pantalla usa toast.

Falta verificar la composición contra `mock-home-B.png` y `mock-modal-A.png`, que no están disponibles.
