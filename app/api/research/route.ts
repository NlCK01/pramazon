import type {
  EvidenceItem,
  EvidenceSignal,
  ModelFit,
  NormalizedRequest,
  ProviderStatus,
  ResearchResult,
  ResearchSynthesis,
  RoutedModel,
  SafetyAssessment,
  SequenceCandidate,
  StructureCandidate,
} from "../../lib/research-types";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const REQUEST_TIMEOUT_MS = 9000;
const APP_EMAIL = "helix-triage@example.com";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";

type ResearchCacheRow = {
  result_json: string;
  created_at: number;
};

type RuntimeEnv = {
  DB?: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_ENABLE_WEB_SEARCH?: string;
  OPENAI_WEB_SEARCH_TOOL?: string;
};

type ResearchBase = Omit<ResearchResult, "packet" | "synthesis">;

type LlmTerminology = {
  speciesCommon: string;
  organism: string;
  taxonomyId: string;
  condition: string;
  diseaseGroup: string;
  intent: string;
  confidence: NormalizedRequest["confidence"];
  medical: string;
  terms: string[];
  targetGenes: string[];
  searchQueries: string[];
  evidenceQuestions: string[];
  sourcePlan: string[];
  needsClarification: boolean;
};

type LlmResearchSynthesis = {
  problem: string;
  research: string;
  sequenceRationale: string;
  modelPlan: string;
  caveats: string[];
  evidenceOrder: string[];
  accessionOrder: string[];
  webFindings: string[];
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
    group: "lung cancer",
    canonical: "lung carcinoma",
    aliases: [
      "lung cancer",
      "lung carcinoma",
      "non-small cell lung cancer",
      "small cell lung cancer",
      "nsclc",
      "sclc",
    ],
    medicalTerms: [
      "lung carcinoma",
      "non-small cell lung carcinoma",
      "lung adenocarcinoma",
      "small cell lung carcinoma",
      "pulmonary neoplasm",
    ],
    targetGenes: ["EGFR", "ALK", "KRAS", "ROS1", "MET", "RET", "BRAF", "TP53"],
    kindHints: ["targeted therapy", "immune checkpoint therapy", "driver mutation"],
  },
  {
    group: "colorectal cancer",
    canonical: "colorectal carcinoma",
    aliases: [
      "colon cancer",
      "colorectal cancer",
      "rectal cancer",
      "bowel cancer",
      "colon carcinoma",
    ],
    medicalTerms: [
      "colorectal carcinoma",
      "colon adenocarcinoma",
      "rectal carcinoma",
      "microsatellite instability",
      "mismatch repair deficiency",
    ],
    targetGenes: ["APC", "KRAS", "TP53", "SMAD4", "BRAF", "MLH1", "MSH2"],
    kindHints: ["targeted therapy", "immunotherapy", "biomarker"],
  },
  {
    group: "pancreatic cancer",
    canonical: "pancreatic ductal adenocarcinoma",
    aliases: ["pancreatic cancer", "pancreas cancer", "pancreatic carcinoma"],
    medicalTerms: [
      "pancreatic ductal adenocarcinoma",
      "pancreatic carcinoma",
      "KRAS-mutant pancreatic cancer",
      "DNA damage repair biomarker",
    ],
    targetGenes: ["KRAS", "TP53", "CDKN2A", "SMAD4", "BRCA1", "BRCA2", "PALB2"],
    kindHints: ["targeted therapy", "stroma", "DNA repair"],
  },
  {
    group: "kidney cancer",
    canonical: "renal cell carcinoma",
    aliases: ["kidney cancer", "renal cancer", "renal cell carcinoma", "kidney carcinoma"],
    medicalTerms: [
      "renal cell carcinoma",
      "clear cell renal cell carcinoma",
      "papillary renal cell carcinoma",
      "VEGF pathway",
      "immune checkpoint therapy",
    ],
    targetGenes: ["VHL", "PBRM1", "SETD2", "BAP1", "MET", "TP53"],
    kindHints: ["targeted therapy", "angiogenesis", "immunotherapy"],
  },
  {
    group: "liver cancer",
    canonical: "hepatocellular carcinoma",
    aliases: ["liver cancer", "hepatic cancer", "hepatocellular carcinoma", "liver carcinoma"],
    medicalTerms: [
      "hepatocellular carcinoma",
      "hepatic neoplasm",
      "WNT beta-catenin signaling",
      "immune checkpoint therapy",
    ],
    targetGenes: ["TERT", "CTNNB1", "TP53", "AXIN1", "ARID1A", "VEGFA"],
    kindHints: ["targeted therapy", "immunotherapy", "angiogenesis"],
  },
  {
    group: "brain cancer",
    canonical: "glioma",
    aliases: ["brain cancer", "brain tumor", "brain tumour", "glioma", "glioblastoma"],
    medicalTerms: [
      "glioma",
      "glioblastoma",
      "astrocytoma",
      "IDH-mutant glioma",
      "central nervous system neoplasm",
    ],
    targetGenes: ["IDH1", "IDH2", "MGMT", "EGFR", "TERT", "TP53", "ATRX"],
    kindHints: ["molecular classification", "targeted therapy", "biomarker"],
  },
  {
    group: "ovarian cancer",
    canonical: "ovarian carcinoma",
    aliases: ["ovarian cancer", "ovary cancer", "ovarian carcinoma"],
    medicalTerms: [
      "ovarian carcinoma",
      "high-grade serous ovarian carcinoma",
      "homologous recombination deficiency",
      "PARP inhibitor biomarker",
    ],
    targetGenes: ["BRCA1", "BRCA2", "TP53", "RAD51C", "RAD51D", "PIK3CA"],
    kindHints: ["DNA repair", "targeted therapy", "biomarker"],
  },
  {
    group: "bladder cancer",
    canonical: "urothelial carcinoma",
    aliases: ["bladder cancer", "urothelial cancer", "bladder carcinoma", "urothelial carcinoma"],
    medicalTerms: [
      "urothelial carcinoma",
      "bladder carcinoma",
      "FGFR-altered urothelial cancer",
      "immune checkpoint therapy",
    ],
    targetGenes: ["FGFR3", "TP53", "RB1", "ERBB2", "PIK3CA", "TERT"],
    kindHints: ["targeted therapy", "immunotherapy", "biomarker"],
  },
  {
    group: "hematologic malignancy",
    canonical: "leukemia",
    aliases: [
      "blood cancer",
      "blood cancers",
      "leukemia",
      "leukaemia",
      "aml",
      "all",
      "cll",
      "cml",
      "acute myeloid leukemia",
      "acute lymphoblastic leukemia",
      "chronic lymphocytic leukemia",
      "chronic myeloid leukemia",
    ],
    medicalTerms: [
      "leukemia",
      "hematologic malignancy",
      "acute myeloid leukemia",
      "acute lymphoblastic leukemia",
      "chronic lymphocytic leukemia",
      "chronic myeloid leukemia",
      "bone marrow neoplasm",
    ],
    targetGenes: ["BCR", "ABL1", "FLT3", "NPM1", "RUNX1", "PML", "RARA", "JAK2", "TP53"],
    kindHints: ["hematology", "blood cancer", "targeted therapy", "fusion gene", "biomarker"],
  },
  {
    group: "hematologic malignancy",
    canonical: "lymphoma",
    aliases: [
      "lymphoma",
      "lymph cancer",
      "hodgkin lymphoma",
      "non-hodgkin lymphoma",
      "diffuse large b-cell lymphoma",
    ],
    medicalTerms: [
      "lymphoma",
      "Hodgkin lymphoma",
      "non-Hodgkin lymphoma",
      "diffuse large B-cell lymphoma",
      "B-cell receptor signaling",
    ],
    targetGenes: ["CD19", "CD20", "BCL2", "BCL6", "MYC", "BTK", "TP53"],
    kindHints: ["hematology", "immunotherapy", "CAR T-cell target", "biomarker"],
  },
  {
    group: "plasma cell neoplasm",
    canonical: "multiple myeloma",
    aliases: ["multiple myeloma", "myeloma", "plasma cell cancer"],
    medicalTerms: [
      "multiple myeloma",
      "plasma cell neoplasm",
      "BCMA-targeted therapy",
      "proteasome inhibitor response",
    ],
    targetGenes: ["TNFRSF17", "KRAS", "NRAS", "BRAF", "TP53", "CCND1"],
    kindHints: ["hematology", "immunotherapy", "targeted therapy"],
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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function cleanArray(value: unknown, fallback: string[], limit: number) {
  const raw = Array.isArray(value) ? value : fallback;
  return unique(
    raw
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean),
  ).slice(0, limit);
}

