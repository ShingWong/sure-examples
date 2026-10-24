# Grouped form — schema-defined sections, aligned grid

A form with many fields is hard because of the *layout*, not the input types.
This example shows the pattern that reduces cognitive load:

1. **Group in the schema.** Each column comment carries a `group:` line:
   ```sql
   COMMENT ON COLUMN policy_intake.deductible IS 'Deductible
   group: Coverage';
   ```
   `sure-factor` puts that on the field spec. The first comment line stays the
   label; the rest is help.
2. **Render sections, not a list.** `renderForm` emits one `<section
   class="sure-form__group" data-group="coverage">` per group, in first-appearance
   order, each with its heading; a field with no group renders before them.
3. **Align with two variables.** The page sets the numbers; the theme owns the
   mechanism — no field markup, no restyled classes:
   ```css
   [data-group="coverage"] { --sure-form-columns: 3; }
   [data-field="notes"]    { --sure-form-field-span: 3; }
   .sure-form { --sure-form-max-width: none; }
   ```

## Why it lines up both ways

The section is a grid; each field spans **three subgrid rows** — label, control,
message — so labels of different heights share a baseline and every control in a
row starts at the same `y`. The message row is always rendered (and
`min-height` reserved), and an error replaces the help text instead of stacking
with it, so nothing below moves when validation fires.

Fallbacks: browsers without `grid-template-rows: subgrid` get bottom-aligned
rows; below 48rem the grid collapses to one column.

## Run it

```bash
npm install
npm run build      # schema.sql -> components/ -> dist/
npm start          # http://localhost:8090
npm test           # geometry tests in a real browser
```

`npm test` is the interesting part: it measures boxes, not classes —
equal column widths, shared control tops per row, a wrapped label that does not
push its control out of line, a two-column field, no reflow when an error
appears, and a single column on a narrow viewport.
