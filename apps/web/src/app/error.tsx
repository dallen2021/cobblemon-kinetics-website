"use client";

export default function ErrorBoundary({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="centered-page">
      <section className="material-panel auth-card">
        <p className="eyebrow">Line stopped</p>
        <h1>The workshop hit an unexpected fault.</h1>
        <p>No draft was intentionally overwritten. Retry the request or return to the wiki.</p>
        <button className="button button-primary" type="button" onClick={reset}>
          Retry
        </button>
      </section>
    </main>
  );
}
