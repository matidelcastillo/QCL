import { createFileRoute, Link } from "@tanstack/react-router";
import { BrandHeader, ScreenHeading } from "../components/brand-header";
import { useSession } from "../data/session-context";

export const Route = createFileRoute("/privacidad")({ component: Privacy });

const CONTACT = "matidelcastillo@gmail.com";

function Privacy() {
  const { user } = useSession();
  return (
    <main className={user ? "page-pb-nav" : undefined}>
      <BrandHeader />
      <ScreenHeading>Privacidad</ScreenHeading>
      <div className="stack-loose app-gutter legal-copy">
        <p>QCL sirve para guardar tu lista de libros y ver qué leen otras personas de la app.</p>
        <p>Juntamos estos datos:</p>
        <p>
          El email y la contraseña de tu cuenta (la contraseña la guarda Supabase, no la vemos en
          texto). El nombre, si lo escribís al crear la cuenta. Tu biblioteca: título, autor, ISBN,
          si lo querés leer o ya lo leíste, la fecha, la tapa y, si está, la sinopsis o el género.
        </p>
        <p>
          Los usamos para que entres a tu cuenta, se conserve tu lista y se arme “qué lee la gilada”
          (lecturas de otras personas, sin decir quién). El escáner de ISBN usa la cámara en el
          momento; no guardamos esa foto.
        </p>
        <p>
          Quienes procesan esos datos: Supabase (cuenta y biblioteca), Cloudflare (la app y el
          worker), Open Library y Google Books (búsqueda de libros y tapas) y Workers AI de
          Cloudflare (para sugerir el género al guardar un libro).
        </p>
        <p>
          Los terceros que procesan estos datos ofrecen una protección equivalente a la descrita en
          esta política.
        </p>
        <p>No hay publicidad ni seguimiento entre apps. No vendemos datos.</p>
        <p>
          Los datos se conservan mientras tengas cuenta. En Tu racconto podés tocar “Eliminar
          cuenta”: se borra tu usuario, tu perfil y todos tus libros.
        </p>
        <p>
          Contacto: <a href={`mailto:${CONTACT}`}>{CONTACT}</a>
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
