// Estilos compartidos para los headers de Eventos y Lugares del home QC.
import type { CSSProperties } from "react";

// El wrapper global (.safe-area-top, __root.tsx) ya suma env(safe-area-inset-top)
// arriba de todo — este 24px es aire de diseño encima de eso, no clearance
// de notch (antes 40px, se acumulaba con el safe-area y quedaba excesivo).
export const BRAND_HEADER_PADDING = "24px 20px 20px";

export const brandTitleStyle = (font: string, color: string): CSSProperties => ({
  fontFamily: font,
  fontSize: "26px",
  fontWeight: 800,
  letterSpacing: "-0.03em",
  color,
  lineHeight: 1.1,
});

export const brandSubtitleStyle = (font: string, mutedColor: string): CSSProperties => ({
  fontFamily: font,
  fontSize: "21px",
  fontWeight: 600,
  color: mutedColor,
  letterSpacing: "-0.01em",
  // lineHeight 1 recortaba los descendentes (y, p, g) contra el
  // overflow:hidden — 1.2 les da aire sin reabrir el hueco visible que
  // el marginTop de acá abajo ya viene compensando.
  lineHeight: 1.2,
  marginTop: "4px",
  // Antes era nowrap+ellipsis y comía el final del subtítulo de Lugares
  // ("…y tu vieja tamb…") en pantallas de 375px. Ahora envuelve a 2 líneas
  // como máximo.
  display: "-webkit-box",
  WebkitBoxOrient: "vertical" as const,
  WebkitLineClamp: 2,
  overflow: "hidden",
});
