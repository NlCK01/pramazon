import type {
  EvidenceItem,
  EvidenceSignal,
  ModelFit,
  NormalizedRequest,
  ProviderStatus,
  ResearchResult,
  RoutedModel,
  SafetyAssessment,
  SequenceCandidate,
  StructureCandidate,
} from "../../lib/research-types";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const REQUEST_TIMEOUT_MS = 9000;
const APP_EMAIL = "helix-triage@example.com";

type ResearchCacheRow = {
  result_json: string;
  created_at: number;
};

type SpeciesProfile = {
  common: string;
  scientific: string;
  taxonomyId?: string;
  aliases: string[];
};

type DiseaseProfile = {
  group: string;
  canonical: string;
  medicalTerms: string[];
  targetGenes: string[];
  kindHints: string[];
};

const speciesProfiles: SpeciesProfile[] = [
  {
    common: "dog",
    scientific: "Canis lupus familiaris",
    taxonomyId: "9615",
    aliases: ["dog", "dogs", "canine", "puppy"],
  },
  {
    common: "cat",
    scientific: "Felis catus",
    taxonomyId: "9685",
    aliases: ["cat", "cats", "feline", "kitten"],
  },
  {
    common: "human",
    scientific: "Homo sapiens",
    taxonomyId: "9606",
    aliases: ["human", "person", "man", "woman", "patient", "people"],
  },
  {
    common: "mouse",
    scientific: "Mus musculus",
    taxonomyId: "10090",
    aliases: ["mouse", "mice", "murine"],
  },
  {
    common: "rat",
    scientific: "Rattus norvegicus",
    taxonomyId: "10116",
    aliases: ["rat", "rats"],
  },
  {
    common: "hamster",
    scientific: "Mesocricetus auratus",
    taxonomyId: "10036",
    aliases: ["hamster", "hamsters", "golden hamster", "syrian hamster"],
  },
  {
    common: "rabbit",
    scientific: "Oryctolagus cuniculus",
    taxonomyId: "9986",
    aliases: ["rabbit", "rabbits"],
  },
  {
    common: "horse",
    scientific: "Equus caballus",
    taxonomyId: "9796",
    aliases: ["horse", "horses", "equine"],
  },
  {
    common: "pig",
    scientific: "Sus scrofa",
    taxonomyId: "9823",
    aliases: ["pig", "pigs", "swine", "porcine"],
  },
  {
    common: "cow",
    scientific: "Bos taurus",
    taxonomyId: "9913",
    aliases: ["cow", "cattle", "bovine"],
  },
  {
    common: "zebrafish",
    scientific: "Danio rerio",
    taxonomyId: "7955",
    aliases: ["zebrafish", "danio"],
  },
];