function cleanGenes(value: unknown, fallback: string[]) {
  return cleanArray(value, fallback, 12)
    .map((item) => item.toUpperCase().replace(/[^A-Z0-9-]/g, ""))
    .filter(Boolean);
}

function cleanConfidence(value: unknown, fallback: NormalizedRequest["confidence"]) {
  return value === "high" || value === "medium" || value === "low" ? value : fallback;
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

function inferConditionText(clean: string) {
  const requestWords =
    /\b(cure|treat|treatment|therapy|therapeutic|fix|for|my|a|an|the|please|make|create|generate|help|against|in|of|to|with)\b/g;
  const speciesAliases = speciesProfiles
    .flatMap((profile) => profile.aliases)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");
  const speciesRegex = speciesAliases ? new RegExp(`\\b(?:${speciesAliases})\\b`, "g") : null;
  const inferred = clean
    .replace(requestWords, " ")
    .replace(speciesRegex ?? /$^/, " ")
    .replace(/\b(gene|genetic|sequence|program|medicine|drug)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return inferred.slice(0, 90);
}

function inferredDiseaseProfile(inferred: string): DiseaseProfile {
  if (!inferred || /^(condition|disease|illness|problem)$/.test(inferred)) {
    return {
      group: "biomedical condition",
      canonical: "condition not confirmed",
      medicalTerms: [
        "condition not confirmed",
        "differential diagnosis",
        "target validation",
        "comparative biomedical literature",
      ],
      targetGenes: ["TP53", "PTEN", "CD274", "PDCD1"],
      kindHints: ["target validation", "biomarker"],
    };
  }

  if (/^(cancer|tumou?r|carcinoma|sarcoma)$/.test(inferred)) {
    return {
      group: "oncology condition",
      canonical: "cancer type not specified",
      medicalTerms: [
        "oncology condition",
        "tumor classification",
        "molecular oncology",
        "target validation",
      ],
      targetGenes: ["TP53", "PTEN", "CD274", "PDCD1", "MYC", "KRAS"],
      kindHints: ["oncology", "targeted therapy", "biomarker"],
    };
  }

  if (/\b(cancer|tumou?r|carcinoma|sarcoma)\b/.test(inferred)) {
    const site = inferred.replace(/\b(cancer|tumou?r|carcinoma|sarcoma)\b/g, " ").replace(/\s+/g, " ").trim();
    const carcinoma = site ? `${site} carcinoma` : inferred;
    return {
      group: inferred,
      canonical: inferred,
      medicalTerms: unique([
        inferred,
        carcinoma,
        `${site || inferred} oncology`,
        "molecular oncology",
        "target validation",
      ]),
      targetGenes: ["TP53", "PTEN", "CD274", "PDCD1", "MYC", "KRAS"],
      kindHints: ["oncology", "targeted therapy", "biomarker"],
    };
  }

  return {
    group: inferred,
    canonical: inferred,
    medicalTerms: [
      inferred,
      "differential diagnosis",
      "target validation",
      "comparative biomedical literature",
    ],
    targetGenes: ["TP53", "PTEN", "CD274", "PDCD1"],
    kindHints: ["target validation", "biomarker"],
  };
}

function extractDisease(clean: string, raw: string): DiseaseProfile {
  const profiled = diseaseProfiles.find((profile) =>
    profile.aliases.some((alias) => new RegExp(`\\b${alias}\\b`).test(clean)),
  );

  if (profiled) {
    return profiled;
  }

  return inferredDiseaseProfile(inferConditionText(normalizeText(raw)));
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
  const directDisease =
    disease.canonical !== "condition not confirmed" &&
    disease.canonical !== "cancer type not specified";
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
  const searchQueries = [
    `("${disease.canonical}" OR "${disease.group}")${species.common === "unspecified species" ? "" : ` AND ("${species.common}" OR "${species.scientific}")`}`,
    `${terms.slice(0, 4).join(" ")} ${disease.targetGenes.slice(0, 3).join(" ")}`.trim(),
  ];
  const evidenceQuestions = [
    `What recent studies connect ${disease.canonical} with ${species.scientific}?`,
    `Which genes or proteins are repeatedly discussed for ${disease.canonical}?`,
    `Are there public accession or structure records for the top targets?`,
  ];
  const sourcePlan = [
    "Use LLM terminology to form source-specific search queries.",
    "Search Europe PMC/PubMed for recent literature.",
    "Search UniProt and NCBI for accession-linked target records.",
    "Check AlphaFold DB for public structure files.",
  ];

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
    searchQueries,
    evidenceQuestions,
    sourcePlan,
    taxonomyId: species.taxonomyId,
    needsClarification: !directSpecies || !directDisease,
    terminologySource: "rules",
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

function buildLlmPrompt(query: string, fallback: NormalizedRequest) {
  return `Act as the biomedical research planner for this app. Convert the user's plain-language request into precise medical terminology, source-searchable genes, and live retrieval queries.

User request:
${query}

Deterministic fallback interpretation:
species=${fallback.organism}
condition=${fallback.condition}
terms=${fallback.terms.join("; ")}
target_genes=${fallback.targetGenes.join(", ")}

Rules:
- Return only JSON matching the schema.
- Do not provide treatment instructions, wet-lab steps, dosages, therapeutic constructs, DNA/RNA/protein sequences, or clinical advice.
- Do not use "malignant neoplasm" or a bare "neoplasm" as the condition when the request contains a more specific clue such as an organ, tissue, species, syndrome, or blood/immune context.
- If the user says "blood cancer", include leukemia, hematologic malignancy, and the major leukemia subtype search terms.
- If the user asks for "[site] cancer" and the exact subtype is unclear, preserve "[site] cancer" as condition and include likely medical synonyms such as "[site] carcinoma" in terms.
- Build 4-6 source queries that Europe PMC/PubMed can actually run. Make them specific, recent-study oriented, and include species plus scientific organism when known.
- Include 3-5 evidence questions and a source plan for literature, accession, structure, and model-routing lookup.
- Prefer real HGNC/VGNC-style gene symbols and public database terms over broad words.`;
}

function extractResponseText(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    return payload.output
      .flatMap((item) =>
        typeof item === "object" &&
        item !== null &&
        "content" in item &&
        Array.isArray(item.content)
          ? item.content
          : [],
      )
      .map((content) =>
        typeof content === "object" &&
        content !== null &&
        "text" in content &&
        typeof content.text === "string"
          ? content.text
          : "",
      )
      .join("")
      .trim();
  }

  return "";
}

function mergeLlmTerminology(
  query: string,
  fallback: NormalizedRequest,
  value: Partial<LlmTerminology>,
  model: string,
): NormalizedRequest {
  const terms = cleanArray(value.terms, fallback.terms, 14);
  const targetGenes = cleanGenes(value.targetGenes, fallback.targetGenes);
  const searchQueries = cleanArray(
    value.searchQueries,
    fallback.searchQueries,
    6,
  );
  const evidenceQuestions = cleanArray(
    value.evidenceQuestions,
    fallback.evidenceQuestions,
    6,
  );
  const sourcePlan = cleanArray(value.sourcePlan, fallback.sourcePlan, 6);
  const organism =
    typeof value.organism === "string" && value.organism.trim()
      ? value.organism.trim()
      : fallback.organism;
  const speciesCommon =
    typeof value.speciesCommon === "string" && value.speciesCommon.trim()
      ? value.speciesCommon.trim().toLowerCase()
      : fallback.speciesCommon;
  const condition =
    typeof value.condition === "string" && value.condition.trim()
      ? value.condition.trim()
      : fallback.condition;
  const diseaseGroup =
    typeof value.diseaseGroup === "string" && value.diseaseGroup.trim()
      ? value.diseaseGroup.trim()
      : fallback.diseaseGroup;
  const medical =
    typeof value.medical === "string" && value.medical.trim()
      ? value.medical.trim()
      : fallback.medical;

  return {
    plain: query,
    medical,
    organism,
    speciesCommon,
    condition,
    diseaseGroup,
    intent:
      typeof value.intent === "string" && value.intent.trim()
        ? value.intent.trim()
        : fallback.intent,
    confidence: cleanConfidence(value.confidence, fallback.confidence),
    terms,
    targetGenes,
    searchQueries,
    evidenceQuestions,
    sourcePlan,
    taxonomyId:
      typeof value.taxonomyId === "string" && value.taxonomyId.trim()
        ? value.taxonomyId.trim()
        : fallback.taxonomyId,
    needsClarification:
      typeof value.needsClarification === "boolean"
        ? value.needsClarification
        : fallback.needsClarification,
    terminologySource: "llm",
    llmModel: model,
  };
}

async function generateLlmTerminology(query: string, fallback: NormalizedRequest) {
  const env = await getRuntimeEnv();
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const baseUrl = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const status: ProviderStatus = {
    provider: "LLM research planner",
    state: "empty",
    detail: "OPENAI_API_KEY is not configured; used deterministic research planning fallback.",
  };

  if (!apiKey) {
    return { normalized: fallback, status };
  }

  try {
    const response = await fetchWithTimeout(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content:
              "You are a biomedical research planner for a live retrieval system. Return precise terminology, source queries, target genes, and search strategy only. Never provide clinical instructions or novel biological sequences.",
          },
          {
            role: "user",
            content: buildLlmPrompt(query, fallback),
          },
        ],
        max_output_tokens: 2200,
        text: {
          format: {
            type: "json_schema",
            name: "biomedical_terminology",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: [
                "speciesCommon",
                "organism",
                "taxonomyId",
                "condition",
                "diseaseGroup",
                "intent",
                "confidence",
                "medical",
                "terms",
                "targetGenes",
                "searchQueries",
                "evidenceQuestions",
                "sourcePlan",
                "needsClarification",
              ],
              properties: {
                speciesCommon: { type: "string" },
                organism: { type: "string" },
                taxonomyId: { type: "string" },
                condition: { type: "string" },
                diseaseGroup: { type: "string" },
                intent: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                medical: { type: "string" },
                terms: {
                  type: "array",
                  items: { type: "string" },
                },
                targetGenes: {
                  type: "array",
                  items: { type: "string" },
                },
                searchQueries: {
                  type: "array",
                  items: { type: "string" },
                },
                evidenceQuestions: {
                  type: "array",
                  items: { type: "string" },
                },
                sourcePlan: {
                  type: "array",
                  items: { type: "string" },
                },
                needsClarification: { type: "boolean" },
              },
            },
          },
        },
      }),
    });
    const payload = await response.json();
    const outputText = extractResponseText(payload);
    const parsed = JSON.parse(outputText) as Partial<LlmTerminology>;
    status.state = "ok";
    status.detail = `Generated terminology, target genes, source queries, and retrieval plan with ${model}.`;

    return {
      normalized: mergeLlmTerminology(query, fallback, parsed, model),
      status,
    };
  } catch (error) {
    status.state = "error";
    status.detail = `LLM research planning failed; used deterministic fallback. ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    return { normalized: fallback, status };
  }
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

function isSpecificCondition(normalized: NormalizedRequest) {
  return (
    normalized.condition !== "condition not confirmed" &&
    normalized.condition !== "cancer type not specified" &&
    !/not confirmed|not specified/i.test(normalized.condition)
  );
}

function isRelevantEvidence(
  item: {
    title?: string;
    abstractText?: string;
  },
  normalized: NormalizedRequest,
) {
  if (!isSpecificCondition(normalized)) return true;

  const haystack = `${item.title ?? ""} ${item.abstractText ?? ""}`.toLowerCase();
  const genericTerms = new Set([
    "recent study",
    "sequence accession",
    "target validation",
    "targeted therapy",
    "biomarker",
    "molecular oncology",
    "comparative biomedical literature",
  ]);
  const diseaseTerms = unique([
    normalized.condition,
    normalized.diseaseGroup,
    ...normalized.terms,
  ])
    .map((term) => term.toLowerCase())
    .filter((term) => term.length >= 4 && !genericTerms.has(term));
  const geneTerms = normalized.targetGenes.map((gene) => gene.toLowerCase()).filter((gene) => gene.length >= 3);

  return (
    diseaseTerms.some((term) => haystack.includes(term)) ||
    geneTerms.some((gene) => new RegExp(`\\b${escapeRegExp(gene)}\\b`, "i").test(haystack))
  );
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

type EuropePmcResultRow = {
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
};

function stripEuropePmcSort(value: string) {
  return value.replace(/\bsort_date\s*:\s*y\b/gi, " ").replace(/\s+/g, " ").trim();
}

function buildEuropePmcQueries(normalized: NormalizedRequest) {
  const planned = normalized.searchQueries.map(stripEuropePmcSort).filter(Boolean);
  const species =
    normalized.speciesCommon === "unspecified species"
      ? ""
      : `"${normalized.speciesCommon}" OR "${normalized.organism}"`;
  const disease = `"${normalized.condition}" OR "${normalized.diseaseGroup}"`;
  const genes = normalized.targetGenes.slice(0, 3).join(" OR ");
  const fallbackQueries = [
    `(${disease}) ${species ? `AND (${species})` : ""} ${genes ? `AND (${genes})` : ""}`.trim(),
    `${normalized.terms.slice(0, 5).map((term) => `"${term}"`).join(" OR ")} ${species ? `AND (${species})` : ""}`.trim(),
    `${normalized.condition} ${normalized.organism} ${normalized.targetGenes.slice(0, 3).join(" ")}`.trim(),
  ];

  return unique([...planned, ...fallbackQueries])
    .map(stripEuropePmcSort)
    .filter((query) => query.length > 2)
    .slice(0, 5)
    .map((query) => `${query} sort_date:y`);
}

async function fetchEuropePmcRows(query: string) {
  const url = new URL("https://www.ebi.ac.uk/europepmc/webservices/rest/search");
  url.searchParams.set("query", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("pageSize", "8");
  url.searchParams.set("resultType", "core");

  const data = await fetchJson<{
    resultList?: {
      result?: EuropePmcResultRow[];
    };
  }>(url.toString());

  return data.resultList?.result ?? [];
}

async function searchEuropePmc(normalized: NormalizedRequest) {
  const status: ProviderStatus = {
    provider: "Europe PMC",
    state: "ok",
    detail: "Searched current life-sciences literature.",
  };

  try {
    const queries = buildEuropePmcQueries(normalized);
    const attempts = await Promise.allSettled(queries.map((query) => fetchEuropePmcRows(query)));
    const rows = attempts
      .flatMap((attempt) => (attempt.status === "fulfilled" ? attempt.value : []))
      .filter((row) => row.title && isRelevantEvidence(row, normalized));
    const failures = attempts.filter((attempt) => attempt.status === "rejected").length;
    if (!rows.length) {
      status.state = failures === attempts.length ? "error" : "empty";
      status.detail =
        failures === attempts.length
          ? "All planned literature queries failed."
          : "No literature matches were returned for the normalized terms.";
      return { evidence: [] as EvidenceItem[], status };
    }

    const dedupedRows = Array.from(
      new Map(
        rows.map((row) => [
          row.pmid ?? row.pmcid ?? row.doi ?? row.id ?? row.title ?? crypto.randomUUID(),
          row,
        ]),
      ).values(),
    );

    const evidence = dedupedRows
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

    status.detail = `Ran ${queries.length} planned literature queries and merged ${dedupedRows.length} source records${
      failures ? `; ${failures} query failed` : ""
    }.`;
    return { evidence, status };
  } catch (error) {
    status.state = "error";
    status.detail = error instanceof Error ? error.message : "Europe PMC request failed.";
    return { evidence: [] as EvidenceItem[], status };
  }
}

type UniProtResult = {
  uniProtkbId?: string;
  proteinDescription?: {
    recommendedName?: { fullName?: { value?: string } };
    submissionNames?: Array<{ fullName?: { value?: string } }>;
  };
  primaryAccession?: string;
  entryType?: string;
  sequence?: { length?: number };
  organism?: { scientificName?: string };
  genes?: Array<{ geneName?: { value?: string }; synonyms?: Array<{ value?: string }> }>;
};

function uniprotLabel(result: UniProtResult) {
  return (
    result.proteinDescription?.recommendedName?.fullName?.value ??
    result.proteinDescription?.submissionNames?.[0]?.fullName?.value ??
    result.uniProtkbId ??
    "Protein record"
  );
}

function isReviewedUniProt(result: UniProtResult) {
  const entryType = result.entryType?.toLowerCase() ?? "";
  return entryType.includes("swiss-prot") || /^uniprotkb reviewed\b/.test(entryType);
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
        const organism = normalized.taxonomyId ? ` AND organism_id:${normalized.taxonomyId}` : "";
        const queries = unique([
          `gene:${gene}${organism} AND reviewed:true`,
          `gene:${gene}${organism}`,
          normalized.taxonomyId && normalized.taxonomyId !== "9606"
            ? `gene:${gene} AND organism_id:9606 AND reviewed:true`
            : "",
          `gene:${gene} AND reviewed:true`,
        ]).filter(Boolean);

        let result: UniProtResult | undefined;
        for (const query of queries) {
          const url = new URL("https://rest.uniprot.org/uniprotkb/search");
          url.searchParams.set("query", query);
          url.searchParams.set("format", "json");
          url.searchParams.set("size", "1");

          const data = await fetchJson<{ results?: UniProtResult[] }>(url.toString());
          result = data.results?.[0];
          if (result?.primaryAccession) break;
        }

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
          reviewed: isReviewedUniProt(result),
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
    } else if (deduped.some((item) => item.organism !== normalized.organism)) {
      status.detail = "Found species-specific records where available and reviewed reference homologs when sparse.";
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

  async function probeAlphaFoldFile(candidate: SequenceCandidate) {
    for (const version of [6, 5, 4, 3]) {
      const entryId = `AF-${candidate.accession}-F1`;
      const pdbUrl = `https://alphafold.ebi.ac.uk/files/${entryId}-model_v${version}.pdb`;
      try {
        await fetchWithTimeout(pdbUrl, { method: "HEAD" });
        candidate.structureHref = `https://alphafold.ebi.ac.uk/entry/${candidate.accession}`;
        return {
          accession: candidate.accession,
          label: candidate.label,
          source: "AlphaFold DB" as const,
          href: candidate.structureHref,
          pdbUrl,
          confidence: `public AlphaFold model v${version}`,
        };
      } catch {
        // Try the next known AlphaFold model version.
      }
    }
    return null;
  }

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
            globalMetricValue?: number;
            latestVersion?: number;
          }>>(url);
          const row = rows[0];
          if (!row) {
            const fallback = candidate.reviewed ? await probeAlphaFoldFile(candidate) : null;
            if (fallback) structures.push(fallback);
            return;
          }
          candidate.structureHref = `https://alphafold.ebi.ac.uk/entry/${row.uniprotAccession ?? candidate.accession}`;
          const confidenceScore =
            typeof row.confidenceScore === "number"
              ? row.confidenceScore
              : typeof row.globalMetricValue === "number"
                ? row.globalMetricValue
                : undefined;
          structures.push({
            accession: row.uniprotAccession ?? candidate.accession,
            label: row.uniprotDescription ?? candidate.label,
            source: "AlphaFold DB",
            href: candidate.structureHref,
            pdbUrl: row.pdbUrl,
            cifUrl: row.cifUrl,
            confidence:
              typeof confidenceScore === "number"
                ? `mean pLDDT ${Math.round(confidenceScore)}`
                : typeof row.latestVersion === "number"
                  ? `public AlphaFold model v${row.latestVersion}`
                : undefined,
          });
        } catch {
          const fallback = candidate.reviewed ? await probeAlphaFoldFile(candidate) : null;
          if (fallback) structures.push(fallback);
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

function makeDeterministicSynthesis(base: ResearchBase): ResearchSynthesis {
  const topEvidence = base.evidence[0];
  const topSequence = base.sequences[0];
  const topModel = base.modelRoutes.find((route) => route.fit === "Primary") ?? base.modelRoutes[0];

  return {
    source: "deterministic",
    problem: `${base.normalized.plain} was normalized to ${base.normalized.condition} in ${base.normalized.organism}.`,
    research: topEvidence
      ? `The strongest retrieved source is "${topEvidence.title}" (${topEvidence.year}); review the linked record before treating it as actionable evidence.`
      : "No strong live literature hit was returned, so the result should be treated as an unresolved research lead.",
    sequenceRationale: topSequence
      ? `${topSequence.database} accession ${topSequence.accession} was selected as a public reference candidate for ${topSequence.genes.join(", ") || "the target set"}.`
      : "No accession-linked record was selected; add a validated target before running sequence or structure models.",
    modelPlan: topModel
      ? `${topModel.name} is the leading model route because ${topModel.note}`
      : "No model route was selected.",
    caveats: [
      "The fallback synthesis is not an LLM interpretation.",
      "Species-specific evidence may be sparse for unusual organism and condition combinations.",
      "Therapeutic sequence generation remains blocked until expert review.",
    ],
    evidenceOrder: base.evidence.map((item) => item.id),
    accessionOrder: base.sequences.map((item) => item.accession),
  };
}

function buildSynthesisPrompt(base: ResearchBase) {
  const evidence = base.evidence.slice(0, 6).map((item) => ({
    id: item.id,
    title: item.title,
    year: item.year,
    signal: item.signal,
    score: item.score,
    finding: item.finding,
    href: item.href,
  }));
  const sequences = base.sequences.slice(0, 10).map((item) => ({
    accession: item.accession,
    database: item.database,
    label: item.label,
    organism: item.organism,
    genes: item.genes,
    length: item.length,
    href: item.href,
  }));
  const structures = base.structures.slice(0, 4).map((item) => ({
    accession: item.accession,
    label: item.label,
    source: item.source,
    href: item.href,
    confidence: item.confidence,
  }));
  const models = base.modelRoutes.map((item) => ({
    name: item.name,
    fit: item.fit,
    role: item.role,
    note: item.note,
    endpoint: item.endpoint,
  }));

  return `Synthesize this completed biomedical retrieval run.

Original request:
${base.query}

Normalized request:
${JSON.stringify(base.normalized)}

Retrieved evidence:
${JSON.stringify(evidence)}

Reference accessions:
${JSON.stringify(sequences)}

Structure candidates:
${JSON.stringify(structures)}

Model routes:
${JSON.stringify(models)}

Requirements:
- Use the retrieved records as the grounding source. Do not invent paper titles, accessions, structures, citations, or URLs.
- You may use web search only to add high-level context or very recent confirmation, but keep source-specific claims tied to retrieved records when possible.
- If the evidence is sparse, indirect, or not species-specific, state that clearly.
- Never output nucleotide, amino-acid, guide-RNA, viral-vector, plasmid, protocol, dosage, or clinical treatment instructions.
- Keep the condition specific. Do not summarize this as "malignant neoplasm" when a clearer term exists.
- Return JSON only.`;
}

function mergeLlmSynthesis(
  value: Partial<LlmResearchSynthesis>,
  fallback: ResearchSynthesis,
  model: string,
): ResearchSynthesis {
  const textField = (field: keyof Pick<LlmResearchSynthesis, "problem" | "research" | "sequenceRationale" | "modelPlan">) =>
    typeof value[field] === "string" && value[field].trim()
      ? value[field].trim()
      : fallback[field];

  return {
    source: "llm",
    problem: textField("problem"),
    research: textField("research"),
    sequenceRationale: textField("sequenceRationale"),
    modelPlan: textField("modelPlan"),
    caveats: cleanArray(value.caveats, fallback.caveats, 6),
    evidenceOrder: cleanArray(value.evidenceOrder, fallback.evidenceOrder, 12),
    accessionOrder: cleanArray(value.accessionOrder, fallback.accessionOrder, 12),
    webFindings: cleanArray(value.webFindings, [], 5),
    llmModel: model,
  };
}

function shouldUseHostedWebSearch(env: RuntimeEnv, baseUrl: string) {
  if (env.OPENAI_ENABLE_WEB_SEARCH?.toLowerCase() === "false") return false;
  return baseUrl.includes("api.openai.com") || baseUrl.includes("platform.openai.com");
}

function synthesisSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "problem",
      "research",
      "sequenceRationale",
      "modelPlan",
      "caveats",
      "evidenceOrder",
      "accessionOrder",
      "webFindings",
    ],
    properties: {
      problem: { type: "string" },
      research: { type: "string" },
      sequenceRationale: { type: "string" },
      modelPlan: { type: "string" },
      caveats: {
        type: "array",
        items: { type: "string" },
      },
      evidenceOrder: {
        type: "array",
        items: { type: "string" },
      },
      accessionOrder: {
        type: "array",
        items: { type: "string" },
      },
      webFindings: {
        type: "array",
        items: { type: "string" },
      },
    },
  };
}

