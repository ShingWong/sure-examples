// Turn chatbot/schema.sql into the form renderer the browser loads.
//
// This is the sure-factor half of the chatbot's settings and key forms: the
// DDL decides the fields, labels, help text, controls and CSS classes. The
// browser side (public/index.html) only fills the generated spec with values
// and wires the callbacks. Run `npm run generate` after editing schema.sql.
//
// esbuild strips the TypeScript annotations from the generated module. It is a
// build-time devDependency only — the output is a dependency-free ES module.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { transform } from 'esbuild'
import { generateClientComponent, introspectSchemaFromDdl } from 'sure-factor'

const here = new URL('../', import.meta.url)
const ddl = readFileSync(fileURLToPath(new URL('schema.sql', here)), 'utf8')

const schema = introspectSchemaFromDdl(ddl)
const result = generateClientComponent(schema, {
  tier: 'production',
  component: 'form',
  exportName: 'ChatbotForm',
})

const { code } = await transform(result.module, {
  loader: 'ts',
  format: 'esm',
  target: ['chrome110', 'firefox115', 'safari16'],
})

const out = new URL('public/generated/', here)
mkdirSync(fileURLToPath(out), { recursive: true })
writeFileSync(fileURLToPath(new URL('form.js', out)), code)
writeFileSync(fileURLToPath(new URL('fields.json', out)), JSON.stringify(result.fields, null, 2) + '\n')

console.log(`Generated ${result.fields.length} fields from schema.sql:`)
for (const field of result.fields) {
  console.log(`  ${field.name.padEnd(13)} ${field.control.padEnd(8)} ${field.source?.table}`)
}
console.log('Wrote public/generated/form.js and public/generated/fields.json')
