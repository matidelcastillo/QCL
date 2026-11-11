import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CatalogResults } from "@/components/catalog-results";
import { IsbnScanner } from "@/components/isbn-scanner";
import { StatusChoice } from "@/components/status-tabs";
import { useAuth } from "@/lib/auth-session";
import { insertBook, insertCatalogBook } from "@/lib/books";
import { openCameraStream } from "@/lib/camera";
import { searchCatalog } from "@/lib/catalog-client";
import { todayIsoDate } from "@/lib/format";
import { queryLooksLikeIsbn } from "@/lib/isbn";
import type { BookStatus, CatalogBook } from "@/lib/types";

export function CatalogSearch({
  afterAdd = "stay",
  onActiveChange,
}: {
  afterAdd?: "stay" | "home";
  onActiveChange?: (active: boolean) => void;
}) {
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
  const [manualOpen, setManualOpen] = useState(false);

  const canSearch = query.trim().length >= 3 || queryLooksLikeIsbn(query);

  useEffect(() => {
    onActiveChange?.(canSearch || Boolean(scanStream));
  }, [canSearch, onActiveChange, scanStream]);

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
            toast.error("No se pudo buscar.");
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
      toast.error("Usá el teléfono.");
      return;
    }
    try {
      const stream = await openCameraStream();
      setScanStream(stream);
    } catch (caught) {
      const name = caught instanceof DOMException ? caught.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        toast.error("Autorizá la cámara.");
      } else if (name === "NotFoundError") {
        toast.error("No hay cámara.");
      } else {
        toast.error("Sin cámara.");
      }
    }
  }

  async function afterInsert() {
    if (user) await queryClient.invalidateQueries({ queryKey: ["books", user.id] });
    toast.success("Listo.");
    setQuery("");
    setResults([]);
    setSearched(false);
    setTitle("");
    setAuthor("");
    if (afterAdd === "home") await navigate({ to: "/" });
  }

  async function addFromCatalog(book: CatalogBook, nextStatus: BookStatus) {
    if (!user || busyId) return;
    setBusyId(book.externalId);
    try {
      await insertCatalogBook(user.id, book, nextStatus);
      await afterInsert();
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
      await afterInsert();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar.");
    } finally {
      setBusy(false);
    }
  }

  const noHits = !searching && searched && canSearch && results.length === 0;

  useEffect(() => {
    if (noHits) setManualOpen(true);
  }, [noHits]);

  return (
    <div className="qcl-catalog-search">
      <div className="qcl-search-row">
        <label className="qcl-field qcl-search-field">
          <span>Buscar</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Título, autor, ISBN"
            autoComplete="off"
            enterKeyHint="search"
            inputMode="search"
          />
        </label>
        <button
          type="button"
          className="qcl-scan-btn"
          onClick={() => void startScanner()}
          aria-label="Escanear"
        >
          Escanear
        </button>
      </div>

      {searching ? <p className="qcl-empty">Buscando…</p> : null}
      {noHits ? <p className="qcl-empty">No está. Cargalo a mano.</p> : null}

      <CatalogResults
        books={results}
        busyId={busyId}
        onAdd={(book, next) => void addFromCatalog(book, next)}
      />

      <details
        className="qcl-manual"
        open={manualOpen}
        onToggle={(event) => setManualOpen(event.currentTarget.open)}
      >
        <summary>A mano</summary>
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
              <span>Fecha</span>
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
    </div>
  );
}
