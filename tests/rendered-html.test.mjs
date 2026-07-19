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

test("server-renders the Helix Triage research console", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Helix Triage<\/title>/i);
  assert.match(html, /Live veterinary genomics research console/);
  assert.match(html, /Run live research/);
  assert.match(html, /Europe PMC/);
  assert.match(html, /NCBI E-utilities/);
  assert.match(html, /UniProt/);
  assert.match(html, /NVIDIA model route/);
  assert.match(html, /OpenFold3/);
  assert.match(html, /Evo 2/);
  assert.match(html, /Sequence gated/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("wires the live research pipeline and cache", async () => {
  const [page, route, schema, hosting, migration, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/research/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0000_quick_blockbuster.sql", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /fetch\("\/api\/research"/);
  assert.match(page, /ngl@2\.3\.0/);
  assert.match(page, /Sequence gated/);
  assert.match(route, /Europe PMC/);
  assert.match(route, /eutils\.ncbi\.nlm\.nih\.gov/);
  assert.match(route, /rest\.uniprot\.org/);
  assert.match(route, /alphafold\.ebi\.ac\.uk/);
  assert.match(route, /WITHHELD_BY_RESEARCH_SAFETY_GATE/);
  assert.match(route, /OpenFold3/);
  assert.match(schema, /researchRuns/);
  assert.match(hosting, /"d1":\s*"DB"/);
  assert.match(migration, /CREATE TABLE `research_runs`/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});
