// Checks the example really works, in a real browser.
//
//     npm test
//
// These are the things you would otherwise only discover by opening the page
// and clicking around: does the form appear, is every field labelled, does
// submitting produce a payload, do the styles actually apply.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const dist = new URL("../dist/", import.meta.url);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

let server;
let browser;
let page;
let base;

before(async () => {
  server = createServer(async (req, res) => {
    const name = (req.url ?? "/").split("?")[0] === "/" ? "index.html" : req.url.slice(1);
    try {
      const body = await readFile(fileURLToPath(new URL(name, dist)));
      res.writeHead(200, { "content-type": TYPES[name.slice(name.lastIndexOf("."))] ?? "text/plain" });
      res.end(body);
    } catch {
      res.writeHead(404).end("no");
    }
  });
  await new Promise((r) => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch();
  page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base, { waitUntil: "networkidle" });
  page.__errors = errors;
});

after(async () => {
  await browser?.close();
  await new Promise((r) => server.close(r));
});

test("the page loads with no JavaScript errors", async () => {
  assert.deepEqual(page.__errors, []);
});

test("the generated form appears", async () => {
  assert.ok(await page.$("form.sure-form"), "no .sure-form was rendered");
});

test("every field has a label", async () => {
  const controls = await page.$$("form input, form select, form textarea");
  assert.ok(controls.length > 0, "no controls rendered");
  for (const control of controls) {
    const id = await control.getAttribute("id");
    assert.ok(id, "a control has no id");
    assert.ok(await page.$(`label[for="${id}"]`), `no label for ${id}`);
  }
});

test("a required field is marked as required", async () => {
  const required = await page.$$('form [required]');
  assert.ok(required.length > 0, "nothing was marked required");
});

test("the email field is typed and validated", async () => {
  assert.ok(await page.$("#field-email"), "no #field-email");
  assert.equal(await page.$eval("#field-email", (e) => e.getAttribute("type")), "email");

  await page.fill("#field-email", "not-an-email");
  await page.click('button[type="submit"]');
  // The page redraws after onInvalid, so re-query rather than reusing a handle.
  await page.waitForFunction(() => {
    const el = document.querySelector("#field-email");
    return el?.getAttribute("aria-invalid") === "true";
  }, { timeout: 5000 });
  const message = await page.$$eval('[role="alert"]', (els) => els.map((e) => e.textContent));
  assert.ok(message.some((m) => /invalid email/i.test(m)), `no email error shown: ${JSON.stringify(message)}`);
});

test("a valid email produces a payload", async () => {
  await page.fill("#field-email", "reader@example.com");
  await page.fill("#field-display_name", "Ada Lovelace");
  await page.fill("#field-signup_date", "10/01/2026");
  await page.fill("#field-plan", "monthly");
  await page.click('button[type="submit"]');
  await page.waitForSelector("#result:not([hidden])", { timeout: 5000 });
  const payload = JSON.parse(await page.textContent("#result"));
  assert.equal(payload.email, "reader@example.com");
  assert.equal(payload.display_name, "Ada Lovelace");
});

test("the sure-ui stylesheet is applied", async () => {
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.notEqual(bg, "rgba(0, 0, 0, 0)", "the theme CSS did not apply");
});

test("the generated classes are the catalog ones", async () => {
  const classes = await page.$$eval("form *", (els) => [...new Set(els.flatMap((e) => [...e.classList]))]);
  for (const cls of classes) {
    assert.ok(
      /^(sure-form|sure-table|btn-|area-)/.test(cls),
      `"${cls}" does not look like a sure-ui class`,
    );
  }
});