const diseaseProfiles: Array<DiseaseProfile & { aliases: string[] }> = [
  {
    group: "melanoma",
    canonical: "malignant melanoma",
    aliases: ["melanoma", "skin cancer", "skin tumour", "skin tumor"],
    medicalTerms: [
      "malignant melanoma",
      "cutaneous melanoma",
      "oral malignant melanoma",
      "immune checkpoint therapy",
      "tumor antigen target discovery",
    ],
    targetGenes: ["TYR", "MLANA", "PMEL", "PRAME", "CD274", "PDCD1"],
    kindHints: ["immunotherapy", "vaccine", "checkpoint"],
  },
  {
    group: "prostate cancer",
    canonical: "prostatic neoplasm",
    aliases: [
      "prostate cancer",
      "prostatic cancer",
      "prostate tumour",
      "prostate tumor",
      "prostatic neoplasm",
    ],
    medicalTerms: [
      "prostatic neoplasm",
      "prostate carcinoma",
      "androgen receptor signaling",
      "comparative oncology",
      "tumor suppressor alteration",
    ],
    targetGenes: ["AR", "PTEN", "TP53", "ERG", "KLK3", "MYC"],
    kindHints: ["targeted therapy", "androgen receptor", "biomarker"],
  },
  {
    group: "breast cancer",
    canonical: "mammary carcinoma",
    aliases: ["breast cancer", "mammary cancer", "mammary tumour", "mammary tumor"],
    medicalTerms: [
      "mammary carcinoma",
      "HER2 signaling",
      "estrogen receptor signaling",
      "comparative oncology",
    ],
    targetGenes: ["ERBB2", "ESR1", "PGR", "BRCA1", "BRCA2", "TP53"],
    kindHints: ["targeted therapy", "hormone receptor", "biomarker"],
  },
  {
    group: "diabetes",
    canonical: "diabetes mellitus",
    aliases: ["diabetes", "diabetic", "blood sugar"],
    medicalTerms: [
      "diabetes mellitus",
      "insulin signaling",
      "glucose homeostasis",
      "beta cell function",
    ],
    targetGenes: ["INS", "INSR", "GCK", "PPARG", "SLC2A4"],
    kindHints: ["metabolic disease", "hormone signaling"],
  },
  {
    group: "cardiomyopathy",
    canonical: "cardiomyopathy",
    aliases: ["heart failure", "cardiomyopathy", "heart disease"],
    medicalTerms: [
      "cardiomyopathy",
      "cardiac hypertrophy",
      "sarcomere dysfunction",
      "heart failure",
    ],
    targetGenes: ["MYH7", "TNNT2", "MYBPC3", "LMNA", "TTN"],
    kindHints: ["gene association", "structural protein"],
  },
  {
    group: "cancer",
    canonical: "malignant neoplasm",
    aliases: ["cancer", "tumour", "tumor", "neoplasm", "carcinoma", "sarcoma"],
    medicalTerms: [
      "malignant neoplasm",
      "tumor biology",
      "immune checkpoint therapy",
      "target validation",
    ],
    targetGenes: ["TP53", "PTEN", "CD274", "PDCD1", "MYC", "KRAS"],
    kindHints: ["oncology", "targeted therapy", "biomarker"],
  },
];

