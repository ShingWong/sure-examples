// components/ + a sure-ui theme → dist/. The page owns layout knobs only:
// how many columns each section gets, and which fields span two.
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { themes } from "@shing.wong/sure-ui";

const here = new URL("../", import.meta.url);
const dist = new URL("dist/", here);
rmSync(fileURLToPath(dist), { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: [fileURLToPath(new URL("components/form.ts", here))],
  bundle: true,
  outfile: fileURLToPath(new URL("form.js", dist)),
  format: "esm",
  platform: "browser",
  target: ["chrome110", "firefox115", "safari16"],
  minify: true,
  legalComments: "none",
  logLevel: "error",
});

const themeName = process.env.THEME ?? "nord";
writeFileSync(fileURLToPath(new URL("theme.css", dist)), themes[themeName]);

// Product layout: numbers only, never field markup.
const COLUMNS = { applicant: 4, coverage: 3, billing: 2, additional: 3 };
const SPANS = { additional_insureds: 2, notes: 3 };
const manifest = JSON.parse(readFileSync(fileURLToPath(new URL("components/fields.json", here)), "utf8"));
const nameOf = (column) => manifest.fields.find((f) => f.source?.column === column)?.name;

const sectionRules = Object.entries(COLUMNS)
  .map(([group, columns]) => `[data-group="${group}"] { --sure-form-columns: ${columns}; }`)
  .join("\n");
const spanRules = Object.entries(SPANS)
  .map(([column, span]) => `[data-field="${nameOf(column) ?? column}"] { --sure-form-field-span: ${span}; }`)
  .join("\n");

const page = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Grouped form — sure-factor + sure-ui</title>
  <link rel="stylesheet" href="theme.css">
  <style>
    body { margin: 0; padding: 2rem 1rem; background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; }
    main { max-width: 64rem; margin: 0 auto; }
    .subtitle { font-size: 0.875rem; opacity: 0.75; margin: 0 0 1.5rem; }
    /* Layout knobs only. Field markup, labels, validation and colours all come
       from the generated spec and the theme. */
    .sure-form { --sure-form-max-width: none; --sure-form-columns: 1; }
    ${sectionRules}
    ${spanRules}
    #payload { margin-top: 1.5rem; }
    pre { background: rgba(127,127,127,0.12); padding: 0.75rem; border-radius: 6px; overflow-x: auto; font-size: 0.8125rem; }
  </style>
</head>
<body>
  <main>
    <h1>Policy intake</h1>
    <p class="subtitle">Four sections, grouped by the schema, aligned in one grid — ${Object.values(COLUMNS).length} column settings, no hand-written fields.</p>
    <div id="form"></div>
    <pre id="payload" hidden></pre>
  </main>
  <script type="module">
    import { renderForm, GENERATED_FIELDS } from './form.js';
    // The UUID primary key is assigned by the database, not typed here.
    const spec = { id: 'policy_intake', title: 'New policy',
      fields: GENERATED_FIELDS.filter((f) => f.source?.column !== 'id') };
    let values = {}; let errors = {};
    function draw() {
      document.getElementById('form').replaceChildren(renderForm(spec, {
        values, errors,
        submitLabel: 'Submit',
        onChange(name, value) { values = { ...values, [name]: value }; },
        onInvalid(found) { errors = found; draw(); },
        onSubmit(v) {
          const out = document.getElementById('payload');
          out.hidden = false;
          out.textContent = JSON.stringify(v, null, 2);
        },
      }));
    }
    draw();
  </script>
</body>
</html>
`;
writeFileSync(fileURLToPath(new URL("index.html", dist)), page);
console.log(`dist/index.html + form.js + theme.css (theme: ${themeName})`);
