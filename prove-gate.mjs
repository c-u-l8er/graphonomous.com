/* ==========================================================================
   Prove the gate can fail.  node prove-gate.mjs

   A gate nobody has seen refuse is an opinion (SHELL.md §4.3). This breaks
   each check on purpose in a THROWAWAY COPY of the repository — /tmp, never
   the working tree — runs the gate there, and reports whether it refused.

   It restores nothing, because it changes nothing: every break happens inside
   a fresh copy that is deleted at the end. If this script is interrupted the
   working tree is still clean, which is the only reason it is safe to run
   while five other lanes share the tree.

   EVERY BREAK NAMES THE CHECK IT IS FOR, and the run fails if the gate
   refused for some OTHER reason. "It refused" is not the claim worth making;
   "it refused because the check written for this defect fired" is. A break
   that trips three checks proves less than one that trips its own, and until
   this column existed there was no way to tell those apart. The `checks`
   count printed beside each result is how many refusals the break produced —
   1 is the ideal and anything higher is a smell, not a failure.

   FOUR STAGES:
     build    the BUILD must throw; nothing is emitted at all
     rebuild  the build must SUCCEED and the gate must then refuse
     gate     the artifact is mutated directly, the build-stamp's artifact
              hashes are recomputed so the freshness check stays quiet, and
              the gate must refuse for the reason the break was written for
     stale    nothing is rebuilt and nothing is re-stamped — these are the
              two breaks that exist to prove the freshness check itself
     pass     a SOUNDNESS probe, and the only stage that inverts the verdict:
              the mutation is one the gate must NOT object to, and the run
              fails if it refuses. A check that refuses everything is not a
              check, and the r8 text-extraction defect is exactly a false
              refusal — a comment containing `>` half-surviving into "page
              text" and colliding with an animation constant.
   ========================================================================== */
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";
import { artifactHashes } from "./stamp.mjs";

const SRC = path.dirname(fileURLToPath(import.meta.url));
const COPY = ["build-site.mjs", "launch-gate.mjs", "stamp.mjs", "package.json", "index.html", "memory.js", "contact.js", "inspect.js", "build-stamp.json", "CLAUDE.md"];