function jsonResponse(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function firstSentence(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const stripped = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  const match = stripped.match(/^(.{60,360}?[.!?])\s/);
  return match?.[1] ?? stripped.slice(0, 340);
}

function extractSpecies(clean: string): SpeciesProfile {
  return (
    speciesProfiles.find((profile) =>
      profile.aliases.some((alias) => new RegExp(`\\b${alias}\\b`).test(clean)),
    ) ?? {
      common: "unspecified species",
      scientific: "species not confirmed",
      aliases: [],
    }
  );
}

function extractDisease(clean: string, raw: string): DiseaseProfile {
  const profiled = diseaseProfiles.find((profile) =>
    profile.aliases.some((alias) => new RegExp(`\\b${alias}\\b`).test(clean)),
  );

  if (profiled) {
    return profiled;
  }

  const inferred = raw
    .replace(/\b(cure|treat|treatment|therapy|fix|for|my|a|an|the|please|make)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return {
    group: inferred || "biomedical condition",
    canonical: inferred || "condition not confirmed",
    medicalTerms: [
      inferred || "condition not confirmed",
      "differential diagnosis",
      "target validation",
      "comparative biomedical literature",
    ],
    targetGenes: ["TP53", "PTEN", "CD274", "PDCD1"],
    kindHints: ["target validation", "biomarker"],
  };
}

function extractIntent(clean: string) {
  if (/\b(cure|treat|treatment|therapy|therapeutic|vaccine|drug)\b/.test(clean)) {
    return "therapeutic research";
  }
  if (/\b(sequence|gene|protein|dna|rna|crispr|edit)\b/.test(clean)) {
    return "sequence or genetic research";
  }
  if (/\b(diagnose|detect|screen|test)\b/.test(clean)) {
    return "diagnostic research";
  }
  return "biomedical research";
}

function normalizeRequest(query: string): NormalizedRequest {
  const clean = normalizeText(query);
  const species = extractSpecies(clean);
  const disease = extractDisease(clean, query);
  const directSpecies = species.common !== "unspecified species";
  const directDisease = disease.canonical !== "condition not confirmed";
  const intent = extractIntent(clean);
  const speciesPrefix =
    species.common === "unspecified species" ? "" : `${species.common} `;

  const confidence: NormalizedRequest["confidence"] =
    directSpecies && directDisease ? "high" : directDisease ? "medium" : "low";

  const terms = unique([
    `${speciesPrefix}${disease.canonical}`.trim(),
    ...disease.medicalTerms,
    ...disease.kindHints,
    "recent study",
    "sequence accession",
  ]).filter(Boolean);

  return {
    plain: query,
    medical:
      `${species.scientific} ${disease.canonical} research plan focused on ${disease.medicalTerms
        .slice(1, 4)
        .join(", ")}. Evidence and sequence output are treated as nonclinical references until reviewed.`,
    organism: species.scientific,
    speciesCommon: species.common,
    condition: disease.canonical,
    diseaseGroup: disease.group,
    intent,
    confidence,
    terms,
    targetGenes: disease.targetGenes,
    taxonomyId: species.taxonomyId,
    needsClarification: !directSpecies || !directDisease,
  };
}

function makeSafetyAssessment(normalized: NormalizedRequest): SafetyAssessment {
  const highRiskIntent =
    normalized.intent.includes("therapeutic") ||
    normalized.intent.includes("sequence") ||
    /gene|genetic|crispr|viral|vaccine|cure|therapy/i.test(normalized.plain);

  return {
    gate: highRiskIntent ? "reference_only" : "research_summary",
    label: highRiskIntent ? "Sequence gated" : "Research-only output",
    reason:
      "The app can return literature, accession IDs, public structure files, and model-input scaffolds. It does not emit novel therapeutic DNA, RNA, viral-vector, or protein constructs.",
    allowedOutputs: [
      "Medical terminology",
      "Evidence summaries with source links",
      "Public accession identifiers",
      "Public PDB/CIF structure links",
      "NVIDIA model routing and request scaffolds",
    ],
    blockedOutputs: [
      "Novel therapeutic sequences",
      "Viral-vector designs",
      "Wet-lab protocols",
      "Clinical treatment instructions",
    ],
  };
}

function scoreEvidence(item: {
  title?: string;
  abstractText?: string;
  pubYear?: string;
}, normalized: NormalizedRequest) {
  const haystack = `${item.title ?? ""} ${item.abstractText ?? ""}`.toLowerCase();
  let score = 0;
  if (normalized.speciesCommon !== "unspecified species" && haystack.includes(normalized.speciesCommon)) {
    score += 3;
  }
  if (normalized.organism !== "species not confirmed" && haystack.includes(normalized.organism.toLowerCase())) {
    score += 3;
  }
  for (const term of normalized.terms.slice(0, 5)) {
    if (haystack.includes(term.toLowerCase())) score += 1;
  }
  for (const gene of normalized.targetGenes.slice(0, 5)) {
    if (haystack.includes(gene.toLowerCase())) score += 1;
  }
  const year = Number.parseInt(item.pubYear ?? "", 10);
  if (Number.isFinite(year)) {
    if (year >= 2024) score += 3;
    else if (year >= 2020) score += 2;
    else if (year >= 2015) score += 1;
  }
  return score;
}

function classifyEvidence(title: string, abstractText: string | undefined): EvidenceSignal {
  const text = `${title} ${abstractText ?? ""}`.toLowerCase();
  if (/clinical trial|prospective|phase|patients|dogs|cats|case series/.test(text)) {
    return "Clinical";
  }
  if (/review|systematic|meta-analysis|guideline|consensus/.test(text)) {
    return "Review";
  }
  if (/model|in vitro|mouse|murine|cell line|xenograft|preclinical/.test(text)) {
    return "Preclinical";
  }
  return "Model";
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init?.headers ?? {}),
      },
    });
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithTimeout(url, init);
  return (await response.json()) as T;
}

function buildEuropePmcQuery(normalized: NormalizedRequest) {
  const species =
    normalized.speciesCommon === "unspecified species"
      ? ""
      : `"${normalized.speciesCommon}" OR "${normalized.organism}"`;
  const disease = `"${normalized.condition}" OR "${normalized.diseaseGroup}"`;
  const genes = normalized.targetGenes.slice(0, 3).join(" OR ");
  return `(${disease}) ${species ? `AND (${species})` : ""} ${genes ? `OR (${genes})` : ""} sort_date:y`;
}

