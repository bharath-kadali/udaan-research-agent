# @udaan/contracts

The cross-phase data contracts — **the source of truth for every phase boundary**.

## How it works

- **`schema/*.schema.json`** — JSON Schema is the single source of truth.
- **`src/generated/*.ts`** — TypeScript view (generated; re-exported from `src/index.ts`).
- **`python/udaan_contracts/models.py`** — Pydantic view (generated re-exports from `generated/`).

Both language views are **code-generated** from the schemas:

```bash
pnpm --filter @udaan/contracts gen
```

This runs `json-schema-to-typescript` for the TS types and `datamodel-code-generator`
for the Pydantic models. **Do not hand-edit generated files** — change the schema,
then regenerate.

### Drift check

CI (and locally) verifies committed generated output matches a fresh run:

```bash
pnpm --filter @udaan/contracts check-drift
```

If this fails, run `gen` and commit the updated artifacts.

## The rule

**Validate at every boundary.** Every cross-service HTTP call and every BullMQ
job payload validates against the matching schema, so a drift between the TS and
Python sides fails loudly instead of silently corrupting traceability.

## Coverage

| Contract | Producer → Consumer |
| --- | --- |
| `CompiledDiscoveryManifest` | Phase 1 → 2 |
| `CandidatePaper` | Phase 2 → 3 |
| `PrioritizedIngestionIndex` / `RankedPaper` | Phase 3 → 4 |
| `ResolutionManifest` | Phase 4 → 5 |
| `ValidatedClaim` / `IngestResult` | Phase 5 → 6 |
| `SynthesisGraph` | Phase 6 → 7 |
| `ResearchBrief` | Phase 7 → UI |
| Enums: `ResolutionStatus`, `ClaimClassification`, `ClusterPolarity` | shared |
