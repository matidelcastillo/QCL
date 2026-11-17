import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandHeader, ScreenHeading } from "../components/brand-header";
import { useSession } from "../data/session-context";

export const Route = createFileRoute("/soporte")({ component: Support });

const CONTACT = "ciao@pepperhotstudio.com";

function Support() {
  const { user } = useSession();
  return (
    <main className={user ? "page-pb-nav" : undefined}>
      <BrandHeader />
      <ScreenHeading>Soporte</ScreenHeading>
      <div className="stack-loose app-gutter legal-copy">
        <p>Qué Carajo Lee es una app para guardar tu lista de libros.</p>
        <p>
          Si tenés un problema o una consulta, escribí a <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
          .
        </p>
        <p>
          Para borrar tu cuenta: en la app, andá a Vos (Tu racconto) → Eliminar cuenta → confirmá.
          Eso borra tu usuario, tu perfil y todos tus libros.
        </p>
        {!user && (
          <Link to="/entrar" className="text-action">
            Volver
          </Link>
        )}
      </div>
    </main>
  );
}
