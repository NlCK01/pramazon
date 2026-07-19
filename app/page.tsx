"use client";

import { useMemo, useState, type CSSProperties, type FormEvent } from "react";
import type {
  ModelFit,
  ResearchResult,
  RoutedModel,
  SequenceCandidate,
  StructureCandidate,
} from "./lib/research-types";

const searchTargets = [
  "LLM research planner",
  "Europe PMC",
  "NCBI E-utilities",
  "UniProt",
  "AlphaFold DB",
  "LLM research synthesis",
  "NVIDIA NIM route scaffolds",
];

const sampleQueries = [
  "cure to skin cancer for my dog",
  "cure to prostate cancer for hamster",
  "cure to blood cancer for human",
  "diagnostic marker for breast cancer in cats",
];

const fallbackModels: RoutedModel[] = [
  {
    name: "OpenFold3",
    role: "3D biomolecular complex prediction",
    fit: "Primary",
    note: "Runs after the backend finds an accession or public structure candidate.",
  },
  {
    name: "Evo 2",
    role: "Genomic foundation model",
    fit: "Support",
    note: "Used for reference-sequence analysis and variant scoring, not ungated therapy design.",
  },
  {
    name: "RFdiffusion + ProteinMPNN",
    role: "Protein binder design",
    fit: "Deferred",
    note: "Requires target validation and review before binder generation.",
  },
  {
    name: "MolMIM + DiffDock",
    role: "Small-molecule generation and docking",
    fit: "Deferred",
    note: "Used when the prompt is better framed as drug-like molecule search.",
  },
];

function modelClass(fit: ModelFit) {
  if (fit === "Primary") return "model-card model-primary";
  if (fit === "Support") return "model-card model-support";
  return "model-card";
}

function firstStructure(result: ResearchResult | null) {
  return result?.structures.find((item) => item.pdbUrl || item.cifUrl) ?? null;
}

function isResearchResult(payload: unknown): payload is ResearchResult {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "packet" in payload &&
    "normalized" in payload &&
    "modelRoutes" in payload
  );
}

function structureFile(structure: StructureCandidate | null) {
  return structure?.pdbUrl ?? structure?.cifUrl ?? "";
}

function icn3dUrl(structure: StructureCandidate | null) {
  const file = structureFile(structure);
  if (!file) return "";

  const params = new URLSearchParams({
    type: file.endsWith(".cif") || file.includes(".cif") ? "mmcif" : "pdb",
    url: file,
    width: "100%",
    height: "100%",
    showcommand: "0",
    showtitle: "0",
    mobilemenu: "1",
    rotate: "right",
  });

  return `https://www.ncbi.nlm.nih.gov/Structure/icn3d/?${params.toString()}`;
}

function findStructureForSequence(sequence: SequenceCandidate, structures: StructureCandidate[]) {
  return structures.find((item) => item.accession === sequence.accession) ?? null;
}

