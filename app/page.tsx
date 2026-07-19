"use client";

import { useMemo, useState, type CSSProperties } from "react";

type Evidence = {
  title: string;
  year: string;
  kind: string;
  finding: string;
  href: string;
  signal: "Clinical" | "Review" | "Preclinical" | "Model";
};

type RoutedModel = {
  name: string;
  role: string;
  fit: "Primary" | "Support" | "Deferred";
  note: string;
};

const evidence: Evidence[] = [
  {
    title:
      "Caninized PD-1 monoclonal antibody in oral malignant melanoma",
    year: "2026",
    kind: "Multicenter veterinary oncology trial",
    finding:
      "Reported durable antitumor activity with biomarker analysis in dogs with advanced oral malignant melanoma.",
    href: "https://pubmed.ncbi.nlm.nih.gov/41571458/",
    signal: "Clinical",
  },
  {
    title: "Cancer-testis antigen expression in canine melanoma",
    year: "2025",
    kind: "Target discovery study",
    finding:
      "Evaluated canine orthologs of human cancer-testis antigens, including MAGE and PRAME, as possible immunotherapy targets.",
    href: "https://pubmed.ncbi.nlm.nih.gov/40359694/",
    signal: "Preclinical",
  },
  {
    title: "Comparative oncology of canine malignant melanoma",
    year: "2024",
    kind: "Systematic targeted-therapy review",
    finding:
      "Summarized 30 targeted-treatment studies and highlighted immunotherapy, micro-RNA, and signaling-inhibitor directions.",
    href: "https://pubmed.ncbi.nlm.nih.gov/39408717/",
    signal: "Review",
  },
  {
    title: "Dog and cat melanoma consensus guidelines",
    year: "2024",
    kind: "Clinical guideline",
    finding:
      "Frames surgery as main local control, radiotherapy for oral melanoma, and adjuvant immunotherapy or chemotherapy for high metastatic risk.",
    href: "https://pubmed.ncbi.nlm.nih.gov/38645640/",
    signal: "Review",
  },
];

const modelCatalog: RoutedModel[] = [
  {
    name: "Evo 2",
    role: "Genomic foundation model",
    fit: "Support",
    note:
      "Useful for variant scoring and nonclinical genomic modeling. Therapeutic sequence generation stays behind validation gates.",
  },
  {
    name: "OpenFold3",
    role: "3D biomolecular complex prediction",
    fit: "Primary",
    note:
      "Most useful once a vetted protein, DNA, RNA, or ligand entity is known and needs structural modeling.",
  },
  {
    name: "RFdiffusion + ProteinMPNN",
    role: "Protein binder backbone and sequence design",
    fit: "Deferred",
    note:
      "Relevant only after a validated target epitope and assay plan exist.",
  },
  {
    name: "MolMIM + DiffDock",
    role: "Small-molecule generation and docking",
    fit: "Deferred",
    note:
      "Better fit for drug-like molecule exploration than for genetic therapy requests.",
  },
];

const searchTargets = [
  "PubMed",
  "PMC",
  "Europe PMC",
  "veterinary oncology guidelines",
  "NVIDIA NIM model cards",
];

function normalizeRequest(input: string) {
  const value = input.trim();
  const lower = value.toLowerCase();
  const dog = /\b(dog|canine|puppy|pet)\b/.test(lower);
  const cancer = /\b(cancer|melanoma|tumou?r|skin)\b/.test(lower);
  const melanoma = /\bmelanoma|skin cancer\b/.test(lower);

  if (dog && (cancer || melanoma)) {
    return {
      plain: value,
      medical:
        "Veterinary oncology research plan for canine malignant melanoma, with emphasis on oral/cutaneous melanoma, immunotherapy biomarkers, antigen targets, and nonclinical structure modeling.",
      organism: "Canis lupus familiaris",
      condition: "canine malignant melanoma",
      terms: [
        "canine oral malignant melanoma",
        "PD-1 / PD-L1 checkpoint therapy",
        "cancer-testis antigen targets",
        "comparative oncology",
        "OpenFold3 structure prediction",
      ],
    };
  }

  return {
    plain: value,
    medical:
      "Biomedical research scoping request requiring species, disease, target pathway, evidence grade, and model suitability before any design work.",
    organism: "species not confirmed",
    condition: "condition not confirmed",
    terms: [
      "disease normalization",
      "target validation",
      "literature retrieval",
      "model routing",
      "safety review",
    ],
  };
}

function buildPacket(
  request: ReturnType<typeof normalizeRequest>,
  selectedEvidence: Evidence[],
  routedModels: RoutedModel[],
) {
  const citations = selectedEvidence
    .map((item) => `- ${item.year}: ${item.title} (${item.href})`)
    .join("\n");
  const route = routedModels
    .map((item) => `- ${item.name}: ${item.fit} - ${item.role}`)
    .join("\n");

  return `RESEARCH PACKET

Original request:
${request.plain || "[no request supplied]"}

Medical terminology:
${request.medical}

Organism:
${request.organism}

Evidence scan:
${citations}

NVIDIA model route:
${route}

Sequence output:
WITHHELD_BY_RESEARCH_SAFETY_GATE

Reason:
The app does not emit unvalidated therapeutic DNA, RNA, viral-vector, or protein sequences. It produces literature-backed targets, model-routing inputs, and a copyable validation packet for review by qualified veterinary oncology and biosafety professionals.

Copyable modeling scaffold:
>approved_reference_or_lab_validated_sequence
[INSERT_ACCESSION_OR_APPROVED_REFERENCE_SEQUENCE_ONLY]`;
}

