// The committed form.ts is what the example ships, and the whole point of the
// example is that it is *generated*. If it drifts from what the generator
// produces, the reader is looking at code sure-factor would never emit, and the
// bug passes every browser test — they all ran against the stale file.
//
//     npm test
//
// This compares the committed file against a fresh generation. It needs no
// browser, so it runs first and fails loudly rather than 8/8 green on a lie.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const committed = here("../form.ts");

test("the committed form.ts is what the generator produces", async () => {
  const before = await readFile(committed, "utf8");

  await run(process.execPath, [here("../scripts/generate.mjs")], { cwd: here("..") });
  const fresh = await readFile(committed, "utf8");

  // Leave the tree as we found it, whichever way this goes.
  await writeFile(committed, before);

  if (before !== fresh) {
    // Show the first divergence rather than dumping two 1000-line files.
    const a = before.split("\n");
    const b = fresh.split("\n");
    const at = a.findIndex((line, i) => line !== b[i]);
    assert.fail(
      `form.ts is out of date with sure-factor — run \`npm run generate\` and commit the result.\n` +
        `  committed, line ${at + 1}: ${a[at] ?? "(end of file)"}\n` +
        `  generated, line ${at + 1}: ${b[at] ?? "(end of file)"}`,
    );
  }
});

test("the generated sanitiser applies the catalog's steps", async () => {
  // The bug this guards: the emitted sanitizeForm trimmed and returned, so
  // stripControl never ran and a control character passed through an email
  // field. Its doc comment promised otherwise, which is why a source-reading
  // test missed it.
  const source = await readFile(committed, "utf8");
  assert.match(source, /function applyStep\(/, "the emitted module has no step runner");
  assert.match(source, /case 'stripControl'/, "stripControl is not implemented");

  // A parameterised step must arrive in the call form. Written as a YAML
  // mapping it parses to an object, and the generator flattens it to `name:
  // arg` — which sanitize() ignored until sure-factor #14.
  const spec = /"sanitize":\s*\[[^\]]*\]/.exec(source)?.[0] ?? "";
  assert.ok(
    /normalize\(NFKC\)/.test(spec),
    `expected normalize(NFKC) in the spec, got: ${spec}`,
  );
});

test("a control character does not survive sanitisation", async () => {
  // The behavioural version of the check above: run the real function.
  //
  // Compiled from the committed source rather than loaded from dist/, because a
  // stale bundle is exactly what this file exists to catch — reading it back
  // would test the thing under suspicion.
  const before = await readFile(committed, "utf8");
  await run(process.execPath, [here("../scripts/generate.mjs")], { cwd: here("..") });
  const source = await readFile(committed, "utf8");
  await writeFile(committed, before);

  const { build } = await import("esbuild");
  const bundle = await build({
    stdin: { contents: source, loader: "ts", resolveDir: here(".."), sourcefile: "form.ts" },
    bundle: true,
    format: "esm",
    write: false,
  });
  const mod = await import(
    `data:text/javascript,${encodeURIComponent(bundle.outputFiles[0].text)}`
  );

  const fields = JSON.parse(await readFile(here("../fields.json"), "utf8"));
  const list = Array.isArray(fields) ? fields : fields.default ?? fields;

  const email = list.find((f) => f.type === "email" || /email/.test(f.name));
  assert.ok(email, "the example has no email field to check");

  const spec = {
    id: "t",
    title: "T",
    fields: [email].map((f) => ({
      ...f,
      hints: f.hints ?? {},
      sanitize: f.sanitize ?? ["trim"],
      validation: f.validation ?? {},
    })),
  };

  const dirty = "  ada@example.com\u0000\u0007  ";
  const out = mod.sanitizeForm(spec, { [email.name]: dirty });
  assert.ok(
    !/[\u0000-\u001f]/.test(out[email.name]),
    `a control character survived sanitisation: ${JSON.stringify(out[email.name])}`,
  );
  assert.equal(out[email.name], "ada@example.com");
});