function StructureViewer({ structure }: { structure: StructureCandidate | null }) {
  const viewerUrl = useMemo(() => icn3dUrl(structure), [structure]);

  return (
    <div className="molecule-scene" data-viewer-state={viewerUrl ? "ready" : "idle"}>
      {viewerUrl ? (
        <iframe
          className="icn3d-frame"
          src={viewerUrl}
          title={`iCn3D structure viewer for ${structure?.accession ?? "selected target"}`}
          allow="fullscreen; xr-spatial-tracking"
        />
      ) : (
        <div className="molecule-fallback" aria-hidden="true">
          <div className="target-surface" />
          <div className="helix">
            {Array.from({ length: 22 }, (_, index) => (
              <span key={index} style={{ "--i": index } as CSSProperties} />
            ))}
          </div>
          <div className="ligand-cloud">
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
      <span className="viewer-state">{viewerUrl ? "iCn3D live simulation" : "Structure preview"}</span>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("cure to prostate cancer for hamster");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [selectedAccession, setSelectedAccession] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const packet = result?.packet ?? "Run a live research query to generate a copyable packet.";
  const displayedModels = result?.modelRoutes ?? fallbackModels;
  const selectedStructure = useMemo(() => {
    if (!result) return null;
    return (
      result.structures.find((item) => item.accession === selectedAccession) ??
      firstStructure(result)
    );
  }, [result, selectedAccession]);
  const structuredAccessions = useMemo(
    () => new Set(result?.structures.map((item) => item.accession) ?? []),
    [result],
  );

  async function runResearch(event?: FormEvent<HTMLFormElement>, refresh = true) {
    event?.preventDefault();
    setIsLoading(true);
    setError("");
    setCopied(false);

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, refresh }),
      });
      const payload = (await response.json()) as unknown;
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "Research failed";
        throw new Error(message);
      }
      if (!isResearchResult(payload)) throw new Error("Research response was incomplete.");
      setResult(payload);
      setSelectedAccession(payload.structures[0]?.accession ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Research failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function copyPacket() {
    try {
      await navigator.clipboard.writeText(packet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="gemini-rail" aria-label="App navigation">
        <div className="spark-mark" aria-hidden="true" />
        <nav>
          <a href="#research-query" aria-label="Prompt">
            +
          </a>
          <a href="#evidence-title" aria-label="Evidence">
            S
          </a>
          <a href="#sequence-title" aria-label="Targets">
            T
          </a>
          <a href="#model-title" aria-label="Models">
            M
          </a>
        </nav>
        <div className="rail-bottom">
          <a href="#architecture-title" aria-label="Provider status">
            i
          </a>
        </div>
      </aside>

      <div className="top-actions" aria-label="Workspace actions">
        <span>{result?.normalized.terminologySource === "llm" ? "LLM active" : "LLM pending"}</span>
        <button type="button" onClick={copyPacket} disabled={!result}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <section className="hero-band" aria-labelledby="app-title">
        <div className="hero-copy">
          <p className="eyebrow">Live veterinary genomics research console</p>
          <h1 id="app-title">What should we focus on?</h1>
          <form className="prompt-panel" onSubmit={runResearch}>
            <label htmlFor="research-query">Ask Helix</label>
            <div className="prompt-input-shell">
              <span aria-hidden="true">+</span>
              <textarea
                id="research-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={2}
                placeholder="Ask for a disease, species, target, or research goal"
              />
              <strong>Research</strong>
            </div>
            <div className="prompt-actions">
              <button type="submit" className="primary-action" disabled={isLoading}>
                {isLoading ? "Running research" : "Run new research"}
              </button>
              <button
                type="button"
                disabled={isLoading || !result}
                onClick={() => void runResearch(undefined, false)}
              >
                Use cached packet
              </button>
            </div>
            <div className="example-row" aria-label="Example prompts">
              {sampleQueries.map((sample) => (
                <button
                  type="button"
                  className="chip-button"
                  key={sample}
                  onClick={() => setQuery(sample)}
                >
                  {sample}
                </button>
              ))}
            </div>
            {error ? <p className="error-text">{error}</p> : null}
          </form>
        </div>
      </section>

      <section className="workbench" aria-label="Research generator">
        <div className="translation-panel">
          <p className="section-kicker">Medical terminology</p>
          <h2>{result?.normalized.condition ?? "Run a query"}</h2>
          <p>
            {result?.normalized.medical ??
              "The backend will ask the LLM for species, condition, intent, search terms, target genes, source strategy, and whether the request needs clarification."}
          </p>
          <div className="term-grid" aria-label="Search terms">
            {(result?.normalized.terms ?? searchTargets).map((term) => (
              <span key={term}>{term}</span>
            ))}
          </div>
          {result?.synthesis ? (
            <div className="synthesis-block" data-source={result.synthesis.source}>
              <span>
                {result.synthesis.source === "llm"
                  ? `LLM synthesis${result.synthesis.llmModel ? `: ${result.synthesis.llmModel}` : ""}`
                  : "deterministic synthesis"}
              </span>
              <p>{result.synthesis.problem}</p>
              <p>{result.synthesis.research}</p>
            </div>
          ) : null}
        </div>

        <div className="architecture-card">
          <p className="section-kicker">Run state</p>
          <h2>{result?.cached ? "Cached packet" : "Fresh retrieval"}</h2>
          <div className="confidence-row">
            {result ? (
              <>
                <strong>{result.normalized.confidence}</strong>
                <span>{result.normalized.organism}</span>
                <span>
                  {result.normalized.terminologySource === "llm"
                    ? `LLM terminology${result.normalized.llmModel ? `: ${result.normalized.llmModel}` : ""}`
                    : "rules fallback"}
                </span>
                <span>{result.evidence.length} evidence hits</span>
              </>
            ) : (
              <>
                <span>Planner ready</span>
                <span>Sources ready</span>
                <span>iCn3D ready</span>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="output-band" aria-label="3D preview and generated packet">
        <div className="molecule-panel">
          <div className="molecule-heading">
            <div>
              <p className="section-kicker">Protein 3D simulation</p>
              <h2>{selectedStructure ? selectedStructure.label : "iCn3D structure view"}</h2>
            </div>
            {selectedStructure ? (
              <a className="structure-link" href={selectedStructure.href}>
                Open source
              </a>
            ) : null}
          </div>
          <StructureViewer structure={selectedStructure} />
          <div className="structure-picker" aria-label="Available structure simulations">
            {result?.structures.length ? (
              result.structures.map((item) => (
                <button
                  type="button"
                  key={item.accession}
                  className={item.accession === selectedStructure?.accession ? "active" : ""}
                  onClick={() => setSelectedAccession(item.accession)}
                >
                  {item.accession}
                </button>
              ))
            ) : (
              <span>Run research to load iCn3D-ready structures.</span>
            )}
          </div>
          <p className="viewer-note">
            {selectedStructure
              ? `${selectedStructure.source} returned ${selectedStructure.accession}. iCn3D loads the public PDB/CIF file for the selected target.`
              : "When AlphaFold or PDB structure files are found, selecting a target loads the NCBI iCn3D viewer."}
          </p>
        </div>

        <div className="sequence-panel">
          <div className="sequence-header">
            <div>
              <p className="section-kicker">Copyable output</p>
              <h2>Research packet</h2>
            </div>
            <span className="gate-pill">{result?.safety.label ?? "Sequence gated"}</span>
          </div>
          <pre>{packet}</pre>
        </div>
      </section>

      <section className="sequence-band" aria-labelledby="sequence-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Reference sequences</p>
            <h2 id="sequence-title">Selectable targets</h2>
          </div>
          <span className="gate-pill">{result?.safety.label ?? "Reference-only"}</span>
        </div>
        <div className="sequence-table" role="table" aria-label="Accession candidates">
          <div className="sequence-row sequence-head" role="row">
            <span>Database</span>
            <span>Accession</span>
            <span>Record</span>
            <span>Action</span>
          </div>
          {result?.sequences.length ? (
            result.sequences.map((item) => {
              const structure = findStructureForSequence(item, result.structures);
              const canSimulate = structuredAccessions.has(item.accession);
              return (
                <div
                  className={`sequence-row ${item.accession === selectedStructure?.accession ? "sequence-active" : ""}`}
                  role="row"
                  key={`${item.database}-${item.accession}`}
                >
                  <span>{item.database}</span>
                  <strong>{item.accession}</strong>
                  <span>{item.label}</span>
                  <span className="sequence-actions">
                    {canSimulate && structure ? (
                      <button type="button" onClick={() => setSelectedAccession(item.accession)}>
                        Simulate
                      </button>
                    ) : (
                      <em>Source only</em>
                    )}
                    <a href={item.href}>Open</a>
                  </span>
                </div>
              );
            })
          ) : (
            <div className="empty-panel">
              The app returns accession-linked references when UniProt or NCBI
              finds matching records. Raw therapeutic sequence output remains
              gated.
            </div>
          )}
        </div>
      </section>

      <section className="evidence-band" aria-labelledby="evidence-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Live evidence scan</p>
            <h2 id="evidence-title">Ranked sources</h2>
          </div>
          <span className="section-count">{result?.evidence.length ?? 0} hits</span>
        </div>
        <div className="source-grid">
          {result?.evidence.length ? (
            result.evidence.map((item) => (
              <a className="source-card" href={item.href} key={item.id}>
                <span className="source-meta">
                  {item.year} / {item.signal} / score {item.score}
                </span>
                <strong>{item.title}</strong>
                <small>{item.kind}</small>
                <p>{item.finding}</p>
              </a>
            ))
          ) : (
            <div className="empty-panel">
              Live literature results will appear here after the first query.
            </div>
          )}
        </div>
      </section>

      <section className="model-band" aria-labelledby="model-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">NVIDIA model route</p>
            <h2 id="model-title">Most applicable model path</h2>
          </div>
          <span className="section-count">{displayedModels.length} routes</span>
        </div>
        <div className="model-grid">
          {displayedModels.map((item) => (
            <article className={modelClass(item.fit)} key={item.name}>
              <span>{item.fit}</span>
              <h3>{item.name}</h3>
              <p className="model-role">{item.role}</p>
              <p>{item.note}</p>
              {item.endpoint ? <code>{item.endpoint}</code> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="architecture-band" aria-labelledby="architecture-title">
        <div>
          <p className="section-kicker">Provider status</p>
          <h2 id="architecture-title">What ran</h2>
        </div>
        <ol className="architecture-list provider-list">
          {(result?.providerStatus ?? searchTargets.map((provider) => ({
            provider,
            state: "ok" as const,
            detail: "Ready for live retrieval.",
          }))).map((item) => (
            <li key={item.provider} data-state={item.state}>
              <strong>{item.provider}</strong>
              <span>{item.detail}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