/* [name, stage, mutation, the check that must be the one to fire] */
const BREAKS = [
    ["a figure with no witness", "build", (d) => edit(d, "build-site.mjs", 'f("nodes")', 'f("nodes_v9")'),
     "no witness for figure"],
    ["a witnessed fact that reaches no page", "build", (d) => edit(d, "build-site.mjs", '[`${f("static_rows")} of ${f("profile_rows")}`, "WRL profile rows, ours"],', ""),
     "witnessed but never printed"],
    ["the worlds table disagreeing with the plate figure", "build", (d) => editJSON(d, "records/witness.json", (j) => { j.facts.nodes.value = "3"; }),
     "the worlds table says"],
    ["a CTA verb the rung has not earned", "build", (d) => edit(d, "build-site.mjs", 'verb: "Inspect the source"', 'verb: "Use it"'),
     "is not available at rung"],
    ["a band claiming a tier the record does not hold", "build", (d) => editJSON(d, "records/surface.json", (j) => { delete j.tier; }),
     "declares no tier"],
    ["release identity broken", "build", (d) => editJSON(d, "package.json", (j) => { j.version = "9.9.9"; }),
     "release identity:"],
    ["a shell revision the build does not emit", "build", (d) => editJSON(d, "records/surface.json", (j) => { j.shell_revision = "shell-r3"; }),
     "declares shell_revision"],
    /* SHELL.md r6: there are THREE band variants, and a place-3 surface given
       a layer sentence contradicts the nav rendered directly beneath it. */
    /* Measured, not hypothesised: this line really did drift to r7 while the
       record said r9, in the file every agent reads before touching anything. */
    ["the revision in CLAUDE.md drifting away from the record", "gate", (d) => edit(d, "CLAUDE.md", "revision **`shell-r10`**", "revision **`shell-r7`**"),
     "CLAUDE.md names the same shell revision"],
    ["a place-3 surface handed the layer sentence", "build", (d) => editJSON(d, "records/surface.json", (j) => { j.tier = 3; }),
     "tier 3 is the specification variant"],

    ["a review gate approved with no evidence", "rebuild", (d) => editJSON(d, "records/surface.json", (j) => { j.gates.independent_use.status = "approved"; }),
     "approved WITH evidence, reviewer and date"],
    ["a rung whose named witness has never been approved", "rebuild", (d) => editJSON(d, "records/surface.json", (j) => { j.rung_witness = "independent_use"; }),
     "is approved, with evidence, reviewer and date"],
    ["the nav stacking breakpoint moved without the record", "rebuild", (d) => edit(d, "src/shell.css", "@media(max-width:580px){.top{flex-direction:column", "@media(max-width:430px){.top{flex-direction:column"),
     "stacks .top at exactly that breakpoint"],
    ["a nav label changed without the breakpoint being re-measured", "gate", (d) => edit(d, "index.html", '<a href="#evidence">Evidence</a>', '<a href="#evidence">The evidence ledger</a>'),
     "the one the breakpoint was bisected against"],
    ["a §N citation that points at nothing", "gate", (d) => edit(d, "index.html", "<h2>From a pinned registry", "<h2>See §99. From a pinned registry"),
     "§99 names the spec it cites"],

    ["an unrendered {{TOKEN}} in the artifact", "gate", (d) => edit(d, "index.html", "<h2>", "<h2>{{LEFTOVER}} "),
     "no unrendered {{TOKEN}}"],
    ["a mailto: anywhere on the page", "gate", (d) => edit(d, "index.html", 'href="/demo/"', 'href="mailto:x@example.com"'),
     "advertises a mailto:"],
    ["a fabricated rung on a chip", "gate", (d) => edit(d, "index.html", 'data-rung="in_tree"', 'data-rung="shipped"'),
     "every rung is one of the five"],
    ["a chip whose text disagrees with its stored rung", "gate", (d) => edit(d, "index.html", ">in_tree</span>", ">external</span>"),
     "every chip's text equals its stored rung"],
    /* Text and attribute changed together, so ONLY the null-rung check can
       fire — a break that trips three checks proves less than one that trips
       the check it was written for. */
    ["a null rung", "gate", (d) => edit(d, "index.html", 'data-rung="in_tree" title="spec · in_tree · live_local · live_deployed · external">in_tree<', 'data-rung="null" title="spec · in_tree · live_local · live_deployed · external">null<'),
     "no empty / undefined / null rung"],
    ["the covers span removed from the band", "gate", (d) => edit(d, "index.html", 'class="covers"', 'class="gone"'),
     "the band carries a covers span"],
    ["the LIMIT row removed", "gate", (d) => edit(d, "index.html", "<dt>Limit</dt>", "<dt>Caveat</dt>"),
     "status block has the Limit row"],
    ["a plate figure with no witness", "gate", (d) => edit(d, "index.html", '<div class="n">1189</div>', '<div class="n">9001</div>'),
     'plate figure "9001" is witnessed'],
    ["a source card for a repository the snapshot never pinned", "gate", (d) => edit(d, "index.html", 'data-source="super"', 'data-source="windows"'),
     "never pinned"],
    ["a refusal code the encoder never answered", "gate", (d) => edit(d, "index.html", '<div class="code">WRL_UNDECLARED_ROLE</div>', '<div class="code">WRL_LOOKS_FINE</div>'),
     "the code WRL answered"],
    ["the panel switcher writing text into the page", "gate", (d) => edit(d, "inspect.js", "root.classList.add(\"js\");", "root.classList.add(\"js\");\nroot.textContent = \"\";"),
     "never uses textContent"],

    /* ---- the retraction, both halves of SHELL.md r6 hole 1 ---- */
    ["a retracted claim reinstated elsewhere on the page", "gate", (d) => edit(d, "index.html", "<h2>The suite is green", "<h2>Runs on macOS or Linux. The suite is green"),
     'appears nowhere outside its retraction'],
    /* r6 HOLE 1. The retraction stays, is still quoted, still names every
       string — and the claim is re-asserted INSIDE it, wearing its own
       retraction as cover. A check that asks "is the retraction present?"
       passes this. Counting does not. */
    ["a retracted claim re-asserted inside its own retraction", "gate", (d) => edit(d, "index.html", "A number can no longer be typed onto this site by hand.", "A number can no longer be typed onto this site by hand. On reflection it does run on macOS or Linux, so that one stands."),
     "is quoted between 1 and 1 times inside it"],
    /* THE AGENTELIC ATTACK, exactly as it happened there: the sentence
       appended THREE times, the claim on the artifact FOUR times, and that
       gate reported 0 refusals because it bounded by `onPage === inBlock`. */
    ["the agentelic attack — the sentence appended three times inside the retraction", "gate", (d) => edit(d, "index.html", "A number can no longer be typed onto this site by hand.", "A number can no longer be typed onto this site by hand. It does run on macOS or Linux. It does run on macOS or Linux. It does run on macOS or Linux."),
     "is quoted between 1 and 1 times inside it"],
    /* r10, AND THE REASON IT IS A RULE. The bound was a number, but the number
       lived in a record the same edit could touch. Measured before the fix:
       four occurrences plus `max_occurrences: 4` PASSED this gate. */
    ["a retraction ceiling raised by the very record it bounds", "rebuild", (d) => editJSON(d, "records/surface.json", (j) => { j.retracted[4].max_occurrences = 4; }),
     "does not raise its own ceiling"],
    ["a retraction floor lowered so the claim can vanish from its own retraction", "rebuild", (d) => editJSON(d, "records/surface.json", (j) => { j.retracted[4].min_occurrences = 0; }),
     "does not lower its own floor"],
    /* Same shape, different field: "approved WITH evidence" used to accept any
       non-empty string, so a reviewer could approve themselves in prose. */
    ["a review gate approved on evidence that resolves to nothing", "rebuild", (d) => editJSON(d, "records/surface.json", (j) => { j.gates.test_suite.evidence = "we checked it, it was fine"; }),
     "evidence resolves to something re-derivable"],
    ["the retraction paragraph deleted while the claims stay off the page", "gate", (d) => edit(d, "index.html", '<div class="retract" data-retraction>', '<div class="retracted-not-really">'),
     "the retraction paragraph is on the artifact"],

    /* ---- SHELL.md r6 hole 2: the artifact must come from THIS build ---- */
    /* The exact accident: build-site.mjs throws, yesterday's index.html is
       still on disk, and every other check in the gate reads it happily. */
    ["a source edited and the build never re-run — a stale artifact", "stale", (d) => edit(d, "src/landing.html", "<h2>From a pinned registry", "<h2>From a pinned notebook"),
     "unchanged since that build"],
    ["the artifact hand-edited after the build", "stale", (d) => edit(d, "index.html", "</footer>", "</footer> "),
     "hashes to the string the build emitted"],
    ["the build id in the artifact swapped for another", "gate", (d) => edit(d, "index.html", buildIdOf(d), "bdeadbeefcafe"),
     "carries that build id"],
    ["a forged stamp: id and artifact agree, but neither follows from the sources", "gate", (d) => { const was = buildIdOf(d); edit(d, "index.html", was, "bdeadbeefcafe"); editJSON(d, "build-stamp.json", (j) => { j.build_id = "bdeadbeefcafe"; }); },
     "derived from those same sources"],

    /* ---- SHELL.md §8, the identifying animation ---- */
    ["the identifying animation removed", "gate", (d) => edit(d, "index.html", "data-identity-animation", "data-decoration"),
     "carries a data-identity-animation element"],
    ["the animation writing into the page", "gate", (d) => edit(d, "memory.js", "var ACC =", "el.textContent = NODES;\nvar ACC ="),
     "never writes textContent"],
    ["the animation inserting its sprite into the document", "gate", (d) => edit(d, "memory.js", "return c;", "document.body.append(c);\nreturn c;"),
     "never writes append"],
    ["an animation constant published as a number", "gate", (d) => edit(d, "index.html", "<h2>From a pinned registry", "<h2>Now with 16 of them. From a pinned registry"),
     "appears as a number on the page"],
    ["prefers-reduced-motion dropped", "gate", (d) => edit(d, "memory.js", '"(prefers-reduced-motion: reduce)"', '"all"'),
     "reads prefers-reduced-motion"],
    ["the reduced-motion branch scheduling a loop anyway", "gate", (d) => edit(d, "memory.js", "settle();\ndraw(0);\nreturn;", "settle();\ndraw(0);\nrequestAnimationFrame(frame);\nreturn;"),
     "scheduling nothing"],
    /* The break that PASSED the first time this file was run: the guard is
       deleted from the render loop and `document.hidden` is left in the
       visibilitychange listener, so a substring test is still satisfied.
       Checked by shape now — the guard has to BE the loop's first statement. */
    ["the hidden-tab guard deleted from the render loop, the identifier left in the listener", "gate", (d) => edit(d, "memory.js", "if (document.hidden || offscreen) {\nrunning = false;\nreturn;\n}\n", ""),
     "FIRST statement is a document.hidden guard"],
    ["the loop started only by IntersectionObserver", "gate", (d) => edit(d, "memory.js", "tick(performance.now());\n})();", "})();"),
     "never starts it"],

    ["a contrast failure (--fg3 back to .34)", "gate", (d) => edit(d, "index.html", "--fg3:rgba(233,236,241,.55)", "--fg3:rgba(233,236,241,.34)"),
     "--fg3 on --ink clears 4.5:1"],
    /* SHELL.md r7, and the reason it needed a new KIND of check: every token
       and every declared pair is still fine here. Only the element is wrong. */
    ["the header CTA losing its colour to the nav rule (`:not(.btn)` dropped)", "gate", (d) => edit(d, "index.html", ".top nav a:not(.btn){color:var(--fg2)", ".top nav a{color:var(--fg2)"),
     "colour decided by a non-button rule"],
    ["a .btn that keeps its own colour and still cannot be read on it", "gate", (d) => edit(d, "index.html", ".btn{display:inline-block;background:var(--acc);color:#2a0413", ".btn{display:inline-block;background:var(--acc);color:#e0709b"),
     "COMPUTED colour clears 4.5:1"],
    ["an interactive element with no :hover", "gate", (d) => edit(d, "index.html", ".logo:hover{color:var(--acc)}", ""),
     "every interactive element has a visible :hover"],
    ["the focus-visible ring removed", "gate", (d) => edit(d, "index.html", ":focus-visible{outline:2px solid var(--acc);outline-offset:2px}", ""),
     "declares a focus-visible ring"],
    ["an inline style= smuggled in", "gate", (d) => edit(d, "index.html", '<div class="wrap">', '<div class="wrap" style="padding:0">'),
     "no inline style="],
    ["inline script in the artifact", "gate", (d) => edit(d, "index.html", "</body>", "<script>var x=1</script></body>"),
     "does not depend on JavaScript"],
    ["the amp-nav mount point dropped", "gate", (d) => edit(d, "index.html", '<amp-nav property="graphonomous">', "<div>"),
     "amp-nav mount point is intact"],

    /* ---- SHELL.md r8 ---- */
    /* A blocklisted claim parked in a comment is off the visible page and
       still on it. Counting visible text alone cannot see this. */
    ["a retracted claim hidden in an HTML comment", "gate", (d) => edit(d, "index.html", "</body>", "<!-- note: it does run on macOS or Linux, restore later --></body>"),
     "not hidden in markup, a comment or an attribute"],
    /* THE SOUNDNESS PROBE. `<[^>]+>` stops at the first `>`, so under the
       tag-first ordering this comment leaves " ghosts, 16 nodes -->" behind as
       page text, 16 is an animation constant, and the gate refuses a page that
       published nothing. Comments come out first, so it must PASS. */
    ["a comment containing `>` and an animation constant — the gate must NOT object", "pass", (d) => edit(d, "index.html", "</body>", "<!-- layout note: strands > ghosts, 16 nodes --></body>"),
     ""],

    /* ---- SHELL.md r9, the correction form ---- */
    ["the correction form posting somewhere other than the declared endpoint", "gate", (d) => edit(d, "index.html", 'action="https://formspree.io/f/xaewoadr"', 'action="https://example.com/collect"'),
     "posts to the endpoint the record declares"],
    ["the _gotcha honeypot removed", "gate", (d) => edit(d, "index.html", ' name="_gotcha"', ' name="not-a-honeypot"'),
     "carries the _gotcha honeypot"],
    ["the honeypot hidden with display:none instead of off-screen", "gate", (d) => edit(d, "index.html", ".say input[name=_gotcha]{position:absolute;left:-9999px", ".say input[name=_gotcha]{display:none;left:-9999px"),
     "moved off-screen, not display:none"],
    ["the form turned into a fetch bolted to a button", "gate", (d) => edit(d, "index.html", 'method="POST" novalidate', 'novalidate'),
     "a real POST, not a fetch bolted to a button"],
    ["the reply paragraph losing its live region", "gate", (d) => edit(d, "index.html", '<p class="say-msg" role="status" aria-live="polite">', '<p class="say-msg">'),
     "a polite live region"],
    /* The failure this whole site is about, in its smallest form: a thank-you
       printed before the endpoint has said anything. */
    ["success printed without waiting for a 2xx", "gate", (d) => edit(d, "contact.js", "if (r.ok) {", "if (true) {"),
     "success only inside a response-ok guard"],
    ["a contact record the build will not write a form from", "build", (d) => editJSON(d, "records/surface.json", (j) => { j.contact.endpoint = "https://example.com/collect"; }),
     "The correction form posts to a Formspree endpoint read from the record"],
    ["an inline script smuggled in beside the form", "gate", (d) => edit(d, "index.html", '<script src="/contact.js" defer></script>', '<script>document.forms[0].onsubmit=null</script>'),
     "does not depend on JavaScript"],
];

