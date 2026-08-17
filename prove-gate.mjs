/* ==========================================================================
   Prove the gate can fail.  node prove-gate.mjs

   A gate nobody has seen refuse is an opinion (SHELL.md §4.3). This breaks
   each check on purpose in a THROWAWAY COPY of the repository — /tmp, never
   the working tree — runs the gate there, and reports whether it refused.

   It restores nothing, because it changes nothing: every break happens inside
   a fresh copy that is deleted at the end. If this script is interrupted the
   working tree is still clean, which is the only reason it is safe to run
   while five other lanes share the tree.
   ========================================================================== */
import { mkdtempSync, cpSync, rmSync, readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { tmpdir } from "os";
import path from "path";
import { fileURLToPath } from "url";

const SRC = path.dirname(fileURLToPath(import.meta.url));

/* Each break: a name, and a mutation applied to a fresh copy. `build` means
   the break should be caught by build-site.mjs (nothing is emitted at all);
   otherwise the gate reads the already-emitted artifact. */
const BREAKS = [
    ["a figure with no witness", "build", (d) => edit(d, "build-site.mjs", 'f("machines")', 'f("machines_v2")')],
    ["a witnessed fact that reaches no page", "build", (d) => edit(d, "build-site.mjs", '[f("demos"), "Demos on this domain"],', "")],
    ["the install table disagreeing with the count", "build", (d) => editJSON(d, "records/witness.json", (j) => { j.facts.install_targets_ok.value = "3"; })],
    ["a CTA verb the rung has not earned", "build", (d) => edit(d, "build-site.mjs", 'verb: "Inspect the source"', 'verb: "Use it"')],
    ["a band claiming a tier the record does not hold", "build", (d) => editJSON(d, "records/surface.json", (j) => { delete j.tier; })],
    ["release identity broken", "build", (d) => editJSON(d, "package.json", (j) => { j.version = "9.9.9"; })],
    ["a shell revision other than shell-r4", "build", (d) => editJSON(d, "records/surface.json", (j) => { j.shell_revision = "shell-r3"; })],

    ["an unrendered {{TOKEN}} in the artifact", "gate", (d) => edit(d, "index.html", "<h2>", "<h2>{{LEFTOVER}} ")],
    ["a mailto: anywhere on the page", "gate", (d) => edit(d, "index.html", 'href="/demo/"', 'href="mailto:x@example.com"')],
    ["a fabricated rung on a chip", "gate", (d) => edit(d, "index.html", 'data-rung="live_deployed"', 'data-rung="shipped"')],
    ["a chip whose text disagrees with its stored rung", "gate", (d) => edit(d, "index.html", '>live_deployed</span>', '>external</span>')],
    /* Text and attribute changed together, so ONLY the null-rung check can
       fire — a break that trips three checks proves less than one that trips
       the check it was written for. */
    ["a null rung", "gate", (d) => edit(d, "index.html", 'data-rung="live_deployed" title="spec · in_tree · live_local · live_deployed · external">live_deployed<', 'data-rung="null" title="spec · in_tree · live_local · live_deployed · external">null<')],
    ["the covers span removed from the band", "gate", (d) => edit(d, "index.html", 'class="covers"', 'class="gone"')],
    ["the LIMIT row removed", "gate", (d) => edit(d, "index.html", "<dt>Limit</dt>", "<dt>Caveat</dt>")],
    ["a review gate approved with no evidence", "gate", (d) => editJSON(d, "records/surface.json", (j) => { j.gates.independent_use.status = "approved"; })],
    ["a plate figure with no witness", "gate", (d) => edit(d, "index.html", '<div class="n">577</div>', '<div class="n">9001</div>')],
    ["a retracted claim reinstated", "gate", (d) => edit(d, "index.html", "<h2>The suite is green", "<h2>Runs on macOS or Linux. The suite is green")],
    ["an install target the page never probed", "gate", (d) => edit(d, "index.html", '<td class="place">linux-x64</td>', '<td class="place">windows-x64</td>')],
    ["the identifying animation removed", "gate", (d) => edit(d, "index.html", "data-identity-animation", "data-decoration")],
    ["the animation writing into the page", "gate", (d) => edit(d, "memory.js", "var ACC =", "el.textContent = NODES;\nvar ACC =")],
    ["an animation constant published as a number", "gate", (d) => edit(d, "index.html", "<h2>Five machines", "<h2>Now with 13 of them. Five machines")],
    ["prefers-reduced-motion dropped", "gate", (d) => edit(d, "memory.js", "prefers-reduced-motion: reduce", "all")],
    ["the animation not stopping on a hidden tab", "gate", (d) => edit(d, "memory.js", "document.hidden", "false")],
    ["a contrast failure (--fg3 back to .34)", "gate", (d) => edit(d, "index.html", "--fg3:rgba(233,236,241,.55)", "--fg3:rgba(233,236,241,.34)")],
    ["an interactive element with no :hover", "gate", (d) => edit(d, "index.html", ".logo:hover{color:var(--acc)}", "")],
    ["the focus-visible ring removed", "gate", (d) => edit(d, "index.html", ":focus-visible{outline:2px solid var(--acc);outline-offset:2px}", "")],
    ["an inline style= smuggled in", "gate", (d) => edit(d, "index.html", '<div class="wrap">', '<div class="wrap" style="padding:0">')],
    ["inline script in the artifact", "gate", (d) => edit(d, "index.html", "</body>", "<script>var x=1</script></body>")],
    ["the amp-nav mount point dropped", "gate", (d) => edit(d, "index.html", '<amp-nav property="graphonomous">', "<div>")],
];

function edit(dir, file, from, to) {
    const p = path.join(dir, file);
    const s = readFileSync(p, "utf8");
    if (!s.includes(from)) throw new Error(`break is stale: ${file} no longer contains ${JSON.stringify(from.slice(0, 40))}`);
    writeFileSync(p, s.replace(from, to));
}
function editJSON(dir, file, fn) {
    const p = path.join(dir, file);
    const j = JSON.parse(readFileSync(p, "utf8"));
    fn(j);
    writeFileSync(p, JSON.stringify(j, null, 2));
}
function run(dir, script) {
    try {
        execFileSync(process.execPath, [script], { cwd: dir, stdio: "pipe" });
        return { refused: false, out: "" };
    } catch (e) {
        return { refused: true, out: String(e.stdout || "") + String(e.stderr || "") };
    }
}

let refused = 0;
let allowed = [];
console.log(`proving the gate — ${BREAKS.length} deliberate breaks\n`);

for (const [name, stage, mutate] of BREAKS) {
    const dir = mkdtempSync(path.join(tmpdir(), "gproof-"));
    try {
        for (const f of ["build-site.mjs", "launch-gate.mjs", "package.json", "index.html", "memory.js"]) {
            cpSync(path.join(SRC, f), path.join(dir, f));
        }
        cpSync(path.join(SRC, "records"), path.join(dir, "records"), { recursive: true });
        cpSync(path.join(SRC, "src"), path.join(dir, "src"), { recursive: true });

        mutate(dir);

        /* A build-stage break must stop the BUILD. A gate-stage break is
           applied to the artifact directly, so the build is not re-run — that
           would overwrite the very thing being tested. */
        const r = stage === "build" ? run(dir, "build-site.mjs") : run(dir, "launch-gate.mjs");
        if (r.refused) {
            refused++;
            const why = (r.out.match(/(BUILD REFUSED[^\n]*|REFUSE {2}[^\n]*|Error: [^\n]*)/) || [""])[0].trim().slice(0, 96);
            console.log(`  REFUSED  ${name}\n           ${why}`);
        } else {
            allowed.push(name);
            console.log(`  ALLOWED  ${name}   <-- the gate did not notice`);
        }
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}

console.log(`\n${refused} of ${BREAKS.length} deliberate breaks were refused`);
if (allowed.length) {
    console.log("NOT REFUSED:");
    allowed.forEach((a) => console.log("  " + a));
    process.exit(1);
}