async function postOpenAiResponseJson<T>(
  env: RuntimeEnv,
  body: Record<string, unknown>,
): Promise<T> {
  const apiKey = env.OPENAI_API_KEY;
  const baseUrl = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const response = await fetchWithTimeout(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  const outputText = extractResponseText(payload);
  return JSON.parse(outputText) as T;
}

async function generateResearchSynthesis(base: ResearchBase) {
  const env = await getRuntimeEnv();
  const model = env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const baseUrl = (env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const fallback = makeDeterministicSynthesis(base);
  const status: ProviderStatus = {
    provider: "LLM research synthesis",
    state: "empty",
    detail: "OPENAI_API_KEY is not configured; used deterministic synthesis.",
  };

  if (!env.OPENAI_API_KEY) {
    return { synthesis: fallback, status };
  }

  const requestBody: Record<string, unknown> = {
    model,
    input: [
      {
        role: "system",
        content:
          "You are a biomedical research synthesis agent. Ground output in provided source records, rank references, and keep all outputs nonclinical and sequence-gated.",
      },
      {
        role: "user",
        content: buildSynthesisPrompt(base),
      },
    ],
    max_output_tokens: 2200,
    text: {
      format: {
        type: "json_schema",
        name: "biomedical_research_synthesis",
        strict: true,
        schema: synthesisSchema(),
      },
    },
  };
  const webTool = env.OPENAI_WEB_SEARCH_TOOL || "web_search";
  const canUseWebSearch = shouldUseHostedWebSearch(env, baseUrl);

  try {
    const parsed = await postOpenAiResponseJson<Partial<LlmResearchSynthesis>>(
      env,
      canUseWebSearch ? { ...requestBody, tools: [{ type: webTool }] } : requestBody,
    );
    status.state = "ok";
    status.detail = `Synthesized the retrieved evidence, accessions, and model route with ${model}${
      canUseWebSearch ? " using hosted web search where available" : ""
    }.`;
    return { synthesis: mergeLlmSynthesis(parsed, fallback, model), status };
  } catch (error) {
    if (canUseWebSearch) {
      try {
        const parsed = await postOpenAiResponseJson<Partial<LlmResearchSynthesis>>(env, requestBody);
        status.state = "ok";
        status.detail = `Synthesized retrieved biomedical sources with ${model}; hosted web search was unavailable.`;
        return { synthesis: mergeLlmSynthesis(parsed, fallback, model), status };
      } catch (retryError) {
        status.state = "error";
        status.detail = `LLM synthesis failed; used deterministic synthesis. ${
          retryError instanceof Error ? retryError.message : "Unknown error"
        }`;
        return { synthesis: fallback, status };
      }
    }

    status.state = "error";
    status.detail = `LLM synthesis failed; used deterministic synthesis. ${
      error instanceof Error ? error.message : "Unknown error"
    }`;
    return { synthesis: fallback, status };
  }
}

function reorderEvidence(evidence: EvidenceItem[], order: string[]) {
  if (!order.length) return evidence;
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...evidence].sort((a, b) => {
    const aRank = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return aRank === bRank ? b.score - a.score : aRank - bRank;
  });
}

function reorderSequences(sequences: SequenceCandidate[], order: string[]) {
  if (!order.length) return sequences;
  const rank = new Map(order.map((accession, index) => [accession, index]));
  return [...sequences].sort((a, b) => {
    const aRank = rank.get(a.accession) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.accession) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
}

function sortSequencesByTargets(sequences: SequenceCandidate[], targetGenes: string[]) {
  const geneRank = new Map(targetGenes.map((gene, index) => [gene.toUpperCase(), index]));
  const databaseRank = new Map<SequenceCandidate["database"], number>([
    ["UniProt", 0],
    ["NCBI Protein", 1],
    ["NCBI Gene", 2],
  ]);

  return [...sequences].sort((a, b) => {
    const aGeneRank = Math.min(
      ...a.genes.map((gene) => geneRank.get(gene.toUpperCase()) ?? Number.MAX_SAFE_INTEGER),
    );
    const bGeneRank = Math.min(
      ...b.genes.map((gene) => geneRank.get(gene.toUpperCase()) ?? Number.MAX_SAFE_INTEGER),
    );
    if (aGeneRank !== bGeneRank) return aGeneRank - bGeneRank;

    const aDatabaseRank = databaseRank.get(a.database) ?? Number.MAX_SAFE_INTEGER;
    const bDatabaseRank = databaseRank.get(b.database) ?? Number.MAX_SAFE_INTEGER;
    if (aDatabaseRank !== bDatabaseRank) return aDatabaseRank - bDatabaseRank;

    const aReviewedRank = a.reviewed ? 0 : 1;
    const bReviewedRank = b.reviewed ? 0 : 1;
    if (aReviewedRank !== bReviewedRank) return aReviewedRank - bReviewedRank;

    return a.accession.localeCompare(b.accession);
  });
}

function reorderStructures(structures: StructureCandidate[], order: string[]) {
  if (!order.length) return structures;
  const rank = new Map(order.map((accession, index) => [accession, index]));
  return [...structures].sort((a, b) => {
    const aRank = rank.get(a.accession) ?? Number.MAX_SAFE_INTEGER;
    const bRank = rank.get(b.accession) ?? Number.MAX_SAFE_INTEGER;
    return aRank - bRank;
  });
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
  const caveats =
    result.synthesis.caveats.map((item) => `- ${item}`).join("\n") ||
    "- Review source links and accessions before use.";
  const questions =
    result.normalized.evidenceQuestions.map((item) => `- ${item}`).join("\n") ||
    "- No LLM evidence questions were generated.";
  const sourcePlan =
    result.normalized.sourcePlan.map((item) => `- ${item}`).join("\n") ||
    "- Search trusted literature and public sequence/structure databases.";
  const webFindings =
    result.synthesis.webFindings?.length
      ? `\nLLM web context:\n${result.synthesis.webFindings.map((item) => `- ${item}`).join("\n")}\n`
      : "";
  const primarySequence = result.sequences[0];
  const primaryStructure =
    result.structures.find((item) => item.accession === primarySequence?.accession) ??
    result.structures[0];

  return `RESEARCH PACKET

Original request:
${result.query}

LLM research synthesis:
Problem: ${result.synthesis.problem}
Research: ${result.synthesis.research}
Reference/accession rationale: ${result.synthesis.sequenceRationale}
Model plan: ${result.synthesis.modelPlan}

Medical terminology:
${result.normalized.medical}

Organism:
${result.normalized.organism}

Condition:
${result.normalized.condition}

Search terms:
${result.normalized.terms.join("; ")}

Evidence questions:
${questions}

Source plan:
${sourcePlan}
${webFindings}
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

Caveats:
${caveats}

Copyable modeling scaffold:
target_accession=${primarySequence?.accession ?? "[INSERT_VALIDATED_ACCESSION]"}
structure_file=${primaryStructure?.pdbUrl ?? primaryStructure?.cifUrl ?? "[INSERT_PUBLIC_PDB_OR_CIF_URL]"}
review_status=requires_qualified_biosafety_and_clinical_review`;
}

function cacheKey(query: string) {
  return normalizeText(query).slice(0, 240);
}

async function getRuntimeEnv(): Promise<RuntimeEnv> {
  try {
    const workers = await import("cloudflare:workers");
    return workers.env as RuntimeEnv;
  } catch {
    return {};
  }
}

async function readCachedResult(key: string) {
  try {
    const db = (await getRuntimeEnv()).DB;
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
    const db = (await getRuntimeEnv()).DB;
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
  const fallback = normalizeRequest(query);
  const terminology = await generateLlmTerminology(query, fallback);
  const normalized = terminology.normalized;
  const safety = makeSafetyAssessment(normalized);
  const [europePmc, uniProt, ncbi] = await Promise.all([
    searchEuropePmc(normalized),
    searchUniProt(normalized),
    searchNcbiProtein(normalized),
  ]);
  const sequences = sortSequencesByTargets(
    Array.from(
      new Map([...uniProt.sequences, ...ncbi.sequences].map((item) => [`${item.database}:${item.accession}`, item])).values(),
    ),
    normalized.targetGenes,
  ).slice(0, 10);
  const alphaFold = await searchAlphaFold(sequences);
  const modelRoutes = routeModels(normalized, sequences, alphaFold.structures);
  const base: ResearchBase = {
    query,
    retrievedAt: new Date().toISOString(),
    normalized,
    evidence: europePmc.evidence,
    sequences,
    structures: alphaFold.structures,
    modelRoutes,
    providerStatus: [terminology.status, europePmc.status, uniProt.status, ncbi.status, alphaFold.status],
    safety,
    cached: false,
  };
  const synthesisResult = await generateResearchSynthesis(base);
  const finalSequences = reorderSequences(base.sequences, synthesisResult.synthesis.accessionOrder);
  const finalBase: Omit<ResearchResult, "packet"> = {
    ...base,
    evidence: reorderEvidence(base.evidence, synthesisResult.synthesis.evidenceOrder),
    sequences: finalSequences,
    structures: reorderStructures(base.structures, finalSequences.map((item) => item.accession)),
    synthesis: synthesisResult.synthesis,
    providerStatus: [...base.providerStatus, synthesisResult.status],
  };

  return {
    ...finalBase,
    packet: buildPacket(finalBase),
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
