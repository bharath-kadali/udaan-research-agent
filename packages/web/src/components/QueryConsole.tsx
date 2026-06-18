interface QueryConsoleProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSample: () => void;
  busy: boolean;
}

export function QueryConsole({ value, onChange, onSubmit, onSample, busy }: QueryConsoleProps) {
  return (
    <section className="console" aria-label="Research query">
      <label className="console__label" htmlFor="query">
        Research question
      </label>
      <textarea
        id="query"
        className="console__input"
        rows={3}
        placeholder="e.g. How does micro-caching impact p99 tail latency in distributed stateful systems?"
        value={value}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit();
        }}
      />
      <div className="console__row">
        <span className="console__hint">⌘/Ctrl + Enter to run</span>
        <div className="console__actions">
          <button type="button" className="btn btn--ghost" onClick={onSample} disabled={busy}>
            See a sample brief
          </button>
          <button type="button" className="btn btn--accent" onClick={onSubmit} disabled={busy || value.trim().length < 8}>
            {busy ? "Synthesizing…" : "Run synthesis"}
          </button>
        </div>
      </div>
    </section>
  );
}
