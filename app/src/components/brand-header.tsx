/* QC routes/index.tsx l. 1779-1786: brand header (BRAND_HEADER_PADDING + brandTitleStyle). */
export function BrandHeader({ heading = false }: { heading?: boolean }) {
  const Title = heading ? "h1" : "div";
  return (
    <header className="app-brand-header">
      <div className="app-brand">
        <img className="app-brand-icon" src="/favicon.svg" width={48} height={48} alt="" />
        <Title className="app-brand-title">
          <span className="app-brand-accent">qué carajo</span> lees
        </Title>
      </div>
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
