import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Pramazon cancer protein marketplace", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Pramazon<\/title>/i);
  assert.match(html, /Cancer-only protein marketplace/);
  assert.match(html, /Shop cancer proteins/);
  assert.match(html, /blood cancer for human/);
  assert.match(html, /Add to Cart|Research Cart/);
  assert.match(html, /Open research packet/);
  assert.match(html, /Europe PMC/);
  assert.match(html, /LLM protein summaries/);
  assert.match(html, /NCBI E-utilities/);
  assert.match(html, /UniProt/);
  assert.match(html, /iCn3D/);
  assert.match(html, /NVIDIA model route/);
  assert.match(html, /OpenFold3/);
  assert.match(html, /Evo 2/);
  assert.match(html, /Sequence gated/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("wires the live research pipeline and cache", async () => {
  const [page, packetPage, suppliers, css, route, schema, hosting, migration, envExample, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/packet/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/lib/supplier-links.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_quick_blockbuster.sql", import.meta.url), "utf8"),
    readFile(new URL("../.env.example", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /fetch\("\/api\/research"/);
  assert.match(page, /refresh = true/);
  assert.match(page, /cache:\s*"no-store"/);
  assert.match(page, /Pramazon/);
  assert.match(page, /Cancer proteins/);
  assert.match(page, /Add to research cart/);
  assert.match(page, /Open research packet/);
  assert.match(page, /openPacketPage/);
  assert.match(page, /localStorage\.setItem/);
  assert.match(page, /\/packet\?run=/);
  assert.match(page, /proteinSummaryFor/);
  assert.match(page, /What it does/);
  assert.match(page, /Why useful/);
  assert.match(page, /displayedSequences/);
  assert.match(page, /sortSequencesWithStructuresFirst/);
  assert.match(page, /3D structure/);
  assert.match(page, /Exact paper/);
  assert.match(page, /paper-link/);
  assert.match(page, /No public PDB\/CIF file returned/);
  assert.match(page, /LLM terminology/);
  assert.match(page, /rules fallback/);
  assert.match(page, /LLM synthesis/);
  assert.match(page, /ncbi\.nlm\.nih\.gov\/Structure\/icn3d/);
  assert.match(page, /set background transparent; style proteins cartoon; color #ff5a00/);
  assert.match(page, /iCn3D live structure/);
  assert.match(page, /No public 3D structure returned/);
  assert.match(page, /setSelectedAccession/);
  assert.match(page, /Sequence gated/);
  assert.doesNotMatch(page, /molecule-fallback/);
  assert.doesNotMatch(page, /target-surface|ligand-cloud|helix-spin/);
  assert.doesNotMatch(page, /proteinPrice/);
  assert.doesNotMatch(page, /className="price"/);
  assert.match(route, /isCancerResearchQuery/);
  assert.match(route, /Pramazon is cancer-only/);
  assert.match(route, /LLM research planner/);
  assert.match(route, /LLM research synthesis/);
  assert.match(route, /proteinSummaries/);
  assert.match(route, /sortSequencesWithStructuresFirst/);
  assert.match(route, /biologicalRole/);
  assert.match(route, /cancerUsefulness/);
  assert.match(route, /OPENAI_API_KEY/);
  assert.match(route, /\/responses/);
  assert.match(route, /web_search/);
  assert.match(route, /json_schema/);
  assert.match(route, /searchQueries/);
  assert.match(route, /evidenceQuestions/);
  assert.match(route, /sourcePlan/);
  assert.match(route, /blood cancer/);
  assert.match(route, /leukemia/);
  assert.match(route, /hematologic malignancy/);
  assert.doesNotMatch(route, /canonical:\s*"malignant neoplasm"/);
  assert.match(route, /Europe PMC/);
  assert.match(route, /eutils\.ncbi\.nlm\.nih\.gov/);
  assert.match(route, /rest\.uniprot\.org/);
  assert.match(route, /alphafold\.ebi\.ac\.uk/);
  assert.match(route, /WITHHELD_BY_RESEARCH_SAFETY_GATE/);
  assert.match(route, /OpenFold3/);
  assert.match(packetPage, /Combined research packet/);
  assert.match(packetPage, /supplierLinksForSequence/);
  assert.match(packetPage, /Company catalog searches/);
  assert.match(packetPage, /Exact paper/);
  assert.match(packetPage, /research catalog searches, not clinical purchase/);
  assert.match(suppliers, /Thermo Fisher protein search/);
  assert.match(suppliers, /MilliporeSigma product search/);
  assert.match(suppliers, /Abcam recombinant protein search/);
  assert.match(suppliers, /MedChemExpress compound search/);
  assert.match(suppliers, /Selleckchem inhibitor search/);
  assert.match(css, /grid-template-columns:\s*150px minmax\(0, 1fr\) 92px/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.match(css, /packet-shell/);
  assert.match(schema, /researchRuns/);
  assert.match(hosting, /"d1":\s*"DB"/);
  assert.match(migration, /CREATE TABLE `research_runs`/);
  assert.match(envExample, /OPENAI_API_KEY=/);
  assert.match(envExample, /OPENAI_MODEL=gpt-5-mini/);
  assert.match(envExample, /OPENAI_ENABLE_WEB_SEARCH=true/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});
