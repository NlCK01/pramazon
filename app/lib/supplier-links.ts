import type { NormalizedRequest, SequenceCandidate } from "./research-types";

export type SupplierLink = {
  label: string;
  category: "Protein" | "Compound";
  href: string;
  note: string;
};

function cleanQueryPart(value: string | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function supplierQuery(sequence: SequenceCandidate, normalized: NormalizedRequest, mode: "protein" | "compound") {
  const gene = cleanQueryPart(sequence.genes[0]) || sequence.accession;
  const condition = cleanQueryPart(normalized.condition);
  const organism = cleanQueryPart(sequence.organism || normalized.organism);

  if (mode === "compound") {
    return `${gene} inhibitor ${condition} cancer research compound`;
  }

  return `${gene} recombinant protein ${organism}`;
}

export function supplierLinksForSequence(
  sequence: SequenceCandidate,
  normalized: NormalizedRequest,
): SupplierLink[] {
  const proteinQuery = supplierQuery(sequence, normalized, "protein");
  const compoundQuery = supplierQuery(sequence, normalized, "compound");
  const sigmaTerm = encodeURIComponent(proteinQuery);

  return [
    {
      label: "Thermo Fisher protein search",
      category: "Protein",
      href: `https://www.thermofisher.com/search/results?keyword=${encodeURIComponent(proteinQuery)}`,
      note: "Searches research-grade proteins, antibodies, and related reagents.",
    },
    {
      label: "MilliporeSigma product search",
      category: "Protein",
      href: `https://www.sigmaaldrich.com/US/en/search/${sigmaTerm}?focus=products&page=1&perpage=30&sort=relevance&term=${sigmaTerm}&type=product`,
      note: "Searches Merck/MilliporeSigma research products for this accession target.",
    },
    {
      label: "Abcam recombinant protein search",
      category: "Protein",
      href: `https://www.abcam.com/en-us/search?keywords=${encodeURIComponent(proteinQuery)}`,
      note: "Searches recombinant proteins and target reagents.",
    },
    {
      label: "MedChemExpress compound search",
      category: "Compound",
      href: `https://www.medchemexpress.com/search.html?q=${encodeURIComponent(compoundQuery)}`,
      note: "Searches research compounds related to the target pathway.",
    },
    {
      label: "Selleckchem inhibitor search",
      category: "Compound",
      href: `https://www.selleckchem.com/search.html?q=${encodeURIComponent(compoundQuery)}`,
      note: "Searches inhibitor and compound catalogs for the target.",
    },
  ];
}
