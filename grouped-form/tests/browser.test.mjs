// Geometry, not markup: the point of a grouped form is that fields line up.
// Every assertion below measures real boxes in a real browser — a section that
// renders but misaligns would pass a markup test and still be unusable.
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const dist = new URL("../dist/", import.meta.url);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

let server, browser, page, base;
const consoleErrors = [];

before(async () => {
  server = createServer(async (req, res) => {
    const name = (req.url ?? "/").split("?")[0] === "/" ? "index.html" : req.url.slice(1);
    try {
      const body = await readFile(fileURLToPath(new URL(name, dist)));
      res.writeHead(200, { "content-type": TYPES[name.slice(name.lastIndexOf("."))] ?? "text/plain" });
      res.end(body);
    } catch {
      res.writeHead(404).end("not found");
    }
  });
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text()));
  page.on("pageerror", (e) => consoleErrors.push(e.message));
  await page.goto(base);
  await page.waitForSelector(".sure-form__group");
});

after(async () => {
  await browser?.close();
  server?.close();
});

const boxes = (selector) =>
  page.evaluate((sel) =>
    Array.from(document.querySelectorAll(sel)).map((el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left), width: Math.round(r.width), right: Math.round(r.right) };
    }), selector);

test("the schema's groups become sections, in declaration order", async () => {
  const groups = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".sure-form__group")).map((el) => el.dataset.group));
  assert.deepEqual(groups, ["applicant", "coverage", "billing", "additional"]);
  const headings = await page.locator(".sure-form__group > .sure-form__title").allTextContents();
  assert.deepEqual(headings, ["Applicant", "Coverage", "Billing", "Additional"]);
});

test("each field sits in the section its column declares", async () => {
  for (const [group, field] of [
    ["applicant", "full_name"],
    ["coverage", "coverage_type"],
    ["billing", "payment_method"],
    ["additional", "notes"],
  ]) {
    const inside = await page.locator(`[data-group="${group}"] [data-field="${field}"]`).count();
    assert.equal(inside, 1, `${field} must live in ${group}`);
  }
});

test("fields in one row share a control line (horizontal alignment)", async () => {
  const inputs = await boxes('[data-group="applicant"] .sure-form__input');
  assert.equal(inputs.length, 4);
  // All four are in one row: same top and same height.
  assert.equal(new Set(inputs.map((box) => box.top)).size, 1, "controls must share one top");
  assert.equal(new Set(inputs.map((box) => box.width)).size, 1, "columns must be equal width");
});

test("labels and controls share their rows even when a label wraps", async () => {
  // "Coverage amount (total limit of liability)" wraps in a 3-column section;
  // its control must still line up with its neighbours in that row (subgrid),
  // and a follow-on row must start below the tallest label of the row above.
  const rows = await page.evaluate(() => {
    const section = document.querySelector('[data-group="coverage"]');
    const fields = Array.from(section.querySelectorAll(".sure-form__field"));
    return fields.map((field) => ({
      label: field.querySelector("label").textContent.trim(),
      labelTop: Math.round(field.querySelector("label").getBoundingClientRect().top),
      controlTop: Math.round(field.querySelector("input, select").getBoundingClientRect().top),
      labelHeight: Math.round(field.querySelector("label").getBoundingClientRect().height),
    }));
  });

  const byLabelTop = new Map();
  for (const row of rows) {
    if (!byLabelTop.has(row.labelTop)) byLabelTop.set(row.labelTop, []);
    byLabelTop.get(row.labelTop).push(row);
  }
  assert.equal(byLabelTop.size, 2, "coverage has five fields in two rows");

  for (const [labelTop, row] of byLabelTop) {
    const controlTops = new Set(row.map((field) => field.controlTop));
    assert.equal(controlTops.size, 1, `controls in the row at y=${labelTop} must share one line`);
  }

  const long = rows.find((row) => row.label.startsWith("Coverage amount"));
  assert.ok(long.labelHeight > 20, "the long label should actually wrap for this test to mean anything");
  const longRow = byLabelTop.get(long.labelTop);
  assert.equal(new Set(longRow.map((f) => f.controlTop)).size, 1, "a wrapped label must not push its control out of line");
});

test("a field can span columns without breaking its row", async () => {
  // Both sections are three columns; the additional-insureds field claims two.
  const single = (await boxes('[data-group="coverage"] .sure-form__field'))[0];
  const span = (await boxes('[data-group="additional"] [data-field="additional_insureds"]'))[0];
  const full = (await boxes('[data-group="additional"] [data-field="notes"]'))[0];
  assert.ok(single && span && full);
  assert.ok(span.width > single.width * 1.8, `two columns (${span.width}) should be about twice one (${single.width})`);
  assert.ok(full.width > single.width * 2.8, `three columns (${full.width}) should span the section`);
});

test("an error appears without shifting the rows below", async () => {
  // Compare row pitch inside one section: absolute positions move when a
  // section above shrinks, but the distance between this section's rows must
  // not — that is the reserved message line doing its job.
  const pitch = async () => {
    const tops = (await boxes('[data-group="coverage"] .sure-form__input')).map((box) => box.top);
    return [...new Set(tops)].sort((a, b) => a - b);
  };
  const before = await pitch();
  await page.locator("button[type=submit]").click();
  await page.waitForSelector(".sure-form__error", { timeout: 5000 });
  const after = await pitch();

  assert.equal(after.length, before.length, "same number of layout rows");
  assert.deepEqual(
    after.map((top, i) => top - before[i]),
    before.map(() => after[0] - before[0]),
    "every row moves by the same amount — an error must not push a row down",
  );
});

test("below the breakpoint the grid collapses to one column", async () => {
  await page.setViewportSize({ width: 420, height: 1000 });
  await page.waitForTimeout(150);
  const inputs = await boxes('.sure-form__input');
  const lefts = new Set(inputs.map((box) => box.left));
  assert.equal(lefts.size, 1, `expected a single column, saw ${lefts.size}`);
});

test("the page runs without a console error", async () => {
  assert.deepEqual(consoleErrors, []);
});
