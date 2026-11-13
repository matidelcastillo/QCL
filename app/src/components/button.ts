/* QC button recipe (components/home/HomeFeedback.tsx "Reintentar"):
   orange = navbar material; white = .glass-white-treatment (QC SYSTEM.md). */
const material = {
  primary:
    "qc-button-primary glass glass-orange glass-orange-treatment glass-orange-nav-material sheen-top",
  secondary: "qc-button-secondary glass glass-white-treatment sheen-top",
} as const;

export function buttonClass(variant: keyof typeof material, block = false): string {
  return `qc-button ${material[variant]} qc-press${block ? " qc-button-block" : ""}`;
}
