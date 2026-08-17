/* ==========================================================================
   graphonomous.com site build.

   The page is GENERATED from the frozen records in records/, never hand
   written. Every figure it prints comes out of records/witness.json, and every
   entry in that file names the command that produced it and the exact commit
   it was produced at. check.mjs re-derives the derivable ones against the real
   world — the sibling engine checkout, the npm registry, the release assets —
   and this build refuses to emit anything if a template asks for a figure that
   has no witness.

   That direction of dependency is the whole point (SHELL.md §4.1). The page
   this replaces carried "455 tests" and "29 actions" in the present tense; the
   suite reports 577 and the machine modules declare 31. Neither number was
   wrong when it was typed. Both were wrong by the time anyone read them, and
   nothing in the site could notice, because the page WAS the source.

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
    throw new Error(
        `release identity: package.json ${pkg.version} != records/surface.json ${surface.version}`
    );
}
if (surface.shell_revision !== "shell-r9") {
    throw new Error(
        `BUILD REFUSED — records/surface.json declares shell_revision ${surface.shell_revision}; this build emits shell-r9 markup.`
    );
}
/* The artifact names the sources it was generated from. A stale index.html —
   the one left behind when this file throws — carries the previous id, and
   launch-gate.mjs refuses it. SHELL.md r6, hole 2. See stamp.mjs. */
const BUILD = buildId(inputHashes(DIR));
const STAMP = `GRAPHONOMOUS.COM v${surface.version} · SHELL ${surface.shell_revision} · RECORDS ${surface.verified_at} · BUILD ${BUILD}`;

const esc = (s) =>
    String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

/* ==========================================================================
   THE FIGURE GATE
   A template may not print a number. It asks for a witnessed fact by id, and
   if that id is not in records/witness.json the build stops. There is no path
   through this file by which a hand-typed figure reaches the artifact.
   ========================================================================== */
const used = new Set();
function f(id) {
    const fact = witness.facts[id];
    if (!fact) {
        throw new Error(`BUILD REFUSED — no witness for figure "${id}". Add it to records/witness.json with the command that produced it.`);
    }
    used.add(id);
    return fact.value;
}

/* Prose inside a record is still prose, and a figure typed into it is still a
   hand-typed figure. So the records write `[[tests_total]]` and this resolves
   it — there is no string anywhere in this repository, template or record,
   into which a number can be typed and reach the artifact. */
const fig = (s) => String(s).replace(/\[\[(\w+)\]\]/g, (m, id) => f(id));

/* ==========================================================================
   SHELL FRAGMENTS — shared markup. Only the tokens in src/shell.css differ
   between surfaces; everything below TOKENS-END is copied verbatim.
   ========================================================================== */

/* The chip renders the stored rung, and "?" when there is none. It never
   defaults to a rung, because a defaulted rung is a fabricated status. */
function rung(value) {
    const r = RUNGS.includes(value) ? value : "?";
    return `<span class="rung" data-rung="${r}" title="spec · in_tree · live_local · live_deployed · external">${r}</span>`;
}

/* The band states where you are, and what it may state depends on the TIER —
   which is a record read out of amp-nav, not a choice made here. amp-nav files
   graphonomous as place 2 with layer "memory", so this is the standard band
   WITH the layer sentence. A place-4 surface would get the attribution variant
   instead; gpscoord shipped the wrong one of these for months. SHELL.md §1.

   THERE ARE THREE VARIANTS, NOT TWO (SHELL.md r6). amp-nav's renderPlacement()
   gives the layer sentence to place 1 and 2 only; place 3 renders "X is a
   specification in the ComputeDriven world" plus a link to the real spec.
   Writing a layer sentence on a place-3 surface puts the band in direct
   contradiction with the nav rendered immediately beneath it. This record
   names no spec URL, so rather than emit the wrong one of three, tier 3 is
   refused with the reason. */
