/* ==========================================================================
   graphonomous.com site build.

   The page is GENERATED from the frozen records in records/, never hand
   written. Every figure it prints comes out of records/witness.json, where
   measure.mjs wrote it by calling derive.mjs, and check.mjs re-derives each
   derivable one against the sibling checkouts with that same module. This
   build refuses to emit anything if a template asks for a figure that has no
   witness, or if a witnessed figure reaches no page.

   That direction of dependency is the whole point (SHELL.md §4.1). The page
   before this one carried "455 tests" and "29 actions" in the present tense
   while the suite reported 577 and the modules declared 31 — neither number
   was wrong when it was typed, both were wrong by the time anyone read them,
   and nothing in the site could notice, because the page WAS the source.

   Output goes to the repository root, because that is what the domain serves
   today. Do not change that without confirming the Pages output directory.
   ========================================================================== */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildId, inputHashes, writeStamp } from "./stamp.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const J = (p) => JSON.parse(read(p));

const surface = J("./records/surface.json");
const witness = J("./records/witness.json");
const pkg = J("./package.json");

const RUNGS = ["spec", "in_tree", "live_local", "live_deployed", "external"];

/* ---------- release identity: one version, or no build ---------- */
if (pkg.version !== surface.version) {
    throw new Error(`release identity: package.json ${pkg.version} != records/surface.json ${surface.version}`);
}
if (surface.shell_revision !== "shell-r10") {
    throw new Error(`BUILD REFUSED — records/surface.json declares shell_revision ${surface.shell_revision}; this build emits shell-r10 markup.`);
}
const BUILD = buildId(inputHashes(DIR));
const STAMP = `GRAPHONOMOUS.COM v${surface.version} · SHELL ${surface.shell_revision} · RECORDS ${surface.verified_at} · BUILD ${BUILD}`;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ==========================================================================
   THE FIGURE GATE — a template may not print a number. It asks for a
   witnessed fact by id, and if that id is not in records/witness.json the
   build stops. There is no path through this file by which a hand-typed
   figure reaches the artifact.
   ========================================================================== */
const used = new Set();
function f(id) {
    const fact = witness.facts[id];
    if (!fact) throw new Error(`BUILD REFUSED — no witness for figure "${id}". Add it to records/witness.json with the command that produced it.`);
    used.add(id);
    return fact.value;
}
/* Prose inside a record is still prose, and a figure typed into it is still a
   hand-typed figure. So the records write `[[tests_total]]` and this resolves it. */
const fig = (s) => String(s).replace(/\[\[(\w+)\]\]/g, (m, id) => f(id));

/* ==========================================================================
   SHELL FRAGMENTS — shared markup, copied verbatim between surfaces.
   ========================================================================== */
