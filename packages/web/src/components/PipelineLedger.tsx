import { PHASES, type PhaseStatus } from "../types.js";

interface PipelineLedgerProps {
  statuses: Record<number, PhaseStatus>;
  details: Record<number, string | undefined>;
}

const GLYPH: Record<PhaseStatus, string> = { pending: "", active: "", done: "✓" };

export function PipelineLedger({ statuses, details }: PipelineLedgerProps) {
  return (
    <section className="ledger" aria-label="Pipeline progress">
      <h2 className="ledger__title">Provenance pipeline</h2>
      <ol className="ledger__list">
        {PHASES.map(({ phase, name }) => {
          const status = statuses[phase] ?? "pending";
          return (
            <li key={phase} className={`ledger__row ledger__row--${status}`}>
              <span className="ledger__index">{String(phase).padStart(2, "0")}</span>
              <span className="ledger__dot" aria-hidden="true">
                {GLYPH[status]}
              </span>
              <span className="ledger__body">
                <span className="ledger__name">{name}</span>
                {details[phase] ? <span className="ledger__detail">{details[phase]}</span> : null}
              </span>
              <span className="ledger__status">{status}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
