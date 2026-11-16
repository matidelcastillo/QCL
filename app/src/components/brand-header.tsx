/* QC routes/index.tsx l. 1779-1786: brand header (BRAND_HEADER_PADDING + brandTitleStyle). */
/* Subtitle: QC lib/brand-header-style.ts brandSubtitleStyle (l. 1786). */
export function BrandHeader({
  heading = false,
  subtitle,
}: {
  heading?: boolean;
  subtitle?: string;
}) {
  const Title = heading ? "h1" : "div";
  return (
    <header className="app-brand-header">
      <Title className="app-brand-title">
        <span className="app-brand-accent">qué carajo</span> lees
      </Title>
      {subtitle && <p className="app-brand-subtitle">{subtitle}</p>}
    </header>
  );
}

/* QC routes/index.tsx l. 1796-1815: screen heading ("Agendaste."). */
export function ScreenHeading({ children }: { children: string }) {
  return (
    <div className="screen-heading app-gutter">
      <h1 className="screen-title">{children}</h1>
    </div>
  );
}