async function searchEuropePmc(normalized: NormalizedRequest) {
  const status: ProviderStatus = {
    provider: "Europe PMC",
    state: "ok",
    detail: "Searched current life-sciences literature.",
  };

  try {
    const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
    url.searchParams.set("query", buildEuropePmcQuery(normalized));
    url.searchParams.set("format", "json");
    url.searchParams.set("pageSize", "8");
    url.searchParams.set("resultType", "core");

    const data = await fetchJson<{
      resultList?: {
        result?: Array<{
          id?: string;
          pmid?: string;
          pmcid?: string;
          doi?: string;
          title?: string;
          journalTitle?: string;
          pubYear?: string;
          abstractText?: string;
          source?: string;
          pubType?: string;
        }>;
      };
    }>(url.toString());

    const rows = data.resultList?.result ?? [];
    if (!rows.length) {
      status.state = "empty";
      status.detail = "No literature matches were returned for the normalized terms.";
      return { evidence: [] as EvidenceItem[], status };
    }

    const evidence = rows
      .filter((row) => row.title)
      .map((row, index): EvidenceItem => {
        const id = row.pmid ?? row.pmcid ?? row.doi ?? row.id ?? `${index}`;
        const href = row.pmid
          ? `https://pubmed.ncbi.nlm.nih.gov/${row.pmid}/`
          : row.pmcid
            ? `https://pmc.ncbi.nlm.nih.gov/articles/${row.pmcid}/`
            : row.doi
              ? `https://doi.org/${row.doi}`
              : `https://europepmc.org/article/${row.source ?? "MED"}/${row.id ?? ""}`;
        const signal = classifyEvidence(row.title ?? "", row.abstractText);

        return {
          id,
          title: row.title ?? "Untitled biomedical record",
          year: row.pubYear ?? "n.d.",
          kind: row.pubType ?? row.journalTitle ?? "Literature result",
          finding: firstSentence(row.abstractText, "Metadata-only record; open the source for details."),
          href,
          source: row.source ?? "Europe PMC",
          signal,
          score: scoreEvidence(row, normalized),
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    return { evidence, status };
  } catch (error) {
    status.state = "error";
    status.detail = error instanceof Error ? error.message : "Europe PMC request failed.";
    return { evidence: [] as EvidenceItem[], status };
  }
}

function uniprotLabel(result: {
  uniProtkbId?: string;
  proteinDescription?: {
    recommendedName?: { fullName?: { value?: string } };
    submissionNames?: Array<{ fullName?: { value?: string } }>;
  };
}) {
  return (
    result.proteinDescription?.recommendedName?.fullName?.value ??
    result.proteinDescription?.submissionNames?.[0]?.fullName?.value ??
    result.uniProtkbId ??
    "Protein record"
  );
}

async function searchUniProt(normalized: NormalizedRequest) {
  const status: ProviderStatus = {
    provider: "UniProt",
    state: "ok",
    detail: "Searched protein accessions for candidate target genes.",
  };
  const candidates: SequenceCandidate[] = [];
  const genes = normalized.targetGenes.slice(0, 6);

  try {
    await Promise.all(
      genes.map(async (gene) => {
        const url = new URL("https://rest.uniprot.org/uniprotkb/search");
        const organism = normalized.taxonomyId ? ` AND organism_id:${normalized.taxonomyId}` : "";
        url.searchParams.set("query", `gene:${gene}${organism}`);
        url.searchParams.set("format", "json");
        url.searchParams.set("size", "1");

        const data = await fetchJson<{
          results?: Array<{
            primaryAccession?: string;
            uniProtkbId?: string;
            entryType?: string;
            sequence?: { length?: number };
            organism?: { scientificName?: string };
            genes?: Array<{ geneName?: { value?: string }; synonyms?: Array<{ value?: string }> }>;
            proteinDescription?: {
              recommendedName?: { fullName?: { value?: string } };
              submissionNames?: Array<{ fullName?: { value?: string } }>;
            };
          }>;
        }>(url.toString());

        const result = data.results?.[0];
        const accession = result?.primaryAccession;
        if (!result || !accession) return;

        candidates.push({
          accession,
          database: "UniProt",
          label: uniprotLabel(result),
          organism: result.organism?.scientificName ?? normalized.organism,
          genes: unique([
            ...(result.genes?.map((item) => item.geneName?.value).filter(Boolean) as string[] | undefined ?? []),
            gene,
          ]),
          length: result.sequence?.length,
          reviewed: result.entryType?.toLowerCase().includes("reviewed"),
          href: `https://www.uniprot.org/uniprotkb/${accession}/entry`,
        });
      }),
    );

    const deduped = Array.from(
      new Map(candidates.map((candidate) => [candidate.accession, candidate])).values(),
    ).slice(0, 6);

    if (!deduped.length) {
      status.state = "empty";
      status.detail = "No UniProt accessions matched the species and target terms.";
    }

    return { sequences: deduped, status };
  } catch (error) {
    status.state = "error";
    status.detail = error instanceof Error ? error.message : "UniProt request failed.";
    return { sequences: [] as SequenceCandidate[], status };
  }
}

async function searchNcbiProtein(normalized: NormalizedRequest) {
  const status: ProviderStatus = {
    provider: "NCBI E-utilities",
    state: "ok",
    detail: "Searched NCBI Protein summaries for accession-linked records.",
  };

  try {
    const geneTerm = normalized.targetGenes.slice(0, 4).map((gene) => `${gene}[Gene Name]`).join(" OR ");
    const organismTerm =
      normalized.organism === "species not confirmed" ? "" : ` AND "${normalized.organism}"[Organism]`;
    const searchUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi");
    searchUrl.searchParams.set("db", "protein");
    searchUrl.searchParams.set("term", `(${geneTerm || normalized.condition})${organismTerm}`);
    searchUrl.searchParams.set("retmode", "json");
    searchUrl.searchParams.set("retmax", "5");
    searchUrl.searchParams.set("tool", "helix-triage");
    searchUrl.searchParams.set("email", APP_EMAIL);

    const search = await fetchJson<{ esearchresult?: { idlist?: string[] } }>(searchUrl.toString());
    const ids = search.esearchresult?.idlist ?? [];
    if (!ids.length) {
      status.state = "empty";
      status.detail = "No NCBI Protein records matched the normalized query.";
      return { sequences: [] as SequenceCandidate[], status };
    }

    const summaryUrl = new URL("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi");
    summaryUrl.searchParams.set("db", "protein");
    summaryUrl.searchParams.set("id", ids.join(","));
    summaryUrl.searchParams.set("retmode", "json");
    summaryUrl.searchParams.set("tool", "helix-triage");
    summaryUrl.searchParams.set("email", APP_EMAIL);

    const summary = await fetchJson<{
      result?: {
        uids?: string[];
        [key: string]: undefined | {
          title?: string;
          caption?: string;
          accessionversion?: string;
          slen?: number;
          organism?: string;
        } | string[];
      };
    }>(summaryUrl.toString());

    const sequences = (summary.result?.uids ?? [])
      .map((uid): SequenceCandidate | null => {
        const row = summary.result?.[uid];
        if (!row || Array.isArray(row)) return null;
        const accession = row.accessionversion ?? row.caption ?? uid;
        return {
          accession,
          database: "NCBI Protein",
          label: row.title ?? "NCBI protein record",
          organism: row.organism ?? normalized.organism,
          genes: normalized.targetGenes.slice(0, 3),
          length: row.slen,
          href: `https://www.ncbi.nlm.nih.gov/protein/${accession}`,
        };
      })
      .filter(Boolean) as SequenceCandidate[];

    return { sequences, status };
  } catch (error) {
    status.state = "error";
    status.detail = error instanceof Error ? error.message : "NCBI request failed.";
    return { sequences: [] as SequenceCandidate[], status };
  }
}

async function searchAlphaFold(sequences: SequenceCandidate[]) {
  const status: ProviderStatus = {
    provider: "AlphaFold DB",
    state: "ok",
    detail: "Checked public structure predictions for UniProt accessions.",
  };
  const structures: StructureCandidate[] = [];
  const uniprot = sequences.filter((candidate) => candidate.database === "UniProt").slice(0, 4);

  try {
    await Promise.all(
      uniprot.map(async (candidate) => {
        try {
          const url = `https://alphafold.ebi.ac.uk/api/prediction/${encodeURIComponent(candidate.accession)}`;
          const rows = await fetchJson<Array<{
            entryId?: string;
            uniprotAccession?: string;
            uniprotDescription?: string;
            pdbUrl?: string;
            cifUrl?: string;
            confidenceScore?: number;
          }>>(url);
          const row = rows[0];
          if (!row) return;
          candidate.structureHref = `https://alphafold.ebi.ac.uk/entry/${row.entryId ?? `AF-${candidate.accession}-F1`}`;
          structures.push({
            accession: row.uniprotAccession ?? candidate.accession,
            label: row.uniprotDescription ?? candidate.label,
            source: "AlphaFold DB",
            href: candidate.structureHref,
            pdbUrl: row.pdbUrl,
            cifUrl: row.cifUrl,
            confidence:
              typeof row.confidenceScore === "number"
                ? `mean pLDDT ${Math.round(row.confidenceScore)}`
                : undefined,
          });
        } catch {
          // Sparse species and genes often have no AlphaFold record; keep other checks running.
        }
      }),
    );

    if (!structures.length) {
      status.state = "empty";
      status.detail = "No public AlphaFold structure prediction was found for the returned accessions.";
    }

    return { structures, status };
  } catch (error) {
    status.state = "error";
    status.detail = error instanceof Error ? error.message : "AlphaFold request failed.";
    return { structures: [] as StructureCandidate[], status };
  }
}

function routeModels(
  normalized: NormalizedRequest,
  sequences: SequenceCandidate[],
  structures: StructureCandidate[],
): RoutedModel[] {
  const hasStructure = structures.length > 0;
  const hasSequence = sequences.length > 0;
  const isSmallMolecule = /drug|small molecule|compound|inhibitor/.test(normalized.plain.toLowerCase());

  const openFoldFit: ModelFit = hasSequence || hasStructure ? "Primary" : "Support";
  const evoFit: ModelFit = hasSequence ? "Support" : "Primary";
  const molFit: ModelFit = isSmallMolecule ? "Primary" : "Deferred";

  return [
    {
      name: "OpenFold3",
      role: "3D biomolecular complex prediction",
      fit: openFoldFit,
      endpoint: "/biology/openfold/openfold3/predict",
      note: hasStructure
        ? "A public structure was found; OpenFold3 is the next step for complex-specific modeling."
        : "Use after a validated protein, DNA, RNA, or ligand entity is selected.",
    },
    {
      name: "Evo 2",
      role: "Genomic foundation model",
      fit: evoFit,
      endpoint: "/biology/arc/evo2/generate",
      note: hasSequence
        ? "Use for nonclinical sequence likelihood, variant-effect, or reference-sequence analysis."
        : "Use to analyze or score vetted genomic context once a reference sequence is selected.",
    },
    {
      name: "RFdiffusion + ProteinMPNN",
      role: "Protein binder backbone and sequence design",
      fit: "Deferred",
      note:
        "Only appropriate after target validation, epitope selection, and review approval.",
    },
    {
      name: "MolMIM + DiffDock",
      role: "Small-molecule generation and docking",
      fit: molFit,
      note: isSmallMolecule
        ? "Best match when the request is for drug-like compound exploration rather than genetic therapy."
        : "Not the primary route for genetic or protein reference research.",
    },
  ];
}

function buildPacket(result: Omit<ResearchResult, "packet">) {
  const evidence =
    result.evidence
      .slice(0, 5)
      .map((item) => `- ${item.year}: ${item.title} (${item.href})`)
      .join("\n") || "- No strong literature hit returned by the live sources.";

  const sequences =
    result.sequences
      .slice(0, 6)
      .map(
        (item) =>
          `- ${item.database}: ${item.accession} | ${item.label} | ${item.organism} | ${item.href}`,
      )
      .join("\n") || "- No accession-linked record found for the normalized target set.";

  const structures =
    result.structures
      .slice(0, 4)
      .map((item) => `- ${item.source}: ${item.accession} | ${item.href}`)
      .join("\n") || "- No public structure file found yet.";

  const models = result.modelRoutes
    .map((item) => `- ${item.name}: ${item.fit} - ${item.role}`)
    .join("\n");

  return `RESEARCH PACKET

Original request:
${result.query}

Medical terminology:
${result.normalized.medical}

Organism:
${result.normalized.organism}

Condition:
${result.normalized.condition}

Search terms:
${result.normalized.terms.join("; ")}

Evidence scan:
${evidence}

Reference sequence/accession candidates:
${sequences}

Structure candidates:
${structures}

NVIDIA model route:
${models}

Sequence output:
WITHHELD_BY_RESEARCH_SAFETY_GATE

Reason:
${result.safety.reason}

Copyable modeling scaffold:
target_accession=${result.sequences[0]?.accession ?? "[INSERT_VALIDATED_ACCESSION]"}
structure_file=${result.structures[0]?.pdbUrl ?? result.structures[0]?.cifUrl ?? "[INSERT_PUBLIC_PDB_OR_CIF_URL]"}
review_status=requires_qualified_biosafety_and_clinical_review`;
}

function cacheKey(query: string) {
  return normalizeText(query).slice(0, 240);
}

async function getD1() {
  try {
    const workers = await import("cloudflare:workers");
    return workers.env.DB ?? null;
  } catch {
    return null;
  }
}

async function readCachedResult(key: string) {
  try {
    const db = await getD1();
    if (!db) return null;

    const row = await db
      .prepare(
        "SELECT result_json, created_at FROM research_runs WHERE cache_key = ? ORDER BY created_at DESC LIMIT 1",
      )
      .bind(key)
      .first<ResearchCacheRow>();
    if (!row) return null;
    if (Date.now() - row.created_at > CACHE_TTL_MS) return null;

    return JSON.parse(row.result_json) as ResearchResult;
  } catch {
    return null;
  }
}

async function writeCachedResult(key: string, query: string, result: ResearchResult) {
  try {
    const db = await getD1();
    if (!db) return;

    await db
      .prepare(
        `INSERT INTO research_runs (id, cache_key, query, result_json, created_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(cache_key) DO UPDATE SET
           query = excluded.query,
           result_json = excluded.result_json,
           created_at = excluded.created_at`,
      )
      .bind(
        crypto.randomUUID(),
        key,
        query,
        JSON.stringify({ ...result, cached: false }),
        Date.now(),
      )
      .run();
  } catch {
    // Persistence should never prevent a research response.
  }
}

async function runResearch(query: string): Promise<ResearchResult> {
  const normalized = normalizeRequest(query);
  const safety = makeSafetyAssessment(normalized);
  const [europePmc, uniProt, ncbi] = await Promise.all([
    searchEuropePmc(normalized),
    searchUniProt(normalized),
    searchNcbiProtein(normalized),
  ]);
  const sequences = Array.from(
    new Map([...uniProt.sequences, ...ncbi.sequences].map((item) => [`${item.database}:${item.accession}`, item])).values(),
  ).slice(0, 10);
  const alphaFold = await searchAlphaFold(sequences);
  const modelRoutes = routeModels(normalized, sequences, alphaFold.structures);
  const base: Omit<ResearchResult, "packet"> = {
    query,
    retrievedAt: new Date().toISOString(),
    normalized,
    evidence: europePmc.evidence,
    sequences,
    structures: alphaFold.structures,
    modelRoutes,
    providerStatus: [europePmc.status, uniProt.status, ncbi.status, alphaFold.status],
    safety,
    cached: false,
  };

  return {
    ...base,
    packet: buildPacket(base),
  };
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { query?: unknown; refresh?: unknown };
    const query = typeof payload.query === "string" ? payload.query.trim() : "";
    if (query.length < 3) {
      return jsonResponse({ error: "Enter a biomedical research request." }, 400);
    }
    if (query.length > 500) {
      return jsonResponse({ error: "Keep the request under 500 characters." }, 400);
    }

    const key = cacheKey(query);
    if (!payload.refresh) {
      const cached = await readCachedResult(key);
      if (cached) {
        return jsonResponse({ ...cached, cached: true });
      }
    }

    const result = await runResearch(query);
    await writeCachedResult(key, query, result);
    return jsonResponse(result);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "The research pipeline failed unexpectedly.",
      },
      500,
    );
  }
}
