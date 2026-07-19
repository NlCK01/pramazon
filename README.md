# Helix Triage

Helix Triage is a veterinary genomics research console for a healthcare
hackathon workflow. A user enters a plain-language goal, such as "cure to skin
cancer for my dog", "cure to prostate cancer for hamster", or "cure to blood
cancer for human", and the app turns it into a reviewed research packet.

The implementation is intentionally nonclinical. It translates the request into
medical terminology, searches trusted biomedical sources, retrieves public
accession and structure candidates, routes the task across NVIDIA BioNeMo/NIM
model families, shows a 3D structure viewer when a public structure is found,
and produces a copyable packet while withholding unvalidated therapeutic
sequence output.

## Live Pipeline

`POST /api/research` runs the backend workflow:

1. Ask an LLM to plan species, condition, intent, target genes, evidence
   questions, source strategy, and multiple source-specific search queries. If
   `OPENAI_API_KEY` is not configured, use the deterministic fallback profiles
   and mark the result as fallback-generated.
2. Search Europe PMC with multiple planned queries and merge/dedupe current
   literature.
3. Search UniProt and NCBI Protein for accession-linked reference records.
4. Check AlphaFold DB for public PDB/CIF structure files.
5. Ask the LLM to synthesize the retrieved evidence, accession choices, and
   model route into the research packet. Hosted OpenAI web search is attempted
   when available.
6. Route the request to the most relevant NVIDIA model family.
7. Cache the completed research packet in D1 for explicit cache reuse.

The main submit action always runs a fresh lookup. The cache is only used when
the user explicitly chooses the cached packet.

No external key is required for the current literature/accession/structure
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
overrides. If no API key is configured, the live biomedical source lookups still
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
- `.openai/hosting.json` declares the Sites D1 binding used for research-run
  caching.
- `db/schema.ts` defines the `research_runs` cache table.
- `tests/rendered-html.test.mjs` builds and checks the rendered console and
  live pipeline wiring.
