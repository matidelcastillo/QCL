import { createFileRoute } from "@tanstack/react-router";
import { CatalogSearch } from "@/components/catalog-search";
import {
  BRAND_HEADER_PADDING,
  brandSubtitleStyle,
  brandTitleStyle,
} from "@/lib/brand-header-style";

const FONT = "'Plus Jakarta Sans', Helvetica, Arial, sans-serif";

export const Route = createFileRoute("/agregar")({
  component: Buscar,
});

function Buscar() {
  return (
    <main className="qcl-page page-pb-nav">
      <header style={{ padding: BRAND_HEADER_PADDING, paddingLeft: 0, paddingRight: 0 }}>
        <div className="app-brand-header-row">
          <h1
            className="app-brand-title"
            style={{ ...brandTitleStyle(FONT, "#0A0A0A"), margin: 0 }}
          >
            Buscar
          </h1>
        </div>
        <p style={{ ...brandSubtitleStyle(FONT, "#C0BCB6"), margin: 0 }}>Buscá o escaneá.</p>
      </header>
      <CatalogSearch afterAdd="home" />
    </main>
  );
}
