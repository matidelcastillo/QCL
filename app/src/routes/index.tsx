import { createFileRoute } from "@tanstack/react-router";
import {
  BRAND_HEADER_PADDING,
  brandSubtitleStyle,
  brandTitleStyle,
} from "@/lib/brand-header-style";

const FONT = "'Plus Jakarta Sans', Helvetica, Arial, sans-serif";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <header style={{ padding: BRAND_HEADER_PADDING }}>
      <div className="app-brand-header-row">
        <h1 className="app-brand-title" style={{ ...brandTitleStyle(FONT, "#0A0A0A"), margin: 0 }}>
          <span style={{ color: "#E8624A" }}>qué carajo</span> <span>leer</span>
        </h1>
      </div>
      <p style={{ ...brandSubtitleStyle(FONT, "#C0BCB6"), margin: 0 }}>Todavía no hay libros.</p>
    </header>
  );
}