function rung(value) {
    const r = RUNGS.includes(value) ? value : "?";
    return `<span class="rung" data-rung="${r}" title="spec · in_tree · live_local · live_deployed · external">${r}</span>`;
}
function band() {
    if (![1, 2, 3, 4].includes(surface.tier)) throw new Error(`BUILD REFUSED — records/surface.json declares no tier, so the band cannot know what it may claim.`);
    if (surface.tier === 3) throw new Error(`BUILD REFUSED — tier 3 is the specification variant of the band: amp-nav renders "${surface.surface} is a specification in the ${surface.parent} world" plus a link to the spec, NOT a layer sentence. records/surface.json names no spec URL, so that band cannot be written from this record. SHELL.md r6.`);
    const where = surface.tier === 4 ? `A <b>${esc(surface.parent)}</b> project` : `${esc(surface.surface)} is the <b>${esc(surface.layer)}</b> layer of ${esc(surface.parent)}`;
    return `<div class="band" data-tier="${surface.tier}"><span class="where">${where}</span>${rung(surface.surface_rung)}<span class="covers">That rung covers ${esc(surface.surface_rung_covers)}.</span></div>`;
}
function statusBlock() {
    const s = surface.status;
    return `<dl class="status">
<div><dt>Status</dt><dd><strong>${esc(surface.surface_rung)}</strong> — ${esc(fig(s.statement))}</dd></div>
<div><dt>Last verified</dt><dd>${esc(surface.verified_at)}</dd></div>
<div><dt>Source</dt><dd>${esc(fig(s.source))}</dd></div>
<div class="limit"><dt>Limit</dt><dd>${esc(fig(s.limit))}</dd></div>
<div><dt>Next rung</dt><dd><strong>${esc(surface.advance.next_rung)}</strong> — ${esc(fig(surface.advance.requires))}</dd></div>
</dl>`;
}
const VERBS = {
    spec: ["Read", "Challenge", "Implement"],
    in_tree: ["Inspect the source", "Run the tests"],
    live_local: ["Use it", "Reproduce it locally"],
    live_deployed: ["Use the deployed artifact"],
    external: ["See independent evidence", "Contribute another result"],
};
function cta(groupRung, label, actions) {
    const allowed = VERBS[groupRung];
    if (!allowed) throw new Error(`CTA group declares an unknown rung: ${groupRung}`);
    for (const a of actions) if (!allowed.includes(a.verb)) throw new Error(`BUILD REFUSED — CTA "${a.verb}" is not available at rung ${groupRung}. Allowed: ${allowed.join(", ")}`);
    const cls = groupRung === "spec" ? "tag" : "tag ok";
    return `<div class="ctagroup"><div class="${cls}">${esc(groupRung)} &mdash; ${esc(label)}</div><div class="cta">${actions
        .map((a) => `<a href="${a.href}"${a.href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}><span class="verb">${esc(a.verb)}</span><span class="what">${a.what}</span></a>`).join("")}</div></div>`;
}

/* ==========================================================================
   GENERATED CONTENT — every figure below is a witnessed fact by id, and every
   table row comes from a witness table that check.mjs re-derives whole.
   ========================================================================== */
function plate() {
    const cells = [
        [`${f("tests_pass")} of ${f("tests_total")}`, "Tests passing"],
        [f("worlds_sealed"), "Projections sealed by WRL"],
        [`${f("static_rows")} of ${f("profile_rows")}`, "WRL profile rows, ours"],
        [f("pinned_sources"), "Repositories pinned"],
        [f("nodes"), "Nodes, largest world"],
        [f("relations"), "Relations, largest world"],
    ];
    return `<div class="grid plate">${cells.map(([n, l]) => `<div><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`).join("")}</div>`;
}

/* The pipeline: six stages, one button each, one panel each. The artifact
   column of every panel is the LARGEST world's own ids, read from the worlds
   table, so a panel never carries an id that the check does not re-derive. */
function pipeline() {
    const big = witness.worlds.rows.find((w) => w.name === witness.faults.world);
    if (!big) throw new Error(`BUILD REFUSED — the worlds table has no row for ${witness.faults.world}`);
    if (String(big.nodes) !== f("nodes") || String(big.relations) !== f("relations")) {
        throw new Error(`BUILD REFUSED — the worlds table says ${big.name} has ${big.nodes} nodes / ${big.relations} relations but witness.facts says ${f("nodes")} / ${f("relations")}.`);
    }
    const art = { root: ["projection root", big.root], sem: ["world id, minted by WRL", big.sem], vclaim: ["verified claim, minted through TRVM", big.vclaim] };
    const btns = surface.pipeline.map((s) => `<button class="stage" type="button" data-stage="${s.id}" aria-pressed="false"><span class="k">${esc(s.n)}</span><span class="t">${esc(s.title)}</span><span class="q">${esc(s.q)}</span></button>`).join("");
    const panels = surface.pipeline.map((s) => {
        const [artLabel, artVal] = art[s.art];
        return `<div data-stage="${s.id}"><div><h3><span>${esc(s.n)}</span>${esc(s.title)} — ${esc(s.q)}</h3><p>${esc(fig(s.what))}</p></div>` +
            `<div class="side"><b>Tool</b>${esc(s.tool)}<b>Refuses with</b><span class="x">${esc(s.refusal)}</span><b>${esc(artLabel)}, ${esc(big.name)}</b><span class="v">${esc(artVal)}</span></div></div>`;
    }).join("");
    return `<div class="stages">${btns}</div><div class="panels">${panels}</div>`;
}

