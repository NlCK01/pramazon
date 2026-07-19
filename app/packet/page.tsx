"use client";

import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";
import type { EvidenceItem, ProteinResearchSummary, ResearchResult, SequenceCandidate } from "../lib/research-types";
import { supplierLinksForSequence } from "../lib/supplier-links";

const PACKET_STORAGE_PREFIX = "pramazon:packet:";
const PACKET_MISSING = "__PRAMAZON_PACKET_MISSING__";
const PACKET_LOADING = "__PRAMAZON_PACKET_LOADING__";

type StoredPacket = {
  result: ResearchResult;
  selectedAccessions: string[];
  createdAt: string;
};

function subscribePacketStore(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function packetSnapshot() {
  if (typeof window === "undefined") return PACKET_LOADING;
  const runId = new URLSearchParams(window.location.search).get("run");
  if (!runId) return PACKET_MISSING;
  return localStorage.getItem(`${PACKET_STORAGE_PREFIX}${runId}`) ?? PACKET_MISSING;
}

function evidenceForSummary(
  summary: ProteinResearchSummary,
  result: ResearchResult,
  index: number,
): EvidenceItem | null {
  const normalizedPaper = summary.paper.toLowerCase();
  return (
    result.evidence.find((item) => item.id === summary.evidenceId) ??
    result.evidence.find((item) => normalizedPaper.includes(item.title.toLowerCase())) ??
    result.evidence[index % Math.max(result.evidence.length, 1)] ??
    null
  );
}

function summaryForSequence(
  sequence: SequenceCandidate,
  result: ResearchResult,
  index: number,
): ProteinResearchSummary {
  const summary = result.synthesis.proteinSummaries.find(
    (item) => item.accession === sequence.accession,
  );
  if (summary) return summary;

  const evidence = result.evidence[index % Math.max(result.evidence.length, 1)];
  const genes = sequence.genes.join(", ") || sequence.accession;
  return {
    accession: sequence.accession,
    evidenceId: evidence?.id,
    paper: evidence ? `${evidence.title} (${evidence.year})` : "No retrieved paper was linked yet.",
    biologicalRole: `${sequence.label} is a public ${sequence.database} record for ${genes} in ${sequence.organism}.`,
    cancerUsefulness: evidence
      ? `The AI selected it because the retrieved evidence discusses ${result.normalized.condition} and this accession maps to ${genes}.`
      : "The AI selected it as a public accession lead, but the evidence is sparse and needs review.",
  };
}

export default function PacketPage() {
  const snapshot = useSyncExternalStore(subscribePacketStore, packetSnapshot, () => PACKET_LOADING);
  const stored = useMemo(() => {
    if (snapshot === PACKET_LOADING || snapshot === PACKET_MISSING) return null;
    try {
      return JSON.parse(snapshot) as StoredPacket;
    } catch {
      return null;
    }
  }, [snapshot]);

  const missing = useMemo(() => {
    if (snapshot === PACKET_MISSING) return true;
    if (snapshot === PACKET_LOADING) return false;
    try {
      JSON.parse(snapshot);
      return false;
    } catch {
      return true;
    }
  }, [snapshot]);

  const selectedProteins = useMemo(() => {
    if (!stored) return [];
    const selected = new Set(stored.selectedAccessions);
    return stored.result.sequences.filter((item) => selected.has(item.accession));
  }, [stored]);

  if (missing) {
    return (
      <main className="packet-shell">
        <section className="packet-empty">
          <h1>Research packet unavailable</h1>
          <p>Open a packet from the Pramazon research cart after running a cancer protein search.</p>
          <Link href="/">Back to Pramazon</Link>
        </section>
      </main>
    );
  }

  if (!stored) {
    return (
      <main className="packet-shell">
        <section className="packet-empty">
          <h1>Loading research packet</h1>
        </section>
      </main>
    );
  }

  const { result } = stored;

  return (
    <main className="packet-shell">
      <header className="packet-header">
        <Link className="packet-brand" href="/">
          Pramazon
        </Link>
        <div>
          <p className="section-kicker">Combined research packet</p>
          <h1>{result.normalized.condition}</h1>
          <p>{result.synthesis.problem}</p>
        </div>
        <span>{new Date(stored.createdAt).toLocaleString()}</span>
      </header>

      <section className="packet-summary">
        <article>
          <h2>Problem</h2>
          <p>{result.normalized.medical}</p>
        </article>
        <article>
          <h2>Research</h2>
          <p>{result.synthesis.research}</p>
        </article>
        <article>
          <h2>Supplier Search Rule</h2>
          <p>
            Each company link is generated from the selected accession target, organism, and
            cancer condition. These are research catalog searches, not clinical purchase
            instructions.
          </p>
        </article>
      </section>

      <section className="packet-list" aria-label="Selected protein and compound searches">
        {selectedProteins.map((sequence, index) => {
          const summary = summaryForSequence(sequence, result, index);
          const evidence = evidenceForSummary(summary, result, index);
          const links = supplierLinksForSequence(sequence, result.normalized);
          return (
            <article className="packet-protein" key={`${sequence.database}-${sequence.accession}`}>
              <div className="packet-protein-title">
                <div>
                  <span>{sequence.accession}</span>
                  <h2>{sequence.label}</h2>
                  <p>
                    {sequence.database} / {sequence.organism} / {sequence.length ?? "n/a"} aa
                  </p>
                </div>
                <a href={sequence.href}>Open accession</a>
              </div>

              <div className="packet-protein-grid">
                <section>
                  <h3>What it does</h3>
                  <p>{summary.biologicalRole}</p>
                </section>
                <section>
                  <h3>Why useful</h3>
                  <p>{summary.cancerUsefulness}</p>
                </section>
                <section>
                  <h3>Exact paper</h3>
                  {evidence ? (
                    <a className="packet-paper" href={evidence.href}>
                      <strong>{evidence.title}</strong>
                      <span>
                        {evidence.source} / {evidence.year} / {evidence.signal}
                      </span>
                    </a>
                  ) : (
                    <p>{summary.paper}</p>
                  )}
                </section>
              </div>

              <section className="supplier-panel">
                <h3>Company catalog searches</h3>
                <div className="supplier-grid">
                  {links.map((link) => (
                    <a href={link.href} key={link.label}>
                      <span>{link.category}</span>
                      <strong>{link.label}</strong>
                      <small>{link.note}</small>
                    </a>
                  ))}
                </div>
              </section>
            </article>
          );
        })}
      </section>

      <section className="packet-raw">
        <h2>Copyable research packet</h2>
        <pre>{result.packet}</pre>
      </section>
    </main>
  );
}
