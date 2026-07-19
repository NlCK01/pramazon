export type EvidenceSignal = "Clinical" | "Review" | "Preclinical" | "Model";

export type ConfidenceLevel = "high" | "medium" | "low";

export type EvidenceItem = {
  id: string;
  title: string;
  year: string;
  kind: string;
  finding: string;
  href: string;
  source: string;
  signal: EvidenceSignal;
  score: number;
};

export type ModelFit = "Primary" | "Support" | "Deferred";

export type RoutedModel = {
  name: string;
  role: string;
  fit: ModelFit;
  note: string;
  endpoint?: string;
};

export type SequenceCandidate = {
  accession: string;
  database: "UniProt" | "NCBI Protein" | "NCBI Gene";
  label: string;
  organism: string;
  genes: string[];
  length?: number;
  reviewed?: boolean;
  href: string;
  structureHref?: string;
};

export type StructureCandidate = {
  accession: string;
  label: string;
  source: "AlphaFold DB" | "PDB" | "OpenFold3 scaffold";
  href: string;
  pdbUrl?: string;
  cifUrl?: string;
  confidence?: string;
};

export type ProviderStatus = {
  provider: string;
  state: "ok" | "empty" | "error";
  detail: string;
};

export type NormalizedRequest = {
  plain: string;
  medical: string;
  organism: string;
  speciesCommon: string;
  condition: string;
  diseaseGroup: string;
  intent: string;
  confidence: ConfidenceLevel;
  terms: string[];
  targetGenes: string[];
  searchQueries: string[];
  taxonomyId?: string;
  needsClarification: boolean;
  terminologySource: "llm" | "rules";
  llmModel?: string;
};

export type SafetyAssessment = {
  gate: "reference_only" | "research_summary";
  label: string;
  reason: string;
  allowedOutputs: string[];
  blockedOutputs: string[];
};

export type ResearchResult = {
  query: string;
  retrievedAt: string;
  normalized: NormalizedRequest;
  evidence: EvidenceItem[];
  sequences: SequenceCandidate[];
  structures: StructureCandidate[];
  modelRoutes: RoutedModel[];
  providerStatus: ProviderStatus[];
  safety: SafetyAssessment;
  packet: string;
  cached: boolean;
};