/* Worlds: SVG bars. Width is a fraction of the largest value in the column,
   which makes the drawing a comparison and not a figure — the figure is the
   number beside it, and that one has a witness row. */
function worlds() {
    const rows = witness.worlds.rows;
    const max = (k) => Math.max(...rows.map((r) => Number(r[k]) || 0));
    const bar = (cls, v, k) => `<svg class="${cls}" viewBox="0 0 100 9" preserveAspectRatio="none" aria-hidden="true"><rect width="${((Number(v) / max(k)) * 100).toFixed(1)}" height="9"/></svg>`;
    return `<div class="worlds">${rows.map((r) =>
        `<div class="wrow"><div><div class="name">${esc(r.name)}</div><span class="prof">${esc(r.profile)} · ${esc(r.adapters.join(" + "))}</span></div>` +
        `<div class="bars">${bar("n", r.nodes, "nodes")}${bar("r", r.relations, "relations")}${bar("f", r.faults, "faults")}</div>` +
        `<div class="nums"><span class="v">${esc(r.nodes)}</span> nodes<br><span class="v">${esc(r.relations)}</span> relations<br><span class="v">${esc(r.faults)}</span> faults · <span class="v">${esc(r.findings)}</span> findings</div>` +
        `<div class="ids"><b>sem</b> ${esc(r.sem)}<br><b>root</b> ${esc(r.root)}<br><b>vclaim</b> ${esc(r.vclaim)}</div></div>`).join("")}</div>` +
        `<div class="legend"><span class="n"><i></i>nodes</span><span class="r"><i></i>relations</span><span class="f"><i></i>typed faults</span></div>`;
}

function faults() {
    const rows = witness.faults.rows;
    const max = Math.max(...rows.map((r) => r.count));
    const sum = rows.reduce((n, r) => n + r.count, 0);
    if (String(sum) !== f("faults")) throw new Error(`BUILD REFUSED — the fault codes sum to ${sum} but witness.facts.faults says ${f("faults")}.`);
    return `<div class="faults">${rows.map((r) => `<div class="frow"><span class="c">${esc(r.code)}</span><svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect width="${((r.count / max) * 100).toFixed(1)}" height="8"/></svg><span class="v">${r.count}</span></div>`).join("")}</div>`;
}

function refusals() {
    const rows = witness.refusals.rows;
    const btns = rows.map((r, i) => `<button class="rbtn" type="button" data-r="${i}" aria-pressed="false">${esc(r.edit)}</button>`).join("");
    const panels = rows.map((r, i) => `<div data-r="${i}"><div class="edit">edit · <b>${esc(r.shown)}</b></div><div class="code">${esc(r.code)}</div><p class="msg">${esc(r.message)}</p></div>`).join("");
    const worldJson = JSON.stringify(witness.refusals.world, null, 1);
    return `<div class="rgrid"><div><div class="rbtns">${btns}</div><div class="rpanels">${panels}</div></div>` +
        `<div class="pre"><code><i># the world every edit is made to — seals to</i>\n<i># ${esc(witness.refusals.world_sem)}</i>\n${esc(worldJson)}</code></div></div>`;
}

function sources() {
    const rows = witness.sources.rows;
    if (String(rows.length) !== f("pinned_sources")) throw new Error(`BUILD REFUSED — the sources table has ${rows.length} rows but witness.facts.pinned_sources says ${f("pinned_sources")}.`);
    const why = {
        super: "Super (CD): its README and the ampd runtime's README are authoritative sources, and the crosswalk's evidence records cite Super's release receipts. Read at this commit and held to it; no runtime coupling in either direction.",
        "trvm-gov": "TRVM governance: the invariant grid, its receipts and spec releases — the third source family.",
        trvm: "TRVM's evidence view, pinned separately from its governance tree; the consistency pass says why the two differ.",
        r10: "The invariant frontier package and its handoffs.",
        factory: "The invariant factory ledger, mosaic and receipts.",
        computedriven: "The ComputeDriven edge stack: admission, authority and locus.",
        wrl: "WallRiderLang's spine, pinned so the seal itself is a pinned dependency.",
    };
    return `<div class="srcs">${rows.map((r) => `<div class="src${r.namespace === "super" ? " hi" : ""}" data-source="${esc(r.namespace)}"><div class="ns">${esc(r.namespace)}</div><div class="cm">${esc(r.commit)}</div><div class="fl">${r.files} file${r.files === 1 ? "" : "s"} pinned by blob</div>${why[r.namespace] ? `<div class="why">${esc(why[r.namespace])}</div>` : ""}</div>`).join("")}</div>`;
}