function edit(dir, file, from, to) {
    const p = path.join(dir, file);
    const s = readFileSync(p, "utf8");
    if (!s.includes(from)) throw new Error(`break is stale: ${file} no longer contains ${JSON.stringify(from.slice(0, 44))}`);
    writeFileSync(p, s.replace(from, to));
}
function editJSON(dir, file, fn) {
    const p = path.join(dir, file);
    const j = JSON.parse(readFileSync(p, "utf8"));
    fn(j);
    writeFileSync(p, JSON.stringify(j, null, 2));
}
function buildIdOf(dir) {
    return JSON.parse(readFileSync(path.join(dir, "build-stamp.json"), "utf8")).build_id;
}
/* A gate-stage break edits the artifact, which by construction breaks the
   freshness check as well. Recomputing just the artifact hashes keeps that
   check quiet so the break can trip the check it was written for. It is
   deliberately NOT applied to the `stale` stage, which is where the freshness
   check is the one on trial. */
function restampArtifacts(dir) {
    const p = path.join(dir, "build-stamp.json");
    const s = JSON.parse(readFileSync(p, "utf8"));
    if (!s.artifacts || !s.inputs || !s.build_id) {
        throw new Error("build-stamp.json is not the shape prove-gate expects — the re-stamp would be a silent no-op and every gate break below would refuse for the wrong reason.");
    }
    s.artifacts = artifactHashes(dir);
    writeFileSync(p, JSON.stringify(s, null, 2) + "\n");
}
function run(dir, script) {
    try {
        const out = execFileSync(process.execPath, [script], { cwd: dir, stdio: "pipe" });
        return { refused: false, out: String(out) };
    } catch (e) {
        return { refused: true, out: String(e.stdout || "") + String(e.stderr || "") };
    }
}

