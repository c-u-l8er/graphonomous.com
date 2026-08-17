# graphonomous.com — Agent Interface

This is the **marketing site** for Graphonomous. The MCP server and agent
interface live in `../graphonomous/`.

## Read `CLAUDE.md` in this directory first

**The landing page is generated.** `index.html` and `memory.js` at the repo root
are artifacts of `build-site.mjs`; editing either directly is silently reverted
by the next build. Edit `src/` and `records/` instead. This directory carried
"static site with no build process" until 2026-08-16 and it is no longer true.

## For agents looking for the product

Do not look for tools or specs here. Use the codebase instead:

- **MCP tools:** `../graphonomous/` (Elixir/OTP engine, 5 loop-phase machines)
- **Agent instructions:** `../graphonomous/AGENTS.md`
- **Skills pack:** `../graphonomous/docs/skills/SKILLS.md`
- **Spec:** `../graphonomous/docs/spec/README.md`

## Before publishing anything from here

```
npm run test:launch   # build + re-derive + publication gate
node prove-gate.mjs   # 29 deliberate breaks, all must be refused
```

No claim on the landing page may be typed by hand. Add it to
`records/witness.json` with the command that produced it, or it does not ship.
