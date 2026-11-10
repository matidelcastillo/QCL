import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CatalogResults } from "@/components/catalog-results";
import { IsbnScanner } from "@/components/isbn-scanner";
import { openCameraStream } from "@/lib/camera";
import { StatusChoice } from "@/components/status-tabs";
import { useAuth } from "@/lib/auth-session";
import { insertBook, insertCatalogBook } from "@/lib/books";
import {
  BRAND_HEADER_PADDING,
  brandSubtitleStyle,
  brandTitleStyle,
} from "@/lib/brand-header-style";
import { searchCatalog } from "@/lib/catalog-client";
import { todayIsoDate } from "@/lib/format";
import { queryLooksLikeIsbn } from "@/lib/isbn";
import type { BookStatus, CatalogBook } from "@/lib/types";

const FONT = "'Plus Jakarta Sans', Helvetica, Arial, sans-serif";

export const Route = createFileRoute("/agregar")({
  component: Agregar,
});

function Agregar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scanStream, setScanStream] = useState<MediaStream | null>(null);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [status, setStatus] = useState<BookStatus>("quiero");
  const [readAt, setReadAt] = useState(todayIsoDate());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    const isbnQuery = queryLooksLikeIsbn(trimmed);
    if (trimmed.length < 3 && !isbnQuery) {
      setResults([]);
      setSearching(false);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = window.setTimeout(
      () => {
        void searchCatalog(trimmed)
          .then((books) => {
            if (cancelled) return;
            setResults(books);
            setSearched(true);
          })
          .catch(() => {
            if (cancelled) return;
            setResults([]);
            setSearched(true);
            toast.error("No se pudo buscar ahora.");
          })
          .finally(() => {
            if (!cancelled) setSearching(false);
          });
      },
      isbnQuery ? 0 : 350,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query]);

  const closeScanner = useCallback(() => {
    setScanStream((current) => {
      current?.getTracks().forEach((track) => track.stop());
      return null;
    });
  }, []);

  const handleDetect = useCallback(
    (isbn: string) => {
      closeScanner();
      setQuery(isbn);
    },
    [closeScanner],
  );

  async function startScanner() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Este aparato no puede abrir la cámara. Probá desde el teléfono.");
      return;
    }
    try {
      const stream = await openCameraStream();
      setScanStream(stream);
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error("Necesitamos la cámara para leer el código. Autorizala y volvé a intentar.");
      } else if (name === "NotFoundError") {
        toast.error("Este aparato no tiene una cámara que podamos usar.");
      } else {
        toast.error("No se pudo abrir la cámara.");
      }
    }
  }

  async function refreshList() {
    if (user) await queryClient.invalidateQueries({ queryKey: ["books", user.id] });
  }

  async function addFromCatalog(book: CatalogBook, nextStatus: BookStatus) {
    if (!user || busyId) return;
    setBusyId(book.externalId);
    try {
      await insertCatalogBook(user.id, book, nextStatus);
      await refreshList();
      toast.success("Listo, quedó en tu lista.");
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!user || busy) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    setBusy(true);
    try {
      await insertBook({
        ownerId: user.id,
        title: trimmedTitle,
        author,
        status,
        readAt,
      });
      await refreshList();
      toast.success("Listo, quedó en tu lista.");
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar.");
    } finally {
      setBusy(false);
    }
  }

  const canSearch = query.trim().length >= 3 || queryLooksLikeIsbn(query);

  return (
    <main className="qcl-page page-pb-nav">
      <header style={{ padding: BRAND_HEADER_PADDING, paddingLeft: 0, paddingRight: 0 }}>
        <div className="app-brand-header-row">
          <h1
            className="app-brand-title"
            style={{ ...brandTitleStyle(FONT, "#0A0A0A"), margin: 0 }}
          >
            Agregar
          </h1>
        </div>
        <p style={{ ...brandSubtitleStyle(FONT, "#C0BCB6"), margin: 0 }}>
          Buscalo o escanealo. Si no está, cargalo a mano.
        </p>
      </header>

      <div className="qcl-search-row">
        <label className="qcl-field qcl-search-field">
          <span>Buscar</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Título, autor o ISBN"
            autoComplete="off"
            enterKeyHint="search"
            inputMode="search"
          />
        </label>
        <button
          type="button"
          className="qcl-scan-btn"
          onClick={() => void startScanner()}
          aria-label="Escanear código de barras"
        >
          Escanear
        </button>
      </div>

      {searching ? <p className="qcl-empty">Buscando…</p> : null}
      {!searching && searched && canSearch && results.length === 0 ? (
        <p className="qcl-empty">No encontramos eso. Probá con otras palabras o cargalo a mano.</p>
      ) : null}

      <CatalogResults
        books={results}
        busyId={busyId}
        onAdd={(book, next) => void addFromCatalog(book, next)}
      />

      <details className="qcl-manual" open={results.length === 0}>
        <summary>Cargalo a mano</summary>
        <form className="qcl-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="qcl-field">
            <span>Título</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <label className="qcl-field">
            <span>Autor</span>
            <input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="qcl-field">
            <span>Estado</span>
            <StatusChoice value={status} onChange={setStatus} />
          </div>
          {status === "lei" ? (
            <label className="qcl-field">
              <span>Cuándo lo leíste</span>
              <input
                type="date"
                value={readAt}
                onChange={(event) => setReadAt(event.target.value)}
              />
            </label>
          ) : null}
          <button type="submit" className="qcl-primary-btn" disabled={busy || !title.trim()}>
            Guardar
          </button>
        </form>
      </details>

      {scanStream ? (
        <IsbnScanner stream={scanStream} onDetect={handleDetect} onClose={closeScanner} />
      ) : null}
    </main>
  );
}