function band() {
    if (![1, 2, 3, 4].includes(surface.tier)) {
        throw new Error(`BUILD REFUSED — records/surface.json declares no tier, so the band cannot know what it may claim.`);
    }
    if (surface.tier === 3) {
        throw new Error(
            `BUILD REFUSED — tier 3 is the specification variant of the band: amp-nav renders "${surface.surface} is a specification in the ${surface.parent} world" plus a link to the spec, NOT a layer sentence. records/surface.json names no spec URL, so that band cannot be written from this record. SHELL.md r6.`
        );
    }
    const where =
        surface.tier === 4
            ? `A <b>${esc(surface.parent)}</b> project`
            : `${esc(surface.surface)} is the <b>${esc(surface.layer)}</b> layer of ${esc(surface.parent)}`;
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

/* §0.7: the rung gates the call to action. Mechanical, so implemented
   mechanically — a group declares its rung and may only use verbs that rung
   has earned. Anything else throws and nothing is emitted. */
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
    for (const a of actions) {
        if (!allowed.includes(a.verb)) {
            throw new Error(
                `BUILD REFUSED — CTA "${a.verb}" is not available at rung ${groupRung}. Allowed: ${allowed.join(", ")}`
            );
        }
    }
    const cls = groupRung === "spec" ? "tag" : "tag ok";
    return `<div class="ctagroup"><div class="${cls}">${esc(groupRung)} &mdash; ${esc(label)}</div><div class="cta">${actions
        .map(
            (a) =>
                `<a href="${a.href}"${a.href.startsWith("http") ? ' target="_blank" rel="noopener"' : ""}><span class="verb">${esc(a.verb)}</span><span class="what">${a.what}</span></a>`
        )
        .join("")}</div></div>`;
}

/* ==========================================================================
   GENERATED CONTENT — every cell below reads a witnessed fact by id.
   ========================================================================== */

function plate() {
    const cells = [
        [f("machines"), "MCP machines"],
        [f("actions"), "Actions across them"],
        [f("tests_total"), `Tests, ${f("tests_failed")} failing`],
        [`${f("install_targets_ok")} of ${f("install_targets_total")}`, "Platforms that install"],
        [f("demos"), "Demos on this domain"],
    ];
    return `<div class="grid plate">${cells
        .map(([n, l]) => `<div><div class="n">${esc(n)}</div><div class="l">${esc(l)}</div></div>`)
        .join("")}</div>`;
}

/* The install block is markup, not a copy button. A control that does nothing
   is worse than no control (SHELL.md §6), and a copy button on a static page
   with no secure-context fallback is exactly that control. The command is
   selectable text. */
function install() {
    const i = surface.install;
    /* Hand-shaped rather than JSON.stringify(…,2): a client config is read, not
       parsed by eye, and eleven lines of one-key-per-line pushed the whole
       evidence section below a second fold for nothing. Still derived from the
       record — the path and the db default are not typed here. */
    const args = JSON.stringify(["-y", "graphonomous", "--db", i.db_default]);
    const cfg = `{
  "mcpServers": {
    "graphonomous": { "command": "npx", "args": ${args} }
  }
}`;
    return `<div class="pre"><code><i># 1. the published package — linux-x64 only, see the table below</i>
<b>${esc(i.npm)}</b>

<i># 2. ${esc(i.config_path)} , or your client's MCP settings</i>
${esc(cfg)}

<i># 3. restart the client. Node.js ${esc(i.node_min)} or newer; the graph is a</i>
<i># SQLite file at ${esc(i.db_default)} and does not leave the machine.</i></code></div>`;
}

function installNote() {
    const t = witness.install_targets;
    return `Requested with <code>curl</code> against <code>${esc(t.release)}</code> on ${esc(witness.measured_at)}, one request per target, asset name <code>${esc(t.asset_pattern)}</code>. The status column is the HTTP code that came back.`;
}

