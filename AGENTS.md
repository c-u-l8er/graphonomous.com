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

- **The lane this page describes:** `../graphonomous/v2/` — read `handoff/STATUS.md` first
- **Its spec:** `../graphonomous/v2/handoff/G0_G1_SPEC.md`; decisions in `handoff/DECISION_LOG.md`
- **The earlier MCP memory engine** (not described here): `../graphonomous/` root, `docs/spec/README.md`

## Before publishing anything from here

```
npm run test:launch   # build + re-derive + publication gate (171 checks)
node prove-gate.mjs   # 59 deliberate breaks, each of which must be refused BY
                      # THE CHECK written for it, plus 1 soundness probe the
                      # gate must NOT object to
```

No claim on the landing page may be typed by hand. `node measure.mjs` derives every
figure and table into `records/witness.json`; a figure that is not derived does not ship.

Corrections come in through the form in `#say`, which posts to the Formspree
endpoint recorded in `records/surface.json.contact` (Travis's ruling,
2026-08-17). It is a real `<form>` and submits with scripting off; `contact.js`
only upgrades it to an inline reply. There is still no `mailto:` anywhere and
the gate refuses one.
