# Building UI from a database table

A worked example. You write a database table. You get a working, validated,
styled form. You do not write any HTML.

This folder shows how `sure-factor` and `sure-ui` fit together:

- **sure-factor** reads your database definition and writes the code for a form
- **sure-ui** provides the styles
- your project puts them together

## Try it

You need [Node.js](https://nodejs.org) version 20 or newer. Check with:

```bash
node --version
```

Then, from this folder:

```bash
npm install
npm test
```

`npm test` builds the example and checks it in a real browser. To look at it
yourself:

```bash
npm start
```

It prints a web address. Open it. You should see a form with fields for email,
name, plan, date and notes — every one of them taken from `schema.sql`.

> **Working on the sure packages themselves?** The versions in `package.json` are
> published releases, so a change you have not released yet will not show up
> here. Point at your own copies instead:
>
> ```bash
> npm install ../../../sure-factor ../../../sure-ui
> npm test
> ```

## If you are using an AI agent

`sure-factor` ships a skill with the package, and this folder already points
OpenCode at it:

```jsonc title="opencode.json"
{
  "skills": ["./node_modules/@shing.wong/sure-factor/.opencode/skills"]
}
```

It tells an agent the things the API's type signatures do not: slice the DDL
down to the one table before introspecting it, take columns out of the schema
rather than building them by hand, read `catalog/types/<name>.yaml` instead of
loading all sixteen types, and change `schema.sql` and regenerate rather than
editing the generated `form.ts`.

Only the skill's one-line description is loaded up front; the rest arrives when
the agent decides it applies. It is plain Markdown, so you can also read it
directly, or copy it somewhere you prefer.

```bash
cat node_modules/@shing.wong/sure-factor/.opencode/skills/sure-factor/SKILL.md
```

## What just happened

The `npm test` command ran two steps. Neither required you to write any UI code.

### Step 1 — read the database

`schema.sql` describes two tables:

```sql
CREATE TABLE subscribers (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  plan VARCHAR(40) NOT NULL,
  signup_date DATE NOT NULL,
  notes TEXT
);
```

sure-factor reads that file. It is not a database connection and it is not a
tool you run against a live server — it is the same text you already keep in
your migrations.

For each column, sure-factor decides a type. It uses a **catalog**: a set of
known data types, each one describing how to recognise it and how to handle it.
The catalog is part of sure-factor and ships with it.

Running the example prints what it decided:

```
Generated a form with 6 fields:
  id             text       read-only
  email          email      required, max 254
  display_name   full-name  required, max 100
  plan           text       required
  signup_date    date-us    required, max 10
  notes          text
```

Read that as a report, not as magic. Four things came from your SQL, and you
can check each one:

| What you see | Where it came from |
|---|---|
| `email` is type `email` | the column is named `email` and the catalog has an `email` type |
| `required, max 254` | your SQL said `NOT NULL` and `VARCHAR(255)` |
| `read-only` on `id` | your SQL said `PRIMARY KEY` |
| `date-us` on `signup_date` | the column is named `signup_date` and its SQL type is `DATE` |

### Step 2 — write the form

sure-factor then writes `form.ts`, a file containing a working form. It writes
the field names, the labels, the help text, the validation rules and the CSS
class names.

**You are not meant to edit it.** It is regenerated whenever the database
changes, so edits would be lost. To change what the form does, change the
catalog rules or the SQL — then run `npm run generate` again.

## What the form can already do

You get these without asking:

- **Every field has a label.** Screen readers announce them properly.
- **Required fields are marked** with `required`, so browsers check them.
- **An email address is checked** against the pattern in the catalog. Type
  `not-an-email` and submit — you get "Invalid email address".
- **Errors are described to assistive technology**, not only coloured red.
  Each bad field is linked to its message.
- **Long input is trimmed to the column's limit**, so the browser and the
  database agree.
- **The form submits clean data.** Whitespace is removed, values are trimmed
  and capped before they leave the page.

The test file checks each of these in a real browser, not by reading the code.

## Styling it

The form uses CSS class names that come from the same catalog entry that
produced the fields — `sure-form`, `sure-form__label`, `sure-form__error` and so
on. sure-ui ships four themes that style those names.

Pick one:

```bash
THEME=dracula npm start
```

Available: `nord` (the default, pale blue), `forest` (warm cream), `dracula`
(purple dark), `dark` (near-black).

All four define the same set of colour names — `--bg`, `--text`, `--border`,
`--accent`, `--error` — so your own CSS keeps working when you switch themes:

```css
body { background: var(--bg); color: var(--text); }
```

## When the database changes

Add a column to `schema.sql`, then:

```bash
npm run generate
```

The form gains the field. Nothing else to do.

Change a column's width from `VARCHAR(100)` to `VARCHAR(200)` and the length
check changes with it. Rename a column and the form field is renamed.

## What this example does *not* show

- **No database.** The form is not connected to anything. `npm test` checks
  that the form behaves correctly; it does not save anything.
- **The catalog is opinionated.** A column called `plan` is treated as plain
  text, because no catalog type claims that name. If you want a column treated
  as a date or a phone number, name it so the catalog recognises it, or add a
  type to the catalog.
- **One table at a time.** The example shows the `subscribers` table. The
  generator also produced fields for `invitations`, and the page selects the
  ones it wants by table name.

## Where to go next

- The catalog is `catalog/types/` in the sure-factor source. Reading one file
  there is the fastest way to see everything a type can control.
- The class names come from `catalog/components/form.yaml` under `cssClasses`.
  That file is the agreement between what sure-factor generates and what sure-ui
  styles.
- A real application still needs a server: this generates the front end only.
  The management console in `positronic/management` is a complete example.