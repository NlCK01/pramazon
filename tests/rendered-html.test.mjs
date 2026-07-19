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
  assert.match(html, /Veterinary genomics research console/);
  assert.match(html, /canine malignant melanoma/);
  assert.match(html, /NVIDIA model route/);
  assert.match(html, /OpenFold3/);
  assert.match(html, /Evo 2/);
  assert.match(html, /WITHHELD_BY_RESEARCH_SAFETY_GATE/);
  assert.doesNotMatch(html, /Your site is taking shape|react-loading-skeleton/);
  assert.doesNotMatch(html, /codex-preview/);
});

test("keeps the finished site free of starter preview wiring", async () => {
  const [page, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /normalizeRequest/);
  assert.match(page, /Sequence gated/);
  assert.match(layout, /title:\s*"Helix Triage"/);
  assert.doesNotMatch(page, /SkeletonPreview|_sites-preview/);
  assert.doesNotMatch(layout, /Starter Project|codex-preview|next\/font/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  await assert.rejects(
    access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)),
  );
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});
