# Helix Triage

Helix Triage is a veterinary genomics research console for a healthcare
hackathon workflow. A user enters a plain-language goal, such as "cure to skin
cancer for my dog" or "cure to prostate cancer for hamster", and the app turns
it into a reviewed research packet.

The implementation is intentionally nonclinical. It translates the request into
medical terminology, searches trusted biomedical sources, retrieves public
accession and structure candidates, routes the task across NVIDIA BioNeMo/NIM
model families, shows a 3D structure viewer when a public structure is found,
and produces a copyable packet while withholding unvalidated therapeutic
sequence output.

## Live Pipeline

`POST /api/research` runs the backend workflow:

1. Normalize species, condition, intent, search terms, and target genes.
2. Search Europe PMC for current literature.
3. Search UniProt and NCBI Protein for accession-linked reference records.
4. Check AlphaFold DB for public PDB/CIF structure files.
5. Route the request to the most relevant NVIDIA model family.
6. Cache the completed research packet in D1 for repeated prompts.

No external key is required for the current literature/accession/structure
pipeline. NVIDIA model execution still requires a configured NVIDIA NIM service
and review-approved model inputs.

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