function gates() {
    return `<dl class="status">${Object.entries(surface.gates).filter(([k]) => !k.startsWith("_")).map(([, g]) => {
        const tag = g.status === "approved" ? "tag ok" : "tag";
        const detail = g.status === "approved"
            ? `${esc(fig(g.description))} <strong>Evidence:</strong> <code>${esc(g.evidence)}</code>. <strong>Reviewer:</strong> ${esc(g.reviewer)}. <strong>Date:</strong> ${esc(g.date)}.`
            : esc(fig(g.description));
        return `<div><dt>${esc(g.label)}</dt><dd><span class="${tag}">${esc(g.status)}</span> ${detail}</dd></div>`;
    }).join("")}</dl>`;
}

/* The retraction paragraph is the ONE place the retracted strings may appear.
   The publication gate refuses any other occurrence of them in the artifact,
   which makes the retraction structural rather than a promise. SHELL.md §4.2. */
function retraction() {
    const items = surface.retracted.map((r) => `<li><code>${esc(r.string)}</code> &mdash; ${esc(fig(r.why))}</li>`).join("");
    return `<div class="retract" data-retraction><h3>Retraction &mdash; ${surface.retracted.length} claims removed from this page</h3>
<p>Two pages came before this one. The first was ${Math.round(witness.routes.rows[0].bytes / 1024)}&nbsp;KB and stated most of its figures in the present tense with nothing behind them. The second was generated and gated, and described an earlier Graphonomous &mdash; an MCP memory engine &mdash; whose page is now kept under <code>old_scrap/</code> and not served. These came off:</p>
<ul>${items}</ul>
<p>The fix is structural rather than careful. This page is generated: every figure on it is emitted from <code>records/witness.json</code>, each entry names the command that produced it, and <code>launch-gate.mjs</code> refuses to publish an artifact that reinstates any string above outside this paragraph. A number can no longer be typed onto this site by hand.</p></div>`;
}

function say() {
    const c = surface.contact;
    if (c.kind !== "formspree" || !/^https:\/\/formspree\.io\/f\/\w+$/.test(c.endpoint || "")) {
        throw new Error(`BUILD REFUSED — records/surface.json.contact declares kind "${c.kind}" with endpoint "${c.endpoint}". The correction form posts to a Formspree endpoint read from the record; it is not typed into the template.`);
    }
    return `<form class="say" action="${esc(c.endpoint)}" method="POST" novalidate>
<div class="say-row">
<label class="say-f"><span>Your email</span><input type="email" name="email" autocomplete="email" placeholder="so a reply can reach you" required></label>
<label class="say-f"><span>Message</span><textarea name="message" rows="3" placeholder="a question, a correction, a number of ours you think is wrong" required></textarea></label>
</div>
<input type="text" name="_gotcha" tabindex="-1" autocomplete="off" aria-hidden="true">
<div class="say-act"><button type="submit" class="btn">Send</button><p class="say-msg" role="status" aria-live="polite"></p></div>
</form>`;
}

/* ==========================================================================
   EMIT
   ========================================================================== */
const CSS = read("./src/shell.css").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\n\s*/g, "").replace(/;\}/g, "}").trim();
const dense = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "").replace(/^[ \t]+/gm, "").replace(/[ \t]+$/gm, "").replace(/\n{2,}/g, "\n").trim();
const ANIM = dense("./src/memory.js");
const SAYJS = dense("./src/contact.js");
const INSPECT = dense("./src/inspect.js");
const YEAR = new Date(surface.verified_at).getUTCFullYear();

