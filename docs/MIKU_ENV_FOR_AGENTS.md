# Writing `.miku-env` files (agent instructions)

A short, practical spec for any agent that needs to **read or write** Miku environment
files. Everything here is derived from the actual parser in `src/lib/envParser.ts`.

## 1. What it is

A `.miku-env` file is a **plain `.env` file with an optional metadata header**. It is
text, line-based, and safe to generate or patch with ordinary file edits. Miku's Env
Editor renders it as a table of key/value rows.

If you can write a `.env`, you can write a `.miku-env`.

## 2. Naming

- Canonical extension: **`.miku-env`** (`.mikuenv` also parses, but workspace file
  listing only picks up `.miku-env` — use it).
- The name in front is free-form and is how users tell files apart:
  `production.miku-env`, `development.miku-env`, `ci-config.miku-env`.
- Detection is by filename suffix, or by the magic first line if there's no extension.

## 3. Minimal file

```
#!miku-env
#@version: 1.0

DATABASE_URL=postgres://localhost:5432/app
PORT=3000
```

That's the whole contract: magic line, metadata, **blank line**, then `KEY=VALUE` pairs.

The header is optional — a file with no `#!miku-env` line is parsed as a plain `.env`.
But when Miku saves the file it always writes the header back, so include it.

## 4. Header rules

- `#!miku-env` **must be the very first line.** Not after a comment, not after a blank
  line. If it isn't first, the whole file is treated as a plain `.env` and metadata is lost.
- Metadata lines use `#@key: value` and only these keys are read:

  | Directive | Meaning |
  |---|---|
  | `#@version: 1.0` | Format version (currently always `1.0`) |
  | `#@name: ...` | Display name |
  | `#@description: ...` | One-line description |
  | `#@created: ...` | ISO timestamp |
  | `#@updated: ...` | ISO timestamp |

  Any other `#@` directive is ignored, not an error.
- **End the header with a blank line.** The header block ends at the first line that is
  blank or doesn't start with `#`. Comments placed directly after the metadata with no
  blank line get swallowed into the header and thrown away.

## 5. Variables

```
KEY=value
```

- One pair per line. The first `=` splits key from value, so values may contain `=`.
- **No spaces around `=`.** `KEY = value` produces the value `" value"` with a leading
  space, because only the line as a whole is trimmed.
- Quotes: a value wrapped in matching `"` or `'` has them stripped.
- Escapes: if the value contains a backslash, `\n`, `\t`, `\r`, and `\\` are decoded.
- Lines without an `=` are silently skipped.

## 6. Comments and groups

```
## Database
# Primary connection string
DATABASE_URL=postgres://localhost:5432/app

## Feature flags
ENABLE_BETA=true
```

- `# text` on the line **directly above** a variable becomes that variable's comment
  (shown as a hint in the editor). A blank line between them clears it.
- `## text` starts a **group**. Every variable after it belongs to that group until the
  next `##`. There is no way to leave a group, so put ungrouped variables above the
  first `##`.
- There are **no inline comments.** `PORT=3000 # web` stores the value
  `3000 # web`. Put comments on their own line.

## 7. Things the format does NOT do

- **No multi-line values.** Use `\n` escapes inside a quoted value instead.
- **No variable expansion.** `API_KEY=${secrets.API_KEY}` is stored verbatim as that
  literal string; substitution is the job of whatever consumes the file (CI, a runtime).
  That's the intended way to reference secrets you don't want in the repo.
- **No secret flag in the file.** Miku masks values whose *key* matches
  `secret`, `password`, `passwd`, `key`, `token`, `auth`, `credential`, `private`,
  `api_key`, `apikey`, `access_token` (case-insensitive). Masking is display-only —
  it does not encrypt anything. Never put a real secret in a committed `.miku-env`.

## 8. Round-trip warning (important when patching)

When a user edits the file in Miku it is re-serialized from the parsed model, not
preserved byte-for-byte. Expect:

- Header rewritten in canonical order, followed by one blank line.
- Variables regrouped under their `## group` headings, in order.
- Values re-quoted if they contain a space, newline, `"`, or `#`.
- **Decorative comment lines are not preserved as decoration.** A separator like
  `# ===================` is read as the next variable's comment and comes back attached
  to it. Use `## Group Name` headings for structure instead of ASCII rules.

So: don't rely on exact formatting surviving a user edit, and prefer regenerating the
file over surgical whitespace edits.

## 9. Template to copy

```
#!miku-env
#@version: 1.0
#@name: Production
#@description: Runtime config for the production build

## Core
# Deployment environment
APP_ENV=production
LOG_LEVEL=error

## Database
DATABASE_URL=postgres://db.internal:5432/app
DATABASE_POOL_SIZE=20

## Secrets (injected by CI, never committed)
API_KEY=${secrets.API_KEY}
STRIPE_SECRET_KEY=${secrets.STRIPE_SECRET_KEY}
```

## 10. Programmatic use

From TypeScript, import from `src/lib/envParser.ts`:

- `parseMikuEnvFile(content)` → `{ version, metadata, variables }`
- `parseEnvFile(content)` → `EnvVariable[]` (plain `.env`)
- `parseAutoDetect(content)` → `EnvVariable[]`, sniffs `.miku-env` / JSON / `.env`
- `serializeToMikuEnv(doc)` → canonical `.miku-env` string
- `exportVariables(vars, 'env' | 'json' | 'yaml')` → export in another format
- `isLikelySecret(key)` → whether a key would be masked

Working examples live in `test-workspace/*.miku-env`.
