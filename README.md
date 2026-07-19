# Pramazon

Pramazon is a cancer-only protein research marketplace for a healthcare
hackathon workflow. A user enters an oncology goal, such as "skin cancer for my
dog", "prostate cancer for hamster", or "blood cancer for human", and the app
turns it into accession-backed protein cards with NIH/NCBI iCn3D structure
previews, AI-written protein explanations, and a reviewed research packet.

The implementation is intentionally nonclinical. It rejects non-cancer prompts,
translates cancer requests into oncology terminology, searches trusted
biomedical sources, retrieves public accession and structure candidates, routes
the task across NVIDIA BioNeMo/NIM model families, shows an NCBI iCn3D protein
structure simulation beside each protein when a public PDB/CIF file is found,
and produces a copyable packet while withholding unvalidated therapeutic
sequence output. The cart is a research-selection metaphor; no real product
purchase occurs.

## Live Pipeline

`POST /api/research` runs the backend workflow:

1. Reject non-cancer prompts before any retrieval.
2. Ask an LLM to plan species, condition, intent, target genes, evidence
   questions, source strategy, and multiple source-specific search queries. If
   `OPENAI_API_KEY` is not configured, use the deterministic fallback profiles
   and mark the result as fallback-generated.
3. Search Europe PMC with multiple planned cancer queries and merge/dedupe current
   literature.
4. Search UniProt and NCBI Protein for accession-linked reference records.
5. Check AlphaFold DB for public PDB/CIF structure files that can be opened in
   NCBI iCn3D.
6. Ask the LLM to synthesize the retrieved evidence, accession choices, and
   model route into the research packet, including per-protein notes for source
   paper, biological role, and cancer usefulness. Hosted OpenAI web search is
   attempted when available.
7. Route the request to the most relevant NVIDIA model family.
8. Cache the completed research packet in D1 for explicit cache reuse.

The main submit action always runs a fresh lookup. The cache is only used when
the user explicitly chooses the cached packet.

No external key is required for the current cancer literature/accession/structure
pipeline. LLM terminology requires `OPENAI_API_KEY`. NVIDIA model execution
still requires a configured NVIDIA NIM service and review-approved model inputs.

## Environment

Configure these locally or in Sites runtime environment variables:

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5-mini
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_ENABLE_WEB_SEARCH=true
OPENAI_WEB_SEARCH_TOOL=web_search
```

Only `OPENAI_API_KEY` is required for the LLM planner and synthesis pass.
`OPENAI_MODEL`, `OPENAI_BASE_URL`, and the hosted web-search flags are optional
overrides. If no API key is configured, the live cancer source lookups still
run with deterministic planning and synthesis.

## Safety Boundary

The app does not emit novel therapeutic DNA, RNA, viral-vector, or protein
sequences. It can return public accession IDs, source links, PDB/CIF structure
links, and model request scaffolds. Production sequence output should require
qualified veterinary oncology review, target validation, biosafety approval,
provenance tracking, and assay results.

## Model Routing

- Evo 2: genomic foundation model for variant scoring and nonclinical genomic
  modeling.
- OpenFold3: primary route for 3D biomolecular complex prediction once approved
  entities are known.
- RFdiffusion and ProteinMPNN: deferred route for protein binder design after a
  validated target and assay plan exist.
- MolMIM and DiffDock: deferred route for small-molecule exploration.

## Useful Commands

```bash
npm install
npm run dev
npm run build
npm test
```

## Project Notes

- App code lives under `app/`.
- The UI uses a marketplace-style cancer protein search, research cards, and a
  research cart, with NCBI iCn3D embedded beside each protein when a public
  structure is found.
- `.openai/hosting.json` declares the Sites D1 binding used for research-run
  caching.
- `db/schema.ts` defines the `research_runs` cache table.
- `tests/rendered-html.test.mjs` builds and checks the rendered console and
  live pipeline wiring.