const landing = fill(read("./src/landing.html"), {
    CSS, BAND: band(), STAMP, ORIGIN: surface.origin, REPO: surface.repo, CONTACT: surface.contact.url,
    QUESTION: esc(surface.question), YEAR: String(YEAR),
    DEFINITION: esc(surface.definition), BOUNDARY: esc(surface.boundary),
    DEMO: surface.demo, README_URL: surface.repo + surface.readme_path, PROFILES_URL: surface.profiles_url,
    PLATE: plate(), PIPELINE: pipeline(), WORLDS: worlds(), FAULTS: faults(), REFUSALS: refusals(), SOURCES: sources(),
    FINDINGS: esc(f("findings")), FAULTS_N: esc(f("faults")), ADAPTERS: esc(f("adapters")), SUPER_PIN: esc(f("super_pin")),
    ROLES: esc(f("roles")), KINDS: esc(f("kinds")), PAIRS: esc(f("pairs")), WORLDS_N: esc(f("worlds_sealed")),
    STATUS: statusBlock(), GATES: gates(), RETRACTION: retraction(), SAY: say(), ISSUES: surface.contact.issues,
    CTA: cta("in_tree", "in the tree, tested, unpublished", [
        { verb: "Inspect the source", href: surface.repo + surface.readme_path,
          what: `<code>v2/</code> in the repository: the adapters, the projector, the WRL world builder, the TRVM certificate. <code>handoff/STATUS.md</code> is the only file that says what is DESIGNED, IMPLEMENTED, TESTED or FROZEN, and <code>handoff/DECISION_LOG.md</code> is every decision with its alternatives.` },
        { verb: "Run the tests", href: surface.repo + surface.readme_path,
          what: `<code>cd v2 &amp;&amp; npm run test:full-tree</code> in a checkout with the pinned sibling registries beside it. Expect ${esc(f("tests_pass"))} of ${esc(f("tests_total"))}, ${esc(f("tests_skipped"))} skipped by design. A different number is the most useful thing anyone could send us.` },
    ]),
});

function fill(tpl, vars) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => { if (!(k in vars)) throw new Error(`template token {{${k}}} has no value`); return vars[k]; });
}

const unused = Object.keys(witness.facts).filter((k) => !used.has(k));
if (unused.length) throw new Error(`BUILD REFUSED — witnessed but never printed: ${unused.join(", ")}. A measured fact that reaches no page is a fact nobody will re-measure, and it rots. Print it or delete it.`);

const ANIM_OUT = ANIM + "\n", SAY_OUT = SAYJS + "\n", INSPECT_OUT = INSPECT + "\n";
writeFileSync(new URL("./index.html", import.meta.url), landing);
writeFileSync(new URL("./memory.js", import.meta.url), ANIM_OUT);
writeFileSync(new URL("./contact.js", import.meta.url), SAY_OUT);
writeFileSync(new URL("./inspect.js", import.meta.url), INSPECT_OUT);
const stamp = writeStamp(DIR, { "index.html": landing, "memory.js": ANIM_OUT, "contact.js": SAY_OUT, "inspect.js": INSPECT_OUT });

console.log(`figure gate: ${used.size} of ${Object.keys(witness.facts).length} witnessed facts printed, 0 hand-typed`);
console.log(`build stamp: ${stamp.build_id} over ${Object.keys(stamp.inputs).length} source files`);
console.log(`wrote index.html  ${landing.length.toLocaleString()} bytes  (was ${witness.routes.rows[0].bytes.toLocaleString()})`);
console.log(`wrote memory.js   ${ANIM.length.toLocaleString()} bytes  (decoration; the page's content does not depend on it)`);
console.log(`wrote contact.js  ${SAYJS.length.toLocaleString()} bytes  (upgrade only; the form posts without it)`);
console.log(`wrote inspect.js  ${INSPECT.length.toLocaleString()} bytes  (which panel is in front; the page reads the same without it)`);
