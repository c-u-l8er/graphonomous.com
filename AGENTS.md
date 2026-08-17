# graphonomous.com — Agent Interface

This is the **marketing site** for Graphonomous. The MCP server and agent
interface live in `../graphonomous/`.

## Read `CLAUDE.md` in this directory first

**The landing page is generated.** `index.html`, `memory.js`, `contact.js` and
`build-stamp.json` at the repo root are artifacts of `build-site.mjs`; editing
any of them directly is silently reverted by the next build — and the gate now
refuses an artifact that was edited after its build, so a hand edit does not
even reach the next build. Edit `src/` and `records/` instead. This directory
carried "static site with no build process" until 2026-08-16 and it is no
longer true.

## For agents looking for the product

Do not look for tools or specs here. Use the codebase instead:

- **MCP tools:** `../graphonomous/` (Elixir/OTP engine, 5 loop-phase machines)
- **Agent instructions:** `../graphonomous/AGENTS.md`
- **Skills pack:** `../graphonomous/docs/skills/SKILLS.md`
- **Spec:** `../graphonomous/docs/spec/README.md`

## Before publishing anything from here

```
npm run test:launch   # build + re-derive + publication gate (144 checks)
node prove-gate.mjs   # 53 deliberate breaks, each of which must be refused BY
                      # THE CHECK written for it, plus 1 soundness probe the
                      # gate must NOT object to
```

No claim on the landing page may be typed by hand. Add it to
`records/witness.json` with the command that produced it, or it does not ship.

Corrections come in through the form in `#say`, which posts to the Formspree
endpoint recorded in `records/surface.json.contact` (Travis's ruling,
2026-08-17). It is a real `<form>` and submits with scripting off; `contact.js`
only upgrades it to an inline reply. There is still no `mailto:` anywhere and
the gate refuses one.