function modelClass(fit: RoutedModel["fit"]) {
  if (fit === "Primary") return "model-card model-primary";
  if (fit === "Support") return "model-card model-support";
  return "model-card";
}

function nodeStyle(index: number): CSSProperties {
  return { "--i": index } as CSSProperties;
}

export default function Home() {
  const [query, setQuery] = useState("cure to skin cancer for my dog");
  const [copied, setCopied] = useState(false);
  const request = useMemo(() => normalizeRequest(query), [query]);
  const packet = useMemo(
    () => buildPacket(request, evidence, modelCatalog),
    [request],
  );

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
          <p className="eyebrow">Veterinary genomics research console</p>
          <h1 id="app-title">Helix Triage</h1>
          <p className="hero-text">
            Convert plain-language medical goals into reviewed terminology,
            evidence leads, NVIDIA BioNeMo model routing, and a copyable research
            packet that keeps therapeutic sequence design gated.
          </p>
        </div>
        <div className="status-strip" aria-label="Workflow status">
          <span>Translate</span>
          <span>Retrieve</span>
          <span>Route</span>
          <span>Review</span>
        </div>
      </section>

      <section className="workbench" aria-label="Research generator">
        <div className="prompt-panel">
          <label htmlFor="research-query">Plain-language request</label>
          <textarea
            id="research-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            rows={5}
          />
          <div className="prompt-actions">
            <button type="button" onClick={() => setQuery("cure to skin cancer for my dog")}>
              Example
            </button>
            <button type="button" className="primary-action" onClick={copyPacket}>
              {copied ? "Copied" : "Copy packet"}
            </button>
          </div>
        </div>

        <div className="translation-panel">
          <p className="section-kicker">Medical terminology</p>
          <h2>{request.condition}</h2>
          <p>{request.medical}</p>
          <div className="term-grid" aria-label="Search terms">
            {request.terms.map((term) => (
              <span key={term}>{term}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="evidence-band" aria-labelledby="evidence-title">
        <div className="section-heading">
          <p className="section-kicker">Recent evidence scan</p>
          <h2 id="evidence-title">Promising sources and constraints</h2>
        </div>
        <div className="source-grid">
          {evidence.map((item) => (
            <a className="source-card" href={item.href} key={item.href}>
              <span className="source-meta">
                {item.year} / {item.signal}
              </span>
              <strong>{item.title}</strong>
              <small>{item.kind}</small>
              <p>{item.finding}</p>
            </a>
          ))}
        </div>
      </section>

      <section className="model-band" aria-labelledby="model-title">
        <div className="section-heading">
          <p className="section-kicker">NVIDIA model route</p>
          <h2 id="model-title">Most applicable model path</h2>
        </div>
        <div className="model-grid">
          {modelCatalog.map((item) => (
            <article className={modelClass(item.fit)} key={item.name}>
              <span>{item.fit}</span>
              <h3>{item.name}</h3>
              <p className="model-role">{item.role}</p>
              <p>{item.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="output-band" aria-label="3D preview and generated packet">
        <div className="molecule-panel">
          <div className="molecule-heading">
            <p className="section-kicker">3D preview</p>
            <h2>Structure-first review</h2>
          </div>
          <div className="molecule-scene" aria-hidden="true">
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
          <p className="viewer-note">
            Production mode would send approved entities to OpenFold3 for PDB or
            CIF output, then render the structure viewer beside the evidence
            packet.
          </p>
        </div>

        <div className="sequence-panel">
          <div className="sequence-header">
            <div>
              <p className="section-kicker">Copyable output</p>
              <h2>Research packet</h2>
            </div>
            <span className="gate-pill">Sequence gated</span>
          </div>
          <pre>{packet}</pre>
        </div>
      </section>

      <section className="architecture-band" aria-labelledby="architecture-title">
        <div>
          <p className="section-kicker">Production architecture</p>
          <h2 id="architecture-title">How the full system should operate</h2>
        </div>
        <ol className="architecture-list">
          <li>
            <strong>Normalize the request.</strong>
            <span>
              Detect species, disease, target tissue, modality, and ambiguity
              before generating search terms.
            </span>
          </li>
          <li>
            <strong>Retrieve evidence.</strong>
            <span>
              Query {searchTargets.join(", ")} and rank by recency, study type,
              species match, and reproducibility.
            </span>
          </li>
          <li>
            <strong>Route models.</strong>
            <span>
              Use Evo 2 for genomic analysis, OpenFold3 for complex structure,
              RFdiffusion plus ProteinMPNN for protein binders, and MolMIM plus
              DiffDock for small molecules.
            </span>
          </li>
          <li>
            <strong>Gate sequence output.</strong>
            <span>
              Release only validated references, accession IDs, model inputs,
              confidence notes, and review tasks until clinical and biosafety
              approval is recorded.
            </span>
          </li>
        </ol>
      </section>
    </main>
  );
}
