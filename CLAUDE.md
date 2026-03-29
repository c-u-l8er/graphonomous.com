# graphonomous.com — Marketing Site

This is the marketing and documentation site for Graphonomous. It is a static site with no build process.

## Source-of-truth spec

The Graphonomous spec lives in the **codebase**, not in this marketing site:

- `../graphonomous/docs/spec/README.md` — Graphonomous technical specification
- `../AmpersandBoxDesign/prompts/GRAPHONOMOUS_PROMPT.md` — autonomous traversal prompt

## Relationship to graphonomous/

- `graphonomous.com/` — this directory: marketing site (static HTML)
- `graphonomous/` — the actual codebase: Elixir/OTP engine, MCP server, npm package

All spec, code, and implementation work belongs in `graphonomous/`, not here.

## Status

Static marketing site. No build process.