function installTable() {
    const rows = witness.install_targets.rows
        .map(
            (r) =>
                `<tr><td class="place">${esc(r.target)}</td><td class="${r.http === 200 ? "num" : "bad"}">${r.http}</td><td class="${r.http === 200 ? "num" : "bad"}">${esc(r.result)}</td></tr>`
        )
        .join("");
    const ok = witness.install_targets.rows.filter((r) => r.http === 200).length;
    if (String(ok) !== f("install_targets_ok")) {
        throw new Error(
            `BUILD REFUSED — the install table has ${ok} working target(s) but witness.facts.install_targets_ok says ${f("install_targets_ok")}.`
        );
    }
    if (String(witness.install_targets.rows.length) !== f("install_targets_total")) {
        throw new Error(
            `BUILD REFUSED — the install table has ${witness.install_targets.rows.length} rows but witness.facts.install_targets_total says ${f("install_targets_total")}.`
        );
    }
    return `<div class="scroll"><table><thead><tr><th>Target</th><th>HTTP</th><th>Result of <code>npm i -g graphonomous</code></th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function loop() {
    return `<div class="loop">${surface.loop
        .map(
            (p) =>
                `<div><div class="ph">${esc(p.phase)}</div><div class="q">&ldquo;${esc(p.q)}&rdquo;</div><div class="a">${esc(p.actions)}</div><div class="c">${p.actions.split("·").length} actions</div></div>`
        )
        .join("")}</div>`;
}

function gates() {
    return `<dl class="status">${Object.entries(surface.gates)
        .filter(([k]) => !k.startsWith("_"))
        .map(([, g]) => {
            const tag = g.status === "approved" ? "tag ok" : "tag";
            const detail =
                g.status === "approved"
                    ? `${esc(fig(g.description))} <strong>Evidence:</strong> <code>${esc(g.evidence)}</code>. <strong>Reviewer:</strong> ${esc(g.reviewer)}. <strong>Date:</strong> ${esc(g.date)}.`
                    : esc(fig(g.description));
            return `<div><dt>${esc(g.label)}</dt><dd><span class="${tag}">${esc(g.status)}</span> ${detail}</dd></div>`;
        })
        .join("")}</dl>`;
}

/* The retraction paragraph is the ONE place the retracted strings are allowed
   to appear — naming the wrong value is what a retraction is. The publication
   gate refuses any other occurrence of them in the artifact, which makes the
   retraction structural rather than a promise. SHELL.md §4.2. */
function retraction() {
    const items = surface.retracted
        .map((r) => `<li><code>${esc(r.string)}</code> &mdash; ${esc(fig(r.why))}</li>`)
        .join("");
    return `<div class="retract" data-retraction><h3>Retraction &mdash; ${surface.retracted.length} claims removed from this page</h3>
<p>The revision this replaces was ${Math.round(witness.routes.rows[0].bytes / 1024)}&nbsp;KB and stated most of its figures in the present tense with nothing behind them. These came off:</p>
<ul>${items}</ul>
<p>Only the first four were wrong at the time of writing; the rest were removed for want of a witness, which is a different and smaller charge. The install requirement is the one that mattered. A reader on a Mac was told the package supported their machine, typed the command, and watched the postinstall exit non-zero &mdash; and the page that sent them there was the project's best acquisition surface. <strong>A link that returns 200 can still be dead</strong>, and so can a package that resolves.</p>
<p>The fix is structural rather than careful. This page is generated: every figure on it is emitted from <code>records/witness.json</code>, each entry names the command that produced it, and <code>launch-gate.mjs</code> refuses to publish an artifact that reinstates any string above outside this paragraph. A number can no longer be typed onto this site by hand.</p></div>`;
}

/* The correction form. A REAL form — action + method, so it posts with
   scripting off — and the endpoint comes out of the record, never typed here.
   SHELL.md r9; shape copied from computedriven.com, which is the reference. */
function say() {
    const c = surface.contact;
    if (c.kind !== "formspree" || !/^https:\/\/formspree\.io\/f\/\w+$/.test(c.endpoint || "")) {
        throw new Error(
            `BUILD REFUSED — records/surface.json.contact declares kind "${c.kind}" with endpoint "${c.endpoint}". The correction form posts to a Formspree endpoint read from the record; it is not typed into the template.`
        );
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
/* The stylesheet ships stripped of comments and indentation. The source in
   src/shell.css stays commented and readable; only the artifact is dense. */
const CSS = read("./src/shell.css")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\n\s*/g, "")
    .replace(/;\}/g, "}")
    .trim();

/* The animation is emitted as its own artifact rather than inlined. Two
   reasons, and the second is the point: the landing page's markup stays
   content-only, so "the content is complete with JavaScript off" is something
   a reader can verify by deleting one line; and the animation becomes a file
   the publication gate can read constants out of and compare against the page.
   NEWLINES ARE KEPT — joining JS lines the way the CSS is joined would be a
   semicolon-insertion bug waiting to happen. */
const dense = (p) =>
    read(p)
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "")
        .replace(/^[ \t]+/gm, "")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{2,}/g, "\n")
        .trim();
const ANIM = dense("./src/memory.js");
const SAYJS = dense("./src/contact.js");

const YEAR = new Date(surface.verified_at).getUTCFullYear();

const landing = fill(read("./src/landing.html"), {
    CSS,
    BAND: band(),
    STAMP,
    ORIGIN: surface.origin,
    REPO: surface.repo,
    CONTACT: surface.contact.url,
    QUESTION: esc(surface.question),
    YEAR: String(YEAR),
    PLATE: plate(),
    INSTALL: install(),
    INSTALL_NOTE: installNote(),
    INSTALL_TABLE: installTable(),
    LOOP: loop(),
    STATUS: statusBlock(),
    GATES: gates(),
    RETRACTION: retraction(),
    SAY: say(),
    ISSUES: surface.contact.issues,
    CTA:
        cta("live_deployed", "published, and it downloads", [
            {
                verb: "Use the deployed artifact",
                href: "#install",
                what: `<code>npm i -g graphonomous</code> pulls ${esc(f("published_version"))} from the registry, published ${esc(f("published_at"))}. On linux-x64 it lands a binary and answers on stdio. On the other three targets it exits 1 — the table says which.`,
            },
        ]) +
        cta("in_tree", "readable, runnable, unpublished", [
            {
                verb: "Inspect the source",
                href: surface.repo,
                what: `The ${esc(f("machines"))} machine modules are one directory: <code>lib/graphonomous/mcp/machines/</code>. Each declares its own <code>@valid_actions</code>, and that list is what this page prints.`,
            },
            {
                verb: "Run the tests",
                href: surface.repo,
                what: `Clone, <code>mix deps.get</code>, <code>mix test</code>. Needs Elixir ${esc(f("elixir_req"))}. If you get a number other than ${esc(f("tests_total"))}, that is the most useful thing anyone could send us.`,
            },
        ]),
});

function fill(tpl, vars) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (m, k) => {
        if (!(k in vars)) throw new Error(`template token {{${k}}} has no value`);
        return vars[k];
    });
}

/* Every witnessed fact should be on the page, or it is dead weight in the
   record and will quietly rot. */
const unused = Object.keys(witness.facts).filter((k) => !used.has(k));
if (unused.length) {
    throw new Error(
        `BUILD REFUSED — witnessed but never printed: ${unused.join(", ")}. A measured fact that reaches no page is a fact nobody will re-measure, and it rots. Print it or delete it.`
    );
}

const ANIM_OUT = ANIM + "\n";
const SAY_OUT = SAYJS + "\n";
writeFileSync(new URL("./index.html", import.meta.url), landing);
writeFileSync(new URL("./memory.js", import.meta.url), ANIM_OUT);
writeFileSync(new URL("./contact.js", import.meta.url), SAY_OUT);

/* Last, and only if everything above succeeded: record what was emitted and
   what it was emitted from. If this line is never reached the stamp on disk
   still describes the PREVIOUS build, and the gate will refuse the artifact
   that survived. That is the whole point of it. */
const stamp = writeStamp(DIR, { "index.html": landing, "memory.js": ANIM_OUT, "contact.js": SAY_OUT });

console.log(`figure gate: ${used.size} of ${Object.keys(witness.facts).length} witnessed facts printed, 0 hand-typed`);
console.log(`build stamp: ${stamp.build_id} over ${Object.keys(stamp.inputs).length} source files`);
console.log(`wrote index.html  ${landing.length.toLocaleString()} bytes  (was ${witness.routes.rows[0].bytes.toLocaleString()})`);
console.log(`wrote memory.js   ${ANIM.length.toLocaleString()} bytes  (decoration; the page's content does not depend on it)`);
console.log(`wrote contact.js  ${SAYJS.length.toLocaleString()} bytes  (upgrade only; the form posts without it)`);
