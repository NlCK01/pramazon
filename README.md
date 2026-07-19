# Helix Triage

Helix Triage is a veterinary genomics research console for a healthcare
hackathon workflow. A user enters a plain-language goal, such as "cure to skin
cancer for my dog", and the app turns it into a reviewed research packet.

The current implementation is intentionally nonclinical. It translates the
request into medical terminology, surfaces current evidence leads, routes the
task across NVIDIA BioNeMo/NIM model families, shows a 3D-style structure review
panel, and produces a copyable packet while withholding unvalidated therapeutic
sequence output.

## Safety Boundary

The app does not emit therapeutic DNA, RNA, viral-vector, or protein sequences.
Production sequence output should require qualified veterinary oncology review,
target validation, biosafety approval, provenance tracking, and assay results.

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
- `.openai/hosting.json` declares optional Sites bindings.
- `tests/rendered-html.test.mjs` builds and checks the rendered console.