let refused = 0;
let sound = 0;
const allowed = [];
const wrongReason = [];
console.log(`proving the gate — ${BREAKS.length} deliberate breaks\n`);

for (const [name, stage, mutate, expect] of BREAKS) {
    const dir = mkdtempSync(path.join(tmpdir(), "gproof-"));
    try {
        for (const f of COPY) cpSync(path.join(SRC, f), path.join(dir, f));
        cpSync(path.join(SRC, "records"), path.join(dir, "records"), { recursive: true });
        cpSync(path.join(SRC, "src"), path.join(dir, "src"), { recursive: true });

        mutate(dir);
        if (stage === "gate" || stage === "pass") restampArtifacts(dir);

        let r;
        if (stage === "pass") {
            r = run(dir, "launch-gate.mjs");
            if (r.refused) {
                allowed.push(name + "  (FALSE REFUSAL — the gate objected to something it must not)");
                console.log(`  FALSE    ${name}\n           the gate REFUSED a mutation it must not object to`);
            } else {
                sound++;
                console.log(`  SOUND    ${name}\n           the gate passed, as it must`);
            }
            continue;
        }
        if (stage === "build") {
            r = run(dir, "build-site.mjs");
        } else if (stage === "rebuild") {
            const b = run(dir, "build-site.mjs");
            if (b.refused) {
                r = { refused: true, out: "WRONG STAGE — the build refused this; it belongs in stage `build`.\n" + b.out };
            } else {
                r = run(dir, "launch-gate.mjs");
            }
        } else {
            r = run(dir, "launch-gate.mjs");
        }

        const reasons = [...r.out.matchAll(/^\s*(?:REFUSE {2})(.+)$/gm)].map((m) => m[1].trim());
        const thrown = (r.out.match(/(BUILD REFUSED[^\n]*|Error: [^\n]*)/) || [""])[0].trim();
        const all = reasons.length ? reasons : thrown ? [thrown] : [];
        const onPurpose = all.some((x) => x.includes(expect));

        if (!r.refused) {
            allowed.push(name);
            console.log(`  ALLOWED  ${name}\n           <-- the gate did not notice`);
        } else if (!onPurpose) {
            wrongReason.push(name);
            console.log(`  WRONG    ${name}\n           refused, but not for "${expect}" — got: ${all.slice(0, 2).join(" | ").slice(0, 120)}`);
        } else {
            refused++;
            console.log(`  REFUSED  ${name}\n           ${all.length} check(s): ${all.find((x) => x.includes(expect)).slice(0, 96)}`);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

const probes = BREAKS.filter((b) => b[1] === "pass").length;
console.log(`\n${refused} of ${BREAKS.length - probes} deliberate breaks were refused by the check written for them`);
console.log(`${sound} of ${probes} soundness probes passed, as they must — a check that refuses everything is not a check`);
if (allowed.length) {
    console.log("NOT REFUSED AT ALL:");
    allowed.forEach((a) => console.log("  " + a));
}
if (wrongReason.length) {
    console.log("REFUSED FOR THE WRONG REASON:");
    wrongReason.forEach((a) => console.log("  " + a));
}
if (allowed.length || wrongReason.length) process.exit(1);
