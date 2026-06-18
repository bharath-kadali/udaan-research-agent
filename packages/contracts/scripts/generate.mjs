/**
 * Regenerate TypeScript and Python contract views from schema/*.schema.json.
 * Schema is canonical; generated output must not be hand-edited.
 */

import { execSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_DIR = path.join(ROOT, "schema");
const TS_OUT = path.join(ROOT, "src", "generated");
const PY_GEN_DIR = path.join(ROOT, "python", "udaan_contracts", "generated");
const PY_MODELS = path.join(ROOT, "python", "udaan_contracts", "models.py");

const TS_HEADER = `/* eslint-disable */
/**
 * AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
 * Regenerate: pnpm --filter @udaan/contracts gen
 */
`;

const PY_MODELS_HEADER = `"""Cross-phase contracts (Pydantic view).

AUTO-GENERATED from schema/*.schema.json — do not edit by hand.
Regenerate: pnpm --filter @udaan/contracts gen

Re-exports the generated modules under udaan_contracts.generated.
"""

from udaan_contracts.generated.candidate_paper_schema import CandidatePaper
from udaan_contracts.generated.compiled_discovery_manifest_schema import (
    Compilations,
    CompiledDiscoveryManifest,
    DiscoveryTelemetry,
    SearchContext,
    TemporalBounds,
)
from udaan_contracts.generated.enums_schema import (
    ClaimClassification,
    ClusterPolarity,
    ResolutionStatus,
)
from udaan_contracts.generated.ingest_result_schema import IngestResult
from udaan_contracts.generated.ranked_paper_schema import PrioritizedIngestionIndex, RankedPaper
from udaan_contracts.generated.research_brief_schema import (
    BibliographyEntry,
    BriefMetadata,
    BriefSection,
    ResearchBrief,
)
from udaan_contracts.generated.resolution_manifest_schema import (
    MetadataSnapshot,
    ResolutionManifest,
    ResolutionManifestEntry,
    ResolutionSummary,
)
from udaan_contracts.generated.synthesis_graph_schema import (
    SynthesisClaimRef,
    SynthesisCluster,
    SynthesisGraph,
)
from udaan_contracts.generated.validated_claim_schema import ClaimLineage, ValidatedClaim

__all__ = [
    "BibliographyEntry",
    "BriefMetadata",
    "BriefSection",
    "CandidatePaper",
    "ClaimClassification",
    "ClaimLineage",
    "ClusterPolarity",
    "Compilations",
    "CompiledDiscoveryManifest",
    "DiscoveryTelemetry",
    "IngestResult",
    "MetadataSnapshot",
    "PrioritizedIngestionIndex",
    "RankedPaper",
    "ResearchBrief",
    "ResolutionManifest",
    "ResolutionManifestEntry",
    "ResolutionStatus",
    "ResolutionSummary",
    "SearchContext",
    "SynthesisClaimRef",
    "SynthesisCluster",
    "SynthesisGraph",
    "TemporalBounds",
    "ValidatedClaim",
]
`;

async function generateTypeScript() {
  await mkdir(TS_OUT, { recursive: true });
  const files = (await readdir(SCHEMA_DIR)).filter(
    (f) => f.endsWith(".schema.json") && f !== "enums.schema.json",
  );

  for (const file of files) {
    const input = path.join(SCHEMA_DIR, file);
    const outPath = path.join(TS_OUT, file.replace(".schema.json", ".ts"));
    const raw = execSync(`npx json2ts -i "${file}"`, { cwd: SCHEMA_DIR, encoding: "utf8" });
    const body = raw.replace(/^\/\* eslint-disable \*\/\r?\n/, "").replace(/^\/\*\*[\s\S]*?\*\/\r?\n\r?\n/, "");
    await writeFile(outPath, TS_HEADER + body);
  }

  const enumsRaw = JSON.parse(await readFile(path.join(SCHEMA_DIR, "enums.schema.json"), "utf8"));
  const defs = enumsRaw.$defs ?? {};
  const enumLines = Object.entries(defs).map(([name, def]) => {
    const values = def.enum.map((v) => JSON.stringify(v)).join(" | ");
    return `export type ${name} = ${values};`;
  });
  await writeFile(path.join(TS_OUT, "enums.ts"), `${TS_HEADER}${enumLines.join("\n")}\n`);
}

async function generatePython() {
  await rm(PY_GEN_DIR, { recursive: true, force: true });
  await mkdir(PY_GEN_DIR, { recursive: true });

  const schemaDir = SCHEMA_DIR.replace(/\\/g, "/");
  const outDir = PY_GEN_DIR.replace(/\\/g, "/");
  const cmd = [
    "datamodel-codegen",
    `--input "${schemaDir}"`,
    "--input-file-type jsonschema",
    `--output "${outDir}"`,
    "--output-model-type pydantic_v2.BaseModel",
    "--use-standard-collections",
    "--use-union-operator",
    "--field-constraints",
    "--snake-case-field",
    "--allow-population-by-field-name",
    "--disable-timestamp",
    "--use-subclass-enum",
    "--formatters",
    "builtin",
  ].join(" ");

  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
  await writeFile(PY_MODELS, PY_MODELS_HEADER);
}

async function main() {
  await generateTypeScript();
  await generatePython();
  console.log("Contract codegen complete (TypeScript + Python).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
