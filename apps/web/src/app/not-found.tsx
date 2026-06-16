import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-base px-6">
      <div className="fade-up flex w-full max-w-md flex-col items-center text-center">
        {/* Code mark */}
        <span className="mb-6 font-mono text-sm tracking-[0.2em] text-ink-faint">
          ERROR 404
        </span>

        <h1 className="font-serif text-4xl font-medium tracking-tight text-ink-bright">
          This page slipped your mind
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-ink-muted">
          The page you’re looking for doesn’t exist, or has been moved
          somewhere else in your workspace.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/tasks"
            className="flex h-9 items-center rounded-[8px] bg-brand px-3.5 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-bright active:scale-[0.98]"
          >
            Back to Tasks
          </Link>
          <Link
            href="/inbox"
            className="flex h-9 items-center rounded-[8px] border border-line-2 bg-fill px-3.5 text-sm font-medium text-ink-2 transition-colors hover:border-line-strong hover:bg-raise hover:text-ink"
          >
            Go to Inbox
          </Link>
        </div>
      </div>
    </main>
  );
}
