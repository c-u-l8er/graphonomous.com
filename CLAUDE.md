# graphonomous.com — Marketing Site

Marketing and documentation site for Graphonomous.

## THE LANDING PAGE IS GENERATED. DO NOT EDIT `index.html`.

**As of 2026-08-16 this site has a build step.** It did not before, and the two
lines that said so in this file were the first thing every agent read.

```
records/*.json  →  build-site.mjs  →  index.html + memory.js + contact.js
                                     + build-stamp.json
                        ↑
                   check.mjs re-derives every derivable figure against the
                   engine checkout, the npm registry and the release assets
```

- Edit `src/landing.html`, `src/shell.css`, `src/memory.js`, `src/contact.js`,
  or `records/*.json`.
- `index.html`, `memory.js`, `contact.js` and `build-stamp.json` at the repo root are
  **artifacts**. A direct edit to any of them is silently overwritten by the
  next build — and `launch-gate.mjs` refuses an artifact that does not hash to
  what the build emitted, so a hand edit does not survive to the next build
  either. See `stamp.mjs`.
- `demo/`, `benchmarks/` and `old_scrap/` are **not** generated and were not
  touched by that pass. They are hand-written and are not covered by the rung
  the landing page publishes.

```
npm run build        # regenerate the artifacts
npm run check        # re-derive the record from the world (needs network)
npm run check -- --offline
npm run test:launch  # build + check + publication gate — the gated script
node prove-gate.mjs  # break every gate on purpose in /tmp; each break names the
                     # check that must fire, and refusing for a DIFFERENT reason
                     # fails the run
```

**Set the Cloudflare Pages build command to `npm run test:launch`, never
`npm run build`** — a plain build deploys an unproven artifact. `test:launch` is
what re-proves it before Cloudflare is allowed to serve it.

## No number may be typed onto this site

Every figure on the landing page is emitted from `records/witness.json`, and
each entry there names the command that produced it and the commit it was
produced at. The template asks for a fact by id; if the id has no witness the
build stops. Record *prose* uses `[[fact_id]]` for the same reason.

This exists because the page it replaced published `455 tests` and `29 actions`
in the present tense — the suite reports 577 and the machine modules declare 31
— and because it advertised `macOS or Linux` as an install requirement when
three of the four release assets return 404.

`launch-gate.mjs` reads the **artifact**, not the source, and refuses on any of
162 checks. `records/surface.json.retracted` is a blocklist: a removed claim
may appear **exactly once**, inside the retraction paragraph that quotes it,
and **nowhere** in markup, an attribute or a comment. **The bound is a
constant in `launch-gate.mjs`, not a record field** — a record may lower the
ceiling or raise the floor, never the reverse, because a bound the author can
edit is not a bound (SHELL.md r10).

Five things the gate does that are easy to undo by accident:

- **It proves the artifact came from this build** (`stamp.mjs`). If
  `build-site.mjs` throws, the previous `index.html` is still on disk; before
  this existed, the gate approved it.
- **The animation's guards are checked by SHAPE, not substring.** The
  hidden-tab guard has to *be* the first statement of the render loop.
  Substring-testing `document.hidden` passes even after the guard is deleted,
  because the identifier also appears in the `visibilitychange` listener.
- **It resolves the cascade** — `!important`, specificity, source order,
  inheritance, `@media` at every breakpoint the stylesheet declares, and the
  hover state as well as the resting one. Declared token pairs all clearing
  4.5:1 says nothing about which declaration wins on a real element; `.top nav
  a` (0,2,1) beat `.btn` (0,1,0) and the header CTA painted `--fg2` on `--acc`
  at 1.70:1 on nine surfaces.
- **It refuses to let a record grade its own homework.** A retraction ceiling,
  a `min`/`max`, a review gate's `evidence` — anywhere both sides of a
  comparison are the author's, the constant lives in the gate and the evidence
  has to resolve to something `check.mjs` re-derives. Where no anchor exists
  at all (`nav_breakpoint_px`, `ink_box_headroom_px`) the check says so in its
  own output rather than implying more than it has.
- **The order of the three text-extraction passes is load-bearing.**
  `<[^>]+>` stops at the first `>`, so a comment containing one is only half
  removed and its tail becomes "page text". Comments come out FIRST, as their
  own pass. `prove-gate.mjs` carries a soundness probe for this — the one
  mutation the gate must *not* object to.

The shell (band, rung chip, status block, CTA/rung table, §8 animation) is
specified in `ProjectAmp2/agents/SHELL.md`. This surface is built against
revision **`shell-r10`**, recorded as `shell_revision` in `records/surface.json`,
and the build refuses to emit against any other revision. **`launch-gate.mjs`
checks that this sentence and the record agree** — this line said `shell-r7`
while the record said `shell-r9`, which is the same drift the whole surface is
built to prevent, sitting in the file every agent reads first.

Four shell values are the **surface's own** and are recorded rather than
copied: `nav_breakpoint_px` (600, BISECTED in a browser —
an arithmetic estimate got it wrong, and then a five-character nav-label
change invalidated it; re-bisect after touching any nav label), `rung_witness` (which gate
witnesses the claimed rung), `cited_specs` (empty; this page cites no §N in
visible text), and `ink_box_headroom_px` — r7's second item, which the gate
**cannot** check because it has no font engine, so it is a recorded
measurement rather than an enforced law.

## Do not edit `amp-nav.js` from here

It is fanned out to ~26 repos by `ampersand-nav/sync-nav.sh` and is owned by
that repo alone. The landing page keeps the `<amp-nav property="graphonomous">`
mount point and the gate checks it survives.

## Source-of-truth spec

The Graphonomous spec lives in the **codebase**, not in this marketing site:

- `../graphonomous/docs/spec/README.md` — technical specification
- `../AmpersandBoxDesign/prompts/GRAPHONOMOUS_PROMPT.md` — traversal prompt

`graphonomous/` is the actual codebase (Elixir/OTP engine, MCP server, npm
package). All spec, code and implementation work belongs there, not here.
`check.mjs` reads it at `../graphonomous` and skips those checks, loudly, if it
is not present.
