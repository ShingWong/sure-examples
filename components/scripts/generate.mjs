// Step 1 — turn the database table into a component.
//
// This is the only file you write to make a form appear. It reads schema.sql
// and writes two files into components/. Run it with `npm run generate`.
//
//     node scripts/generate.mjs
//
// After it runs you will have:
//   components/form.ts       — code that draws a real, validated form
//   components/fields.json   — the same field list, as data, for a server
//
// Both are checked in. Re-run this script only when the schema changes.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { introspectSchemaFromDdl, generateClientComponent } from "@shing.wong/sure-factor";

const here = new URL("../", import.meta.url);
const ddl = readFileSync(fileURLToPath(new URL("schema.sql", here)), "utf8");

// 1. Read the tables. sure-factor understands CREATE TABLE, so no database
//    connection and no ORM is involved.
const schema = introspectSchemaFromDdl(ddl);
console.log(`Found ${schema.tables.length} tables:`);
for (const table of schema.tables) {
  console.log(`  ${table.tableName} (${table.columns.length} columns)`);
}

// 2. Match each column against the type catalog. This is where `email VARCHAR(255)`
//    becomes "an email, max 254 characters, trimmed and lowercased, with this
//    help text" — decisions come from the catalog, not from us.
const result = generateClientComponent(schema, {
  tier: "production",
  component: "form",       // which catalog template to follow
  exportName: "SubscriberForm",
});

console.log(`\nGenerated a form with ${result.fields.length} fields:`);
for (const field of result.fields) {
  const marks = [];
  if (field.required) marks.push("required");
  if (field.validation.maxLength) marks.push(`max ${field.validation.maxLength}`);
  if (field.readOnly) marks.push("read-only");
  console.log(`  ${field.name.padEnd(14)} ${String(field.type).padEnd(10)} ${marks.join(", ")}`);
}

// 3. Write the two files.
writeFileSync(fileURLToPath(new URL("form.ts", here)), result.module);
writeFileSync(
  fileURLToPath(new URL("fields.json", here)),
  JSON.stringify(result.fields, null, 2) + "\n",
);
console.log("\nWrote form.ts and fields.json");