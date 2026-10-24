// schema.sql → components/ — the only step that touches the form.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { introspectSchemaFromDdl, generateClientComponent } from "@shing.wong/sure-factor";

const here = new URL("../", import.meta.url);
const ddl = readFileSync(fileURLToPath(new URL("schema.sql", here)), "utf8");
const schema = introspectSchemaFromDdl(ddl);

const result = generateClientComponent(schema, {
  tier: "production",
  component: "form",
  exportName: "PolicyIntakeForm",
});

const outDir = new URL("components/", here);
mkdirSync(outDir, { recursive: true });
writeFileSync(fileURLToPath(new URL("form.ts", outDir)), result.module);
writeFileSync(
  fileURLToPath(new URL("fields.json", outDir)),
  JSON.stringify({ fields: result.fields }, null, 2) + "\n",
);

const groups = [...new Set(result.fields.map((f) => f.group).filter(Boolean))];
console.log(`${schema.tables[0].tableName}: ${schema.tables[0].columns.length} columns`);
console.log(`groups: ${groups.join(" · ")}`);
console.log(`fields without a group: ${result.fields.filter((f) => !f.group).length}`);
