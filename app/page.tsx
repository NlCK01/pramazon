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
  "LLM cancer planner",
  "Europe PMC oncology scan",
  "NCBI E-utilities",
  "UniProt proteins",
  "AlphaFold structures",
  "LLM research synthesis",
  "NVIDIA NIM route scaffolds",
];

const sampleQueries = [
  "blood cancer for human",
  "skin cancer for my dog",
  "prostate cancer for hamster",
  "breast cancer biomarker in cats",
];

const fallbackModels: RoutedModel[] = [
  {
    name: "OpenFold3",
    role: "3D biomolecular complex prediction",
    fit: "Primary",
    note: "Runs after a public cancer protein accession or structure candidate is selected.",
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
    note: "Used when the cancer prompt is better framed as drug-like molecule exploration.",
  },
];

const featuredProteins = [
  {
    accession: "P00533",
    label: "EGFR cancer signaling shelf",
    detail: "Lung and colorectal cancer target discovery",
  },
  {
    accession: "P04637",
    label: "TP53 tumor suppressor aisle",
    detail: "Cross-cancer mutation and pathway evidence",
  },
  {
    accession: "P15056",
    label: "BRAF melanoma research lane",
    detail: "MAPK pathway and kinase structure review",
  },
  {
    accession: "P36888",
    label: "FLT3 leukemia target bay",
    detail: "Hematologic malignancy accession scouting",
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

function proteinPrice(index: number, item: SequenceCandidate) {
  const basis = (item.length ?? item.accession.length * 97) + index * 43;
  return (basis / 100).toFixed(2);
}

function ratingFor(index: number) {
  return (4.8 - Math.min(index, 5) * 0.1).toFixed(1);
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
      <span className="viewer-state">{viewerUrl ? "iCn3D live structure" : "Structure preview"}</span>
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("blood cancer for human");
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [selectedAccession, setSelectedAccession] = useState("");
  const [cartAccessions, setCartAccessions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const packet = result?.packet ?? "Run a cancer search to create a research checkout packet.";
  const displayedModels = result?.modelRoutes ?? fallbackModels;
  const selectedStructure = useMemo(() => {
    if (!result) return null;
    return (
      result.structures.find((item) => item.accession === selectedAccession) ??
      firstStructure(result)
    );
  }, [result, selectedAccession]);
  const cartItems = useMemo(
    () => result?.sequences.filter((item) => cartAccessions.includes(item.accession)) ?? [],
    [cartAccessions, result],
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
            : "Cancer protein search failed";
        throw new Error(message);
      }
      if (!isResearchResult(payload)) throw new Error("Cancer protein search response was incomplete.");
      setResult(payload);
      setCartAccessions([]);
      setSelectedAccession(payload.structures[0]?.accession ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cancer protein search failed");
    } finally {
      setIsLoading(false);
    }
  }

  function addToCart(item: SequenceCandidate) {
    setCartAccessions((current) =>
      current.includes(item.accession) ? current : [...current, item.accession],
    );
    const structure = findStructureForSequence(item, result?.structures ?? []);
    if (structure) setSelectedAccession(structure.accession);
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
      <header className="market-header">
        <a className="brand" href="#top" aria-label="Protazon home">
          <span>Protazon</span>
          <i aria-hidden="true" />
        </a>
        <div className="delivery-copy">
          <small>Deliver to</small>
          <strong>Cancer research bench</strong>
        </div>
        <form className="market-search" onSubmit={runResearch}>
          <label htmlFor="research-query">Search Protazon cancer proteins</label>
          <select aria-label="Search category" defaultValue="cancer">
            <option value="cancer">Cancer proteins</option>
          </select>
          <input
            id="research-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search cancer problem, species, target, or pathway"
          />
          <button type="submit" disabled={isLoading} aria-label="Search cancer proteins">
            {isLoading ? "..." : "Search"}
          </button>
        </form>
        <div className="account-link">
          <small>Hello, researcher</small>
          <strong>Lists & evidence</strong>
        </div>
        <div className="account-link">
          <small>Returns</small>
          <strong>& orders</strong>
        </div>
        <a className="cart-link" href="#cart">
          <span>{cartAccessions.length}</span>
          <strong>Cart</strong>
        </a>
      </header>

      <nav className="market-nav" aria-label="Cancer protein departments">
        <a href="#products">All</a>
        <a href="#products">Cancer proteins</a>
        <a href="#viewer">3D structures</a>
        <a href="#evidence-title">Evidence deals</a>
        <a href="#model-title">Model routes</a>
        <a href="#cart">Research cart</a>
      </nav>

      <section className="hero-band" id="top" aria-labelledby="app-title">
        <div className="hero-copy">
          <p className="eyebrow">Cancer-only protein marketplace</p>
          <h1 id="app-title">Protazon</h1>
          <p>
            Type a cancer problem. The AI searches live oncology literature and public protein
            databases, then stocks the shelf with accession-backed protein candidates you can add
            to a research cart.
          </p>
          <div className="example-row" aria-label="Example cancer searches">
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
        </div>
        <div className="hero-card">
          <strong>Today&apos;s oncology delivery</strong>
          <span>Live papers</span>
          <span>Reviewed accessions</span>
          <span>iCn3D structures</span>
          <button type="button" onClick={() => void runResearch(undefined, true)} disabled={isLoading}>
            {isLoading ? "Stocking shelves" : "Shop cancer proteins"}
          </button>
        </div>
      </section>

      <section className="shopping-layout" id="products" aria-label="Protein shopping results">
        <aside className="filter-panel">
          <h2>Filters</h2>
          <label>
            <input type="checkbox" checked readOnly />
            Cancer only
          </label>
          <label>
            <input type="checkbox" checked readOnly />
            Public accession
          </label>
          <label>
            <input type="checkbox" checked readOnly />
            Sequence-gated
          </label>
          <div>
            <strong>Departments</strong>
            <a href="#products">Oncology proteins</a>
            <a href="#viewer">3D structure files</a>
            <a href="#evidence-title">Literature evidence</a>
          </div>
        </aside>

        <div className="product-results">
          <div className="results-toolbar">
            <div>
              <h2>
                {result
                  ? `Results for ${result.normalized.condition}`
                  : "Featured cancer protein shelves"}
              </h2>
              <p>
                {result
                  ? `${result.sequences.length} protein candidates generated from live cancer research.`
                  : "Run a search to generate accession-backed products for a cancer problem."}
              </p>
            </div>
            <span>{result?.cached ? "Cached order" : "Fresh order"}</span>
          </div>

          {result?.sequences.length ? (
            <div className="product-list">
              {result.sequences.map((item, index) => {
                const structure = findStructureForSequence(item, result.structures);
                const inCart = cartAccessions.includes(item.accession);
                return (
                  <article className="product-card" key={`${item.database}-${item.accession}`}>
                    <button
                      type="button"
                      className="product-image"
                      onClick={() => structure && setSelectedAccession(structure.accession)}
                      disabled={!structure}
                      aria-label={`Preview ${item.accession} in iCn3D`}
                    >
                      <span>{item.genes[0] ?? item.accession.slice(0, 4)}</span>
                    </button>
                    <div className="product-info">
                      <a href={item.href}>
                        <h3>{item.label}</h3>
                      </a>
                      <p className="rating">★★★★★ <span>{ratingFor(index)}</span></p>
                      <p className="seller">Sold by {item.database} cancer reference shelf</p>
                      <p className="price">
                        <sup>$</sup>
                        {proteinPrice(index, item)}
                      </p>
                      <p className="delivery">Fast public-source delivery to your research packet</p>
                      <p className="meta-line">
                        {item.accession} · {item.organism} · {item.length ?? "n/a"} aa
                      </p>
                      <div className="product-actions">
                        <button type="button" onClick={() => addToCart(item)}>
                          {inCart ? "Added to cart" : "Add to Cart"}
                        </button>
                        {structure ? (
                          <button type="button" onClick={() => setSelectedAccession(structure.accession)}>
                            View 3D
                          </button>
                        ) : (
                          <span>No structure file</span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="featured-grid">
              {featuredProteins.map((item) => (
                <article className="featured-card" key={item.accession}>
                  <div className="product-image">
                    <span>{item.accession.slice(0, 4)}</span>
                  </div>
                  <h3>{item.label}</h3>
                  <p>{item.detail}</p>
                  <button type="button" onClick={() => setQuery(`${item.label} cancer`)}>
                    Search this shelf
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>

        <aside className="cart-panel" id="cart">
          <h2>Research Cart</h2>
          <p>{cartItems.length ? `${cartItems.length} cancer proteins selected` : "Your cart is empty."}</p>
          <div className="cart-items">
            {cartItems.map((item) => (
              <button
                type="button"
                key={item.accession}
                onClick={() => {
                  const structure = findStructureForSequence(item, result?.structures ?? []);
                  if (structure) setSelectedAccession(structure.accession);
                }}
              >
                <strong>{item.accession}</strong>
                <span>{item.genes.join(", ") || item.label}</span>
              </button>
            ))}
          </div>
          <button type="button" className="checkout-button" onClick={copyPacket} disabled={!result}>
            {copied ? "Packet copied" : "Buy research packet"}
          </button>
          <small>No checkout occurs. This cart only selects public cancer protein references.</small>
        </aside>
      </section>

      <section className="workbench" aria-label="Cancer research summary">
        <div className="translation-panel">
          <p className="section-kicker">AI cancer terminology</p>
          <h2>{result?.normalized.condition ?? "Cancer search only"}</h2>
          <p>
            {result?.normalized.medical ??
              "Protazon only searches cancer-related prompts and turns them into oncology terminology, target genes, source strategy, and reviewed protein candidates."}
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
          <p className="section-kicker">Order state</p>
          <h2>{result?.cached ? "Cached protein order" : "Fresh cancer retrieval"}</h2>
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
                <span>{result.evidence.length} cancer evidence hits</span>
              </>
            ) : (
              <>
                <span>Cancer gate ready</span>
                <span>Protein shelves ready</span>
                <span>iCn3D ready</span>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="output-band" id="viewer" aria-label="3D preview and generated packet">
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
              <span>Run a cancer search to load iCn3D-ready proteins.</span>
            )}
          </div>
          <p className="viewer-note">
            {selectedStructure
              ? `${selectedStructure.source} returned ${selectedStructure.accession}. iCn3D loads the public PDB/CIF file for the selected cancer protein.`
              : "When AlphaFold or PDB structure files are found, selecting a product loads the NCBI iCn3D viewer."}
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

      <section className="evidence-band" aria-labelledby="evidence-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Customer research reviews</p>
            <h2 id="evidence-title">Ranked oncology sources</h2>
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
              Cancer literature results will appear here after the first search.
            </div>
          )}
        </div>
      </section>

      <section className="model-band" aria-labelledby="model-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">NVIDIA model route</p>
            <h2 id="model-title">Frequently bought with this target</h2>
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
          <p className="section-kicker">Fulfillment status</p>
          <h2 id="architecture-title">What stocked the shelf</h2>
        </div>
        <ol className="architecture-list provider-list">
          {(result?.providerStatus ?? searchTargets.map((provider) => ({
            provider,
            state: "ok" as const,
            detail: "Ready for cancer protein retrieval.",
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
