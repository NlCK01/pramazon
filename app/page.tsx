"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import type {
  ModelFit,
  ResearchResult,
  RoutedModel,
  StructureCandidate,
} from "./lib/research-types";

type NglComponent = {
  addRepresentation(type: string, options?: Record<string, unknown>): void;
  autoView(): void;
};

type NglStage = {
  loadFile(url: string, options?: Record<string, unknown>): Promise<NglComponent>;
  removeAllComponents(): void;
  handleResize(): void;
  dispose?: () => void;
};

declare global {
  interface Window {
    NGL?: {
      Stage: new (element: HTMLElement, options?: Record<string, unknown>) => NglStage;
    };
  }
}

const searchTargets = [
  "Europe PMC",
  "NCBI E-utilities",
  "UniProt",
  "AlphaFold DB",
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
    note:
      "Runs after the backend finds an accession or public structure candidate.",
  },
  {
    name: "Evo 2",
    role: "Genomic foundation model",
    fit: "Support",
    note:
      "Used for reference-sequence analysis and variant scoring, not ungated therapy design.",
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

function nodeStyle(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
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

function StructureViewer({ structure }: { structure: StructureCandidate | null }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [viewerState, setViewerState] = useState<"idle" | "loading" | "ready" | "fallback">(
    structure ? "loading" : "idle",
  );

  useEffect(() => {
    let cancelled = false;
    let stage: NglStage | null = null;

    async function loadNgl() {
      const host = hostRef.current;
      const structureUrl = structure?.pdbUrl ?? structure?.cifUrl;
      if (!host || !structureUrl) {
        setViewerState("idle");
        return;
      }

      setViewerState("loading");

      try {
        if (!window.NGL) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.getElementById("ngl-viewer-script") as HTMLScriptElement | null;
            if (existing) {
              existing.addEventListener("load", () => resolve(), { once: true });
              existing.addEventListener("error", () => reject(new Error("NGL failed to load")), {
                once: true,
              });
              return;
            }

            const script = document.createElement("script");
            script.id = "ngl-viewer-script";
            script.src = "https://cdn.jsdelivr.net/npm/ngl@2.3.0/dist/ngl.js";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("NGL failed to load"));
            document.head.appendChild(script);
          });
        }

        if (cancelled || !window.NGL) return;

        host.innerHTML = "";
        stage = new window.NGL.Stage(host, {
          backgroundColor: "white",
        });
        const component = await stage.loadFile(structureUrl, {
          ext: structureUrl.endsWith(".cif") || structureUrl.includes(".cif") ? "cif" : "pdb",
        });
        component.addRepresentation("cartoon", { color: "chainname" });
        component.addRepresentation("ball+stick", { sele: "hetero and not water" });
        component.autoView();
        stage.handleResize();
        if (!cancelled) setViewerState("ready");
      } catch {
        if (!cancelled) setViewerState("fallback");
      }
    }

    void loadNgl();

    return () => {
      cancelled = true;
      stage?.dispose?.();
    };
  }, [structure]);

  return (
    <div className="molecule-scene" data-viewer-state={viewerState}>
      <div ref={hostRef} className="structure-viewer" aria-label="3D structure viewer" />
      {viewerState !== "ready" ? (
        <div className="molecule-fallback" aria-hidden="true">
          <div className="target-surface" />
          <div className="helix">
            {Array.from({ length: 22 }, (_, index) => (
              <span key={index} style={nodeStyle(index)} />
            ))}
          </div>
          <div className="ligand-cloud">
            <i />
            <i />
            <i />
          </div>
        </div>
      ) : null}
      <span className="viewer-state">
        {viewerState === "ready"
          ? "Live 3D structure"
          : viewerState === "loading"
            ? "Loading structure"
            : "Structure preview"}
      </span>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("cure to prostate cancer for hamster");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const packet = result?.packet ?? "Run a live research query to generate a copyable packet.";
  const displayedModels = result?.modelRoutes ?? fallbackModels;
  const structure = useMemo(() => firstStructure(result), [result]);

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
      <section className="hero-band" aria-labelledby="app-title">
        <div className="hero-copy">
          <p className="eyebrow">Live veterinary genomics research console</p>
          <h1 id="app-title">Helix Triage</h1>
          <p className="hero-text">
            Type any biomedical goal. The app normalizes the species and
            condition, searches trusted biomedical sources, retrieves public
            accession and structure candidates, routes NVIDIA model options, and
            keeps therapeutic sequence output gated.
          </p>
        </div>
        <div className="status-strip" aria-label="Workflow status">
          <span>Normalize</span>
          <span>Retrieve</span>
          <span>Rank</span>
          <span>Render</span>
        </div>
      </section>

      <section className="workbench" aria-label="Research generator">
        <form className="prompt-panel" onSubmit={runResearch}>
          <label htmlFor="research-query">Plain-language request</label>
          <textarea
            id="research-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={5}
          />
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
            <button type="button" disabled={!result} onClick={copyPacket}>
              {copied ? "Copied" : "Copy packet"}
            </button>
          </div>
          {error ? <p className="error-text">{error}</p> : null}
        </form>

        <div className="translation-panel">
          <p className="section-kicker">Medical terminology</p>
          <h2>{result?.normalized.condition ?? "Run a query"}</h2>
          <p>
            {result?.normalized.medical ??
              "The backend will detect species, condition, intent, search terms, target genes, and whether the request needs clarification."}
          </p>
          <div className="term-grid" aria-label="Search terms">
            {(result?.normalized.terms ?? searchTargets).map((term) => (
              <span key={term}>{term}</span>
            ))}
          </div>
          {result ? (
            <div className="confidence-row">
              <strong>{result.normalized.confidence}</strong>
              <span>{result.normalized.organism}</span>
              <span>{result.cached ? "cached result" : "fresh retrieval"}</span>
            </div>
          ) : null}
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

      <section className="sequence-band" aria-labelledby="sequence-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Reference sequences</p>
            <h2 id="sequence-title">Accession candidates</h2>
          </div>
          <span className="gate-pill">{result?.safety.label ?? "Reference-only"}</span>
        </div>
        <div className="sequence-table" role="table" aria-label="Accession candidates">
          <div className="sequence-row sequence-head" role="row">
            <span>Database</span>
            <span>Accession</span>
            <span>Record</span>
            <span>Length</span>
          </div>
          {result?.sequences.length ? (
            result.sequences.map((item) => (
              <a className="sequence-row" href={item.href} key={`${item.database}-${item.accession}`}>
                <span>{item.database}</span>
                <strong>{item.accession}</strong>
                <span>{item.label}</span>
                <span>{item.length ?? "n/a"}</span>
              </a>
            ))
          ) : (
            <div className="empty-panel">
              The app returns accession-linked references when UniProt or NCBI
              finds matching records. Raw therapeutic sequence output remains
              gated.
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

      <section className="output-band" aria-label="3D preview and generated packet">
        <div className="molecule-panel">
          <div className="molecule-heading">
            <div>
              <p className="section-kicker">3D structure</p>
              <h2>{structure ? structure.label : "Structure-first review"}</h2>
            </div>
            {structure ? <a className="structure-link" href={structure.href}>Open source</a> : null}
          </div>
          <StructureViewer structure={structure} />
          <p className="viewer-note">
            {structure
              ? `${structure.source} returned ${structure.accession}. The browser viewer loads the public PDB/CIF file directly.`
              : "When a public AlphaFold structure is found, this panel loads a real 3D viewer. Otherwise it keeps a nonclinical preview."}
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
