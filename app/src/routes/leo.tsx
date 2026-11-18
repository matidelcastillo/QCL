import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { CatalogBook } from "../domain/types";
import {
  LEO_STEPS,
  parseLeoAnswers,
  recentRead,
  type LeoAnswers,
  type LeoPurpose,
  type LeoMood,
  type LeoTopic,
  type LeoPace,
} from "../domain/leo";
import { requestLeo, type LeoResult } from "../data/leo";
import { useSession } from "../data/session-context";
import { useBooks } from "../data/use-books";
import { BrandHeader, ScreenHeading } from "../components/brand-header";
import { BookCover } from "../components/book-cover";
import { BookTile } from "../components/book-tile";
import { BookSheet } from "../components/book-sheet";
import { EmptyState, LoadError } from "../components/feedback";
import { LoadingTiles } from "../components/skeleton";
import { buttonClass } from "../components/button";
import { useDeferredPending } from "../components/use-deferred-pending";

export const Route = createFileRoute("/leo")({ component: Leo });

type Draft = {
  purpose?: LeoPurpose;
  mood?: LeoMood;
  topic?: LeoTopic;
  pace?: LeoPace;
  anchor: LeoAnswers["anchor"];
};

function toAnswers(draft: Draft): LeoAnswers | null {
  return parseLeoAnswers({ ...draft, anchor: draft.anchor ?? null });
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={`Paso ${step + 1} de ${total}`}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step + 1}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`progress-seg${index <= step ? " is-on" : ""}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function Leo() {
  const navigate = useNavigate();
  const { user } = useSession();
  const books = useBooks(user?.id);
  const read = recentRead(books.data ?? []);
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({ anchor: null });
  const [results, setResults] = useState<LeoResult[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<LeoResult | null>(null);
  const showSkeleton = useDeferredPending(pending);
  const current = LEO_STEPS[Math.min(step, LEO_STEPS.length - 1)];
  const onResults = results != null && !pending && !error;

  function goBack() {
    if (onResults || pending || error) {
      void navigate({ to: "/vos" });
      return;
    }
    if (step === 0) {
      void navigate({ to: "/vos" });
      return;
    }
    setStep((value) => value - 1);
  }

  async function finish(next: Draft) {
    const answers = toAnswers(next);
    if (!answers) return;
    setPending(true);
    setError(false);
    setResults(null);
    setNote(null);
    try {
      const payload = await requestLeo(answers);
      setResults(payload.results);
      setNote(payload.note);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }

  function choose(key: (typeof LEO_STEPS)[number]["key"], value: string | Draft["anchor"]) {
    const next = { ...draft, [key]: value } as Draft;
    setDraft(next);
    if (key === "anchor") void finish(next);
    else setStep((value) => value + 1);
  }

  const title = onResults || pending || error ? "Qué leo" : current.title;
  const progressStep = onResults || pending || error ? LEO_STEPS.length - 1 : step;

  return (
    <main className="page-pb-nav flow-screen">
      <BrandHeader />
      <div className="flow-bar">
        <button type="button" className="text-action qc-press" onClick={goBack}>
          Atrás
        </button>
      </div>
      <ScreenHeading>{title}</ScreenHeading>
      <Progress step={progressStep} total={LEO_STEPS.length} />
      {showSkeleton || pending ? (
        showSkeleton ? (
          <section className="feed app-gutter" aria-busy="true">
            <LoadingTiles count={6} />
          </section>
        ) : null
      ) : error ? (
        <section className="feed app-gutter">
          <LoadError retry={() => void finish(draft)} />
        </section>
      ) : onResults && (results ?? []).length === 0 ? (
        <section className="feed app-gutter">
          <EmptyState text="Nada esta vez.">
            <button
              type="button"
              className={buttonClass("primary")}
              onClick={() => void finish(draft)}
            >
              Probar de nuevo
            </button>
          </EmptyState>
        </section>
      ) : onResults ? (
        <>
          {note && <p className="leo-note">{note}</p>}
          <section className="leo-grid" aria-live="polite">
            {(results ?? []).map((book) => (
              <button
                type="button"
                className="leo-card qc-press-card"
                key={book.id}
                onClick={() => setSelected(book)}
              >
                <span className="leo-card-cover">
                  <BookCover url={book.coverUrl} isbn={book.isbn} size="tile" />
                </span>
                <span className="leo-card-copy">
                  <span className="leo-card-title">{book.title}</span>
                  <span className="leo-card-value">{book.value}</span>
                </span>
              </button>
            ))}
          </section>
        </>
      ) : current.key === "anchor" ? (
        <div className="question-body">
          {read.length > 0 && (
            <div className="book-grid leo-anchor-grid app-gutter">
              {read.map((book, index) => (
                <BookTile
                  key={book.id}
                  book={book}
                  index={index}
                  onOpen={() =>
                    choose("anchor", {
                      title: book.title,
                      author: book.author,
                      isbn: book.isbn,
                      page_count: book.page_count,
                      source: book.source,
                      externalId: book.external_id,
                    })
                  }
                />
              ))}
            </div>
          )}
          <button
            type="button"
            className="text-action skip-action qc-press"
            onClick={() => choose("anchor", null)}
          >
            Saltar
          </button>
        </div>
      ) : (
        <div className="question-body">
          <div className="chip-stack" role="group" aria-label={current.title}>
            {"options" in current &&
              current.options.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="filter-tab"
                  aria-pressed={draft[current.key] === key}
                  onClick={() => choose(current.key, key)}
                >
                  {label}
                </button>
              ))}
          </div>
        </div>
      )}
      {selected && (
        <BookSheet
          book={toSheetBook(selected)}
          buyLink={selected.buyLink}
          onClose={() => setSelected(null)}
        />
      )}
    </main>
  );
}

function toSheetBook(book: LeoResult): CatalogBook {
  return {
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    page_count: book.page_count,
    published_year: book.published_year,
    synopsis: book.synopsis,
    coverUrl: book.coverUrl,
    source: book.source === "manual" ? "openlibrary" : book.source,
    externalId: book.externalId,
    subjects: book.subjects,
    categories: book.categories,
    buyLink: book.buyLink,
  };
}